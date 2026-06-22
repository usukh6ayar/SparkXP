import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Word } from '../entities/word.entity';
import { WordsService } from './words.service';
import { WordsController } from './words.controller';
import { XpModule } from '../xp/xp.module';
import { SparksModule } from '../sparks/sparks.module';

/** Vocabulary CRUD + quiz. Exports WordsService so other modules (e.g. spaced
 *  repetition / reviews) can reuse it. Imports XP/Sparks to reward quizzes. */
@Module({
  imports: [TypeOrmModule.forFeature([Word]), XpModule, SparksModule],
  controllers: [WordsController],
  providers: [WordsService],
  exports: [WordsService],
})
export class WordsModule {}
