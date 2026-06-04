import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WordReview } from '../entities/word-review.entity';
import { Word } from '../entities/word.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

/** Vocabulary spaced repetition (SM-2). Needs WordReview + Word repositories. */
@Module({
  imports: [TypeOrmModule.forFeature([WordReview, Word])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
