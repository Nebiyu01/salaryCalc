import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  role: string;
}

/**
 * Verifies the short-lived access token from the httpOnly cookie and attaches
 * the user to the request. Protects any route/controller it decorates.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.["access_token"];
    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(
        token,
        { secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET") },
      );
      (req as Request & { user: AuthenticatedUser }).user = {
        id: payload.sub,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
