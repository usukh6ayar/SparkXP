import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { AchievementsService } from './achievements.service';
import { MarkSeenDto } from './dto/mark-seen.dto';

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /** The trophy catalog + this user's earned flags, dates and unseen list. */
  @Get()
  getMine(@CurrentUser() user: User) {
    return this.achievements.getForUser(user.id);
  }

  /** Call after showing the unlock celebration so it isn't shown again. */
  @Post('seen')
  markSeen(@CurrentUser() user: User, @Body() dto: MarkSeenDto) {
    return this.achievements.markSeen(user.id, dto.slugs);
  }
}
