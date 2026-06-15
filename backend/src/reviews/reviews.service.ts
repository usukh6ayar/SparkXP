import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { WordReview } from '../entities/word-review.entity';
import { Word } from '../entities/word.entity';
import { computeSm2, initialSm2State } from './sm2';

/** Safety cap so the daily due queue never returns a huge payload. */
const DUE_LIMIT = 100;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(WordReview)
    private readonly reviews: Repository<WordReview>,
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
  ) {}

  /**
   * Words this user is due to review now: existing WordReviews whose
   * nextReviewAt has passed, soonest first, with the Word attached so the app
   * can render it.
   */
  getDue(userId: string): Promise<WordReview[]> {
    return this.reviews.find({
      where: { userId, nextReviewAt: LessThanOrEqual(new Date()) },
      relations: { word: true },
      order: { nextReviewAt: 'ASC' },
      take: DUE_LIMIT,
    });
  }

  /**
   * Record a recall attempt and reschedule the word with SM-2.
   *
   * First-ever review of a word creates its WordReview row (starting from the
   * SM-2 defaults on the entity), so a learner can study any word from the
   * vocabulary bank and it enters their schedule.
   */
  async submit(
    userId: string,
    wordId: string,
    quality: number,
  ): Promise<WordReview> {
    // The word must exist before we schedule reviews for it.
    const word = await this.words.findOne({ where: { id: wordId } });
    if (!word) {
      throw new NotFoundException('Үг олдсонгүй');
    }

    // Find this user's review for the word, or start a fresh one. New cards get
    // explicit SM-2 starting values (entity @Column defaults only apply on the
    // DB insert, not on repository.create()).
    let review = await this.reviews.findOne({ where: { userId, wordId } });
    if (!review) {
      review = this.reviews.create({
        userId,
        wordId,
        ...initialSm2State(),
      });
    }

    const now = new Date();
    const next = computeSm2(
      {
        easeFactor: review.easeFactor,
        intervalDays: review.intervalDays,
        repetitions: review.repetitions,
      },
      quality,
      now,
    );

    review.easeFactor = next.easeFactor;
    review.intervalDays = next.intervalDays;
    review.repetitions = next.repetitions;
    review.nextReviewAt = next.nextReviewAt;
    review.lastReviewedAt = now;

    return this.reviews.save(review);
  }

  /**
   * Word stats for the swipe-learning UI.
   * - `known`: words recalled at least once (repetitions >= 1) → "мэдэх үг".
   * - `learning`: seen but not yet known (repetitions = 0).
   */
  async getStats(userId: string): Promise<{ known: number; learning: number }> {
    const [known, learning] = await Promise.all([
      this.reviews.count({ where: { userId, repetitions: MoreThanOrEqual(1) } }),
      this.reviews.count({ where: { userId, repetitions: 0 } }),
    ]);
    return { known, learning };
  }

  /**
   * Deck of words to learn (swipe): vocabulary the user does NOT yet know
   * (no review yet, or repetitions = 0). Known words are excluded.
   */
  async getLearnQueue(userId: string, limit = 30): Promise<Word[]> {
    const knownRows = await this.reviews.find({
      where: { userId, repetitions: MoreThanOrEqual(1) },
      select: { wordId: true },
    });
    const knownIds = knownRows.map((r) => r.wordId);

    const qb = this.words
      .createQueryBuilder('w')
      .orderBy('w.created_at', 'ASC')
      .take(limit);
    if (knownIds.length > 0) {
      qb.where('w.id NOT IN (:...knownIds)', { knownIds });
    }
    return qb.getMany();
  }
}
