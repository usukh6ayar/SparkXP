import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { WordReview } from '../entities/word-review.entity';
import { Word } from '../entities/word.entity';
import { RecallStatus, WordStatus } from '../common/enums';
import { computeSm2, initialSm2State, PASS_THRESHOLD } from './sm2';

/** Safety cap so the daily due queue never returns a huge payload. */
const DUE_LIMIT = 100;

/** A word in the swipe deck, plus this user's saved (⭐) flag for it. */
export type LearnCard = Word & { saved: boolean };

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

    // Per-user swipe progress (separate from SM-2 scheduling).
    const passed = quality >= PASS_THRESHOLD;
    review.reviewCount += 1;
    review.lastSeenAt = now;
    if (passed) {
      review.correctCount += 1;
      review.recallStatus = RecallStatus.KNOW;
    } else {
      review.wrongCount += 1;
      review.recallStatus = RecallStatus.FORGOT;
    }

    return this.reviews.save(review);
  }

  /**
   * Toggle the ⭐ saved flag for a (user, word). Creates the WordReview on first
   * save so a learner can star a word they haven't reviewed yet.
   */
  async toggleSave(
    userId: string,
    wordId: string,
  ): Promise<{ wordId: string; saved: boolean }> {
    const word = await this.words.findOne({ where: { id: wordId } });
    if (!word) throw new NotFoundException('Үг олдсонгүй');

    let review = await this.reviews.findOne({ where: { userId, wordId } });
    if (!review) {
      review = this.reviews.create({ userId, wordId, ...initialSm2State() });
    }
    review.saved = !review.saved;
    await this.reviews.save(review);
    return { wordId, saved: review.saved };
  }

  /** Words this user has saved (⭐) — for the "Saved words" screen. */
  async getSaved(userId: string): Promise<Word[]> {
    const rows = await this.reviews.find({
      where: { userId, saved: true },
      relations: { word: true },
      order: { lastSeenAt: 'DESC' },
    });
    return rows.map((r) => r.word);
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
   * Deck of words to learn (swipe): PUBLISHED vocabulary the user does NOT yet
   * know (no review yet, or repetitions = 0). Each card carries this user's
   * saved (⭐) flag so the swipe UI can render the star without an extra call.
   */
  async getLearnQueue(userId: string, limit = 30): Promise<LearnCard[]> {
    // Words the user already knows (excluded from the deck).
    const knownRows = await this.reviews.find({
      where: { userId, repetitions: MoreThanOrEqual(1) },
      select: { wordId: true },
    });
    const knownIds = knownRows.map((r) => r.wordId);

    const qb = this.words
      .createQueryBuilder('w')
      .where('w.status = :status', { status: WordStatus.PUBLISHED })
      .orderBy('w.created_at', 'ASC')
      .take(limit);
    if (knownIds.length > 0) {
      qb.andWhere('w.id NOT IN (:...knownIds)', { knownIds });
    }
    const words = await qb.getMany();
    if (words.length === 0) return [];

    // Which of these the user has starred → merge a `saved` flag per card.
    const savedRows = await this.reviews.find({
      where: { userId, wordId: In(words.map((w) => w.id)), saved: true },
      select: { wordId: true },
    });
    const savedIds = new Set(savedRows.map((r) => r.wordId));

    return words.map((w) => ({ ...w, saved: savedIds.has(w.id) }));
  }
}
