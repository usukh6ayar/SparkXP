import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { XpModule } from '../xp/xp.module';

/** Lesson CRUD. Exports LessonsService so the Sparks store (lesson unlock)
 *  and other modules can reuse it. Imports XP to reward lesson completion. */
@Module({
  imports: [TypeOrmModule.forFeature([Lesson]), XpModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
