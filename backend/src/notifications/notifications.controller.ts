import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Post('broadcast')
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.svc.broadcast(dto);
  }

  @Get()
  findAll() {
    return this.svc.findAll();
  }
}
