import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response, CookieOptions } from "express";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@salary-calc/shared";
import { AuthService, TokenPair } from "./auth.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../prisma/prisma.service";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(dto.email, dto.password);
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const tokens = await this.auth.issueTokens(full, req.headers["user-agent"]);
    this.setAuthCookies(res, tokens);
    return { user };
  }

  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateCredentials(dto.email, dto.password);
    const tokens = await this.auth.issueTokens(user, req.headers["user-agent"]);
    this.setAuthCookies(res, tokens);
    return { user: this.auth.toPublicUser(user) };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException("Missing refresh token");
    const tokens = await this.auth.rotateRefreshToken(
      token,
      req.headers["user-agent"],
    );
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeRefreshToken(req.cookies?.[REFRESH_COOKIE] ?? "");
    res.clearCookie(ACCESS_COOKIE, this.cookieBase());
    res.clearCookie(REFRESH_COOKIE, this.cookieBase());
    return { ok: true };
  }

  /** Current authenticated user — handy for the frontend to restore session. */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.id },
    });
    return { user: this.auth.toPublicUser(user) };
  }

  private cookieBase(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>("COOKIE_SECURE") ?? false,
      sameSite: "lax",
      path: "/",
    };
  }

  private setAuthCookies(res: Response, tokens: TokenPair): void {
    // Access cookie: short-lived. Refresh cookie: scoped to the refresh route.
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...this.cookieBase(),
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieBase(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
