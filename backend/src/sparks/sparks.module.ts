import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SparksLog } from '../entities/sparks-log.entity';
import { LessonUnlock } from '../entities/lesson-unlock.entity';
import { Lesson } from '../entities/lesson.entity';
import { User } from '../entities/user.entity';
import { SparksService } from './sparks.service';
import { SparksController } from './sparks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SparksLog, LessonUnlock, Lesson, User])],
  providers: [SparksService],
  controllers: [SparksController],
  exports: [SparksService],
})
export class SparksModule {}
