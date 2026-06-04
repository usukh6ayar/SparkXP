import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Word } from '../entities/word.entity';
import { WordsService } from './words.service';
import { WordsController } from './words.controller';

/** Vocabulary CRUD. Exports WordsService so other modules (e.g. spaced
 *  repetition / reviews) can reuse it. */
@Module({
  imports: [TypeOrmModule.forFeature([Word])],
  controllers: [WordsController],
  providers: [WordsService],
  exports: [WordsService],
})
export class WordsModule {}
