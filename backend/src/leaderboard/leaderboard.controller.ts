import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { LeaderboardScope, UserRole } from '../common/enums';

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

  /**
   * Admin dashboard: top N users without relying on the admin's own location.
   * GET /api/leaderboard/top?period=weekly&scope=global
   * GET /api/leaderboard/top?period=weekly&scope=province&value=Улаанбаатар
   */
  @Get('top')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  getTop(
    @Query('scope') scope: LeaderboardScope = LeaderboardScope.GLOBAL,
    @Query('period') period = 'weekly',
    @Query('value') value?: string,
    @Query('limit') limit = '20',
  ) {
    return this.leaderboardService.getTopList(
      scope,
      period,
      value ?? null,
      Number(limit),
    );
  }
}
