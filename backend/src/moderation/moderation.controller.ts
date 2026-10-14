import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { ReportUserDto, ResolveReportDto } from './dto/moderation.dto';
import { ModerationService } from './moderation.service';

/** The app side: report or block another user (from a leaderboard row). */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly service: ModerationService) {}

  @Get('me/blocks')
  listBlocked(@CurrentUser() user: User) {
    return this.service.listBlocked(user.id);
  }

  @Post(':id/report')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  report(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportUserDto,
  ) {
    return this.service.report(user.id, id, dto.reason);
  }

  @Post(':id/block')
  @HttpCode(204)
  block(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.block(user.id, id);
  }

  @Delete(':id/block')
  @HttpCode(204)
  unblock(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.unblock(user.id, id);
  }
}

/** Admin panel «Гомдол» page. */
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminReportsController {
  constructor(private readonly service: ModerationService) {}

  @Get()
  list() {
    return this.service.listReports();
  }

  /** Badge on the nav item. */
  @Get('open-count')
  async openCount() {
    return { count: await this.service.countOpen() };
  }

  @Post(':id/resolve')
  @HttpCode(204)
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.service.resolve(id, dto.action);
  }
}
