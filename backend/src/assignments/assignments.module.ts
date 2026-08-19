import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment } from '../entities/assignment.entity';
import { AssignmentCompletion } from '../entities/assignment-completion.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { ClassesModule } from '../classes/classes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssignmentsService } from './assignments.service';
import { AssignmentsController } from './assignments.controller';

/** Teacher assignments (lesson/quiz → class). Depends on ClassesModule for
 *  ownership/membership checks, and NotificationsModule to tell students a
 *  new task arrived. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Assignment, AssignmentCompletion, Lesson, Quiz]),
    ClassesModule,
    NotificationsModule,
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
