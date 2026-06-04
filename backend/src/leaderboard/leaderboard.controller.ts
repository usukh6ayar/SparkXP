import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

/**
 * GET /api/leaderboard?period=weekly&scope=province
 *
 * Returns the top N by XP for the chosen period + scope, plus the current
 * user's own rank. Province/district/organization scopes use the current
 * user's own location; class scope needs a `classId`.
 */
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  get(@CurrentUser() user: User, @Query() query: QueryLeaderboardDto) {
    return this.leaderboardService.getLeaderboard(user, query);
  }
}
