import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { PublicUser } from "@salary-calc/shared";
import type { User } from "@prisma/client";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Create a new account. Password is hashed with Argon2id. */
  async register(email: string, password: string): Promise<PublicUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email: normalizedEmail, passwordHash },
    });
    return this.toPublicUser(user);
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
