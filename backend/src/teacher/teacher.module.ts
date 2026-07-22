import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { Lesson } from '../entities/lesson.entity';
import { WordReview } from '../entities/word-review.entity';
import { AssignmentCompletion } from '../entities/assignment-completion.entity';
import { Assignment } from '../entities/assignment.entity';
import { ClassesModule } from '../classes/classes.module';
import { ProgressService } from './progress.service';
import { TeacherController } from './teacher.controller';

/** Teacher-facing progress: persist quiz attempts + read views. */
@Module({
  imports: [
    TypeOrmModule.forFeature([QuizAttempt, Lesson, WordReview, AssignmentCompletion, Assignment]),
    ClassesModule,
  ],
  controllers: [TeacherController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class TeacherModule {}
