import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BuddyBackgroundsService } from './buddy-backgrounds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';
import { CreateBackgroundDto, UpdateBackgroundDto } from './dto/background.dto';

/** AI Buddy background shop. Students browse/buy/equip; admins manage the catalog. */
@Controller('buddy/backgrounds')
@UseGuards(JwtAuthGuard)
export class BuddyBackgroundsController {
  constructor(private readonly svc: BuddyBackgroundsService) {}

  /** Shop catalog with this user's owned/equipped/lock state. */
  @Get()
  list(@CurrentUser() user: User) {
    return this.svc.list(user.id);
  }

  /** The user's currently equipped background (or null) — shown behind the buddy. */
  @Get('equipped')
  equipped(@CurrentUser() user: User) {
    return this.svc.equipped(user.id);
  }

  /** Buy a background with Sparks. */
  @Post(':id/buy')
  @HttpCode(HttpStatus.OK)
  buy(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.buy(user.id, id);
  }

  /** Equip an owned background (unequips the rest). */
  @Post(':id/equip')
  @HttpCode(HttpStatus.OK)
  equip(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.svc.equip(user.id, id);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  @Get('manage')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  findAll() {
    return this.svc.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateBackgroundDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBackgroundDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
