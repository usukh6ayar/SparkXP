import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuddySession } from '../entities/buddy-session.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { User } from '../entities/user.entity';
import { UserTrophy } from '../entities/user-trophy.entity';
import { WordReview } from '../entities/word-review.entity';
import { XpLog } from '../entities/xp-log.entity';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { TrophyStatsService } from './trophy-stats.service';

/**
 * Exports AchievementsService so XpModule can trigger a trophy check after
 * awarding XP. No cycle: this module never imports XpModule — trophy stats are
 * read straight from the repositories below.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserTrophy,
      XpLog,
      QuizAttempt,
      WordReview,
      BuddySession,
    ]),
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService, TrophyStatsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
