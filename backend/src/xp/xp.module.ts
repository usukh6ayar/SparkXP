import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { Lesson } from '../entities/lesson.entity';
import { UserLessonStar } from '../entities/user-lesson-star.entity';
import { LevelRequirement } from '../entities/level-requirement.entity';
import { Event } from '../entities/event.entity';
import { XpService } from './xp.service';
import { StarsService } from './stars.service';
import { XpController } from './xp.controller';
import { LessonStarsController } from './lesson-stars.controller';
import { SparksModule } from '../sparks/sparks.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([XpLog, User, Lesson, UserLessonStar, LevelRequirement, Event]),
    SparksModule,
    AchievementsModule,
  ],
  controllers: [XpController, LessonStarsController],
  providers: [XpService, StarsService],
  // StarsService is exported so the quiz-submit flow can award lesson stars.
  exports: [XpService, StarsService],
})
export class XpModule {}
