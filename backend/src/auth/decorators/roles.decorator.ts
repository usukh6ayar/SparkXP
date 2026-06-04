import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../common/enums';

/** Metadata key the RolesGuard reads. */
export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles. Use together with JwtAuthGuard so the
 * user is loaded first:
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 *   @Get('admin-only')
 *   ...
 *
 * With no @Roles on a route, RolesGuard lets everyone (who is authenticated)
 * through.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
