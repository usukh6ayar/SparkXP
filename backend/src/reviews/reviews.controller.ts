import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

/**
 * Spaced-repetition endpoints under /api/reviews. Student-facing: each acts on
 * the current user's own review schedule.
 */
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** Words due for review right now. */
  @Get('due')
  getDue(@CurrentUser() user: User) {
    return this.reviewsService.getDue(user.id);
  }

  /** Word stats: { known, learning } — for the profile "мэдэх үг" count. */
  @Get('stats')
  getStats(@CurrentUser() user: User) {
    return this.reviewsService.getStats(user.id);
  }

  /**
   * Deck of words to learn (not yet known) — for the swipe screen.
   *
   * `?lessonId=` narrows it to one lesson's curated vocabulary ("practise this
   * lesson's words"). Without it the deck is ordered by how close each word is
   * to the learner's own CEFR level, so the level they picked at sign-up
   * actually decides what they study.
   */
  @Get('learn')
  getLearn(@CurrentUser() user: User, @Query('lessonId') lessonId?: string) {
    return this.reviewsService.getLearnQueue(user.id, undefined, {
      lessonId,
      level: user.level,
    });
  }

  /** Words the user has saved (⭐) — for the saved-words screen. */
  @Get('saved')
  getSaved(@CurrentUser() user: User) {
    return this.reviewsService.getSaved(user.id);
  }

  /** Toggle the ⭐ saved flag for a word; returns the new state. */
  @Post(':wordId/save')
  toggleSave(
    @CurrentUser() user: User,
    @Param('wordId', ParseUUIDPipe) wordId: string,
  ) {
    return this.reviewsService.toggleSave(user.id, wordId);
  }

  /** Submit a recall attempt for a word; returns the rescheduled review. */
  @Post(':wordId')
  submit(
    @CurrentUser() user: User,
    @Param('wordId', ParseUUIDPipe) wordId: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.reviewsService.submit(user.id, wordId, dto.quality);
  }
}
