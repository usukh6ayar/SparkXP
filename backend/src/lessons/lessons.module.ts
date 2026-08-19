import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { LessonUnlock } from '../entities/lesson-unlock.entity';
import { User } from '../entities/user.entity';
import { LessonsService } from './lessons.service';
import { LessonAccessService } from './lesson-access.service';
import { LessonsController } from './lessons.controller';
import { XpModule } from '../xp/xp.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { AssignmentsModule } from '../assignments/assignments.module';

/** Lesson CRUD. Exports LessonsService so the Sparks store (lesson unlock)
 *  and other modules can reuse it, and LessonAccessService which owns the
 *  "may this student watch this?" rule. Imports XP to reward lesson
 *  completion, AiGateway for the shared STT adapter (video → transcript), and
 *  Assignments so teacher homework can bypass the free-lesson quota. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson, AiUsage, LessonUnlock, User]),
    XpModule,
    AiGatewayModule,
    AssignmentsModule,
  ],
  controllers: [LessonsController],
  providers: [LessonsService, LessonAccessService],
  exports: [LessonsService, LessonAccessService],
})
export class LessonsModule {}
