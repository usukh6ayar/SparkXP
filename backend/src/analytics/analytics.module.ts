import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { WordReview } from '../entities/word-review.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { BuddySession } from '../entities/buddy-session.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Message } from '../entities/message.entity';
import { XpModule } from '../xp/xp.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

/**
 * Learning analytics — read-only aggregation over existing tables. Reuses
 * XpModule's `XpService` (streak/xp) + `StarsService` (stars); no new tables.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      XpLog,
      SparksLog,
      WordReview,
      QuizAttempt,
      BuddySession,
      AiUsage,
      Message,
    ]),
    XpModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
