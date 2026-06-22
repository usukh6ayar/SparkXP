import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Word } from '../entities/word.entity';
import { WordReview } from '../entities/word-review.entity';
import { WordsService } from './words.service';
import { WordsController } from './words.controller';
import { XpModule } from '../xp/xp.module';
import { SparksModule } from '../sparks/sparks.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

/** Vocabulary CRUD + quiz. Exports WordsService so other modules (e.g. spaced
 *  repetition / reviews) can reuse it. Imports XP/Sparks to reward quizzes.
 *  WordReview is read for content analytics (most forgotten/saved words). */
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Word, WordReview]), XpModule, SparksModule, AiGatewayModule],
  controllers: [WordsController],
  providers: [WordsService],
  exports: [WordsService],
})
export class WordsModule {}
