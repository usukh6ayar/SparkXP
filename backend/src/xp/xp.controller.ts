import { Controller, Get, UseGuards } from '@nestjs/common';
import { XpService } from './xp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

/** Gamification summary for the current user (streak, level, today's XP). */
@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class XpController {
  constructor(private readonly xpService: XpService) {}

  @Get()
  getMine(@CurrentUser() user: User) {
    return this.xpService.getGamification(user.id);
  }
}
