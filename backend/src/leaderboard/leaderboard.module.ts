import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { ClassEntity } from '../entities/class.entity';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { ModerationModule } from '../moderation/moderation.module';

/** XP leaderboards (global / province / district / class / organization / teacher). */
@Module({
  imports: [TypeOrmModule.forFeature([XpLog, ClassEntity]), ModerationModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
