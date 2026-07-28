import { Controller, Get, Patch, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { XpService } from './xp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { SetDailyGoalDto } from './dto/set-goal.dto';

/** Gamification summary for the current user (streak, level, today's XP). */
@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class XpController {
  constructor(private readonly xpService: XpService) {}

  @Get()
  getMine(@CurrentUser() user: User) {
    return this.xpService.getGamification(user.id);
  }

  /** Buy one streak freeze with Sparks (max 2 held). */
  @Post('streak-freeze')
  @HttpCode(HttpStatus.OK)
  buyStreakFreeze(@CurrentUser() user: User) {
    return this.xpService.buyStreakFreeze(user.id);
  }

  /** Set the daily XP target (Хөнгөн 20 / Дунд 50 / Ширүүн 100). */
  @Patch('goal')
  setGoal(@CurrentUser() user: User, @Body() dto: SetDailyGoalDto) {
    return this.xpService.setDailyGoal(user.id, dto.dailyGoalXp);
  }
}
