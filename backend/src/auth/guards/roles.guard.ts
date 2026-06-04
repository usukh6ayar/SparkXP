import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../../common/enums";
import { User } from "../../entities/user.entity";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Checks the authenticated user's role against the roles required by @Roles().
 * Must run AFTER JwtAuthGuard (which sets request.user):
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.TEACHER)
 *
 * If a route has no @Roles metadata, access is allowed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read required roles from the handler first, then the controller class.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No role restriction → allow.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as User | undefined;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Энэ үйлдлийг хийх эрх байхгүй байна");
    }

    return true;
  }
}
