import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { createHash, randomInt, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../../mail/mail.service";
import type { PublicUser } from "@salary-calc/shared";
import type { User } from "@prisma/client";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  /**
   * Create a new (unverified) account, then email a 6-digit code. The caller
   * does NOT get a session until the email is verified.
   */
  async register(email: string, password: string): Promise<PublicUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      // If they never verified, let them re-register (refresh the code).
      if (!existing.emailVerifiedAt) {
        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
        await this.prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
        await this.issueVerificationCode(existing.id, normalizedEmail);
        return this.toPublicUser(existing);
      }
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email: normalizedEmail, passwordHash },
    });
    await this.issueVerificationCode(user.id, normalizedEmail);
    return this.toPublicUser(user);
  }

  /** Generate a 6-digit code, store its hash + expiry, and email it. */
  private async issueVerificationCode(userId: string, email: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationCodeHash: this.hashToken(code),
        verificationExpires: new Date(Date.now() + CODE_TTL_MS),
        verificationAttempts: 0,
      },
    });
    await this.mail.sendVerificationCode(email, code);
  }

  /** Check a 6-digit code; on success mark verified and return the user. */
  async verifyEmailCode(email: string, code: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.verificationCodeHash || !user.verificationExpires) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    if (user.emailVerifiedAt) return user; // already verified
    if (user.verificationExpires < new Date()) {
      throw new UnauthorizedException("Code has expired — request a new one");
    }
    if (user.verificationAttempts >= MAX_CODE_ATTEMPTS) {
      throw new UnauthorizedException("Too many attempts — request a new code");
    }
    if (this.hashToken(code) !== user.verificationCodeHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid or expired code");
    }
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationCodeHash: null,
        verificationExpires: null,
        verificationAttempts: 0,
      },
    });
  }

  /** Re-issue a verification code for an unverified account (no-op if verified). */
  async resendVerificationCode(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Respond the same whether or not the account exists / is already verified,
    // to avoid leaking which emails are registered.
    if (user && !user.emailVerifiedAt) {
      await this.issueVerificationCode(user.id, normalizedEmail);
    }
  }

  /** Verify credentials; returns the user or throws. */
  async validateCredentials(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    // Same error whether the email is unknown or the password is wrong,
    // so we don't leak which emails exist.
    const invalid = new UnauthorizedException("Invalid email or password");
    if (!user) {
      // Still run a hash to keep response timing roughly constant.
      await argon2.hash(password, { type: argon2.argon2id }).catch(() => {});
      throw invalid;
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw invalid;
    // Correct password but unverified: resend a code and tell the client to
    // show the verification screen (403 with a machine-readable reason).
    if (!user.emailVerifiedAt) {
      await this.issueVerificationCode(user.id, normalizedEmail);
      throw new ForbiddenException({
        message: "Please verify your email — we've sent you a new code",
        reason: "email_not_verified",
        email: normalizedEmail,
      });
    }
    return user;
  }

  /** Issue a fresh access/refresh pair and persist the hashed refresh token. */
  async issueTokens(user: User, userAgent?: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.getOrThrow<string>("JWT_ACCESS_TTL"),
      },
    );

    // Include a unique jti so each refresh token is distinct and revocable.
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti },
      {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.getOrThrow<string>("JWT_REFRESH_TTL"),
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
        userAgent: userAgent?.slice(0, 255),
      },
    });

    return { accessToken, refreshToken };
  }

  /** Rotate a refresh token: validate, revoke the old, issue a new pair. */
  async rotateRefreshToken(
    oldToken: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(oldToken, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokenHash = this.hashToken(oldToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is no longer valid");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException("User no longer exists");

    // Revoke the used token (rotation) then mint a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user, userAgent);
  }

  /** Revoke a refresh token (logout). Idempotent. */
  async revokeRefreshToken(token: string): Promise<void> {
    if (!token) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role.toLowerCase() as PublicUser["role"],
      createdAt: user.createdAt.toISOString(),
    };
  }

  /** Store only a SHA-256 of the refresh token so a DB leak can't reuse it. */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
