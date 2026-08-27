import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { RegisterPushTokenDto, PushPrefsDto } from './dto/push-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

/**
 * NOTE: the admin-only guard sits on the individual admin routes, NOT on the
 * controller — the push-token routes below are called by ordinary students
 * from the app.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  /** Register (or refresh) this device's Expo push token. Idempotent. */
  @Post('token')
  @HttpCode(HttpStatus.OK)
  registerToken(@CurrentUser() user: User, @Body() dto: RegisterPushTokenDto) {
    return this.svc.registerToken(user.id, dto.token);
  }

  /** Unregister on logout / permission revoked — stops all pushes. */
  @Delete('token')
  @HttpCode(HttpStatus.OK)
  removeToken(@CurrentUser() user: User) {
    return this.svc.removeToken(user.id);
  }

  /** Toggle reminders without losing the token (settings switch). */
  @Post('prefs')
  @HttpCode(HttpStatus.OK)
  setPrefs(@CurrentUser() user: User, @Body() dto: PushPrefsDto) {
    return this.svc.setPrefs(user.id, dto.enabled);
  }

  /**
   * This user's notification centre — personal rows + broadcasts aimed at them.
   * Declared before the admin `@Get()` below purely for readability; Nest
   * matches on the exact path, so order does not affect routing here.
   */
  @Get('me')
  findMine(@CurrentUser() user: User) {
    return this.svc.findForUser(user);
  }

  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.svc.broadcast(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll() {
    return this.svc.findAll();
  }
}
