import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { AuthenticatedUser } from "./jwt-auth.guard";

export const ROLES_KEY = "roles";
/** Decorate a route with e.g. `@Roles('admin')` to restrict by role. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Runs after JwtAuthGuard. Reads the required roles from route metadata and
 * checks them against the authenticated user. Foundation for the admin dashboard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    if (!req.user || !required.includes(req.user.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }
    return true;
  }
}
