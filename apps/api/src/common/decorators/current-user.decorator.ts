import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AuthenticatedUser } from "../guards/jwt-auth.guard";

/**
 * Injects the authenticated user (set by JwtAuthGuard) into a handler param.
 * Usage: `findMine(@CurrentUser() user: AuthenticatedUser)`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    return req.user;
  },
);
