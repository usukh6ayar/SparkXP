import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { Lesson } from '../entities/lesson.entity';
import { ProgressService } from './progress.service';

/** Teacher-facing progress: persist quiz attempts + (later) read views. */
@Module({
  imports: [TypeOrmModule.forFeature([QuizAttempt, Lesson])],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class TeacherModule {}
