import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { AnalyticsService } from './analytics.service';

/**
 * Learning analytics for the signed-in user. Read-only aggregation over data
 * the app already writes (see AnalyticsService) — no new tracking.
 */
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Full learner snapshot for the profile + future dashboards. */
  @Get('overview')
  overview(@CurrentUser() user: User) {
    return this.analytics.overview(user.id);
  }

  /** Per-day activity series for charts. `range` = week (7d, default) or month (30d). */
  @Get('history')
  history(@CurrentUser() user: User, @Query('range') range?: string) {
    return this.analytics.history(
      user.id,
      range === 'month' ? 'month' : 'week',
    );
  }
}
