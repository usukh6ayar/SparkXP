import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quiz } from '../entities/quiz.entity';
import { QuizzesService } from './quizzes.service';
import { QuizzesController } from './quizzes.controller';
import { XpModule } from '../xp/xp.module';
import { TeacherModule } from '../teacher/teacher.module';
import { AssignmentsModule } from '../assignments/assignments.module';
import { HeartsModule } from '../hearts/hearts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz]),
    XpModule,
    TeacherModule,
    AssignmentsModule,
    HeartsModule,
  ],
  providers: [QuizzesService],
  controllers: [QuizzesController],
  exports: [QuizzesService],
})
export class QuizzesModule {}
