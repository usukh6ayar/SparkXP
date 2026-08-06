import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { WordReview } from '../entities/word-review.entity';
import { Word } from '../entities/word.entity';
import { RecallStatus, WordStatus } from '../common/enums';
import { computeSm2, initialSm2State, PASS_THRESHOLD } from './sm2';
import { XpService } from '../xp/xp.service';
import { XpSource } from '../common/enums';
import { REDIS_CLIENT } from '../redis/redis.module';
import { dayKeyUB } from '../xp/gamification';

/**
 * XP for a flashcard review. Small on purpose — reviewing is meant to be a
 * light, frequent habit, not an XP farm.
 */
const REVIEW_XP_PASS = 10;
const REVIEW_XP_FAIL = 2; // trying still counts for something

/**
 * A word may only earn XP ONCE PER DAY, however many times it is swiped.
 *
 * `awardOnce(user, source, wordId)` would have been wrong here: SRS means
 * legitimately reviewing the same word many times over weeks, and that should
 * keep earning. Capping per-day keeps the habit rewarding while making the
 * "swipe one card back and forth" farm worthless.
 */
const REVIEW_XP_TTL_SECONDS = 26 * 60 * 60;

/** Safety cap so the daily due queue never returns a huge payload. */
const DUE_LIMIT = 100;

/** A word in the swipe deck, plus this user's saved/SRS state. */
export type LearnCard = Word & {
  saved: boolean;
  repetitions: number;
  dueAt: string | null;
  intervalDays: number;
};

export interface ReviewStats {
  /**
   * Backwards-compatible counter: words recalled at least once
   * (`young + mature` in the SRS buckets below).
   */
  known: number;
  /** Seen/reviewed but not yet recalled successfully. */
  learning: number;
  /** Saved/created in the learner's deck but never reviewed. */
  new: number;
  /** Recalled, but interval is still below the mastery threshold. */
  young: number;
  /** Recalled with a long enough interval to count as stable mastery. */
  mature: number;
  /** Cards currently due for review. */
  dueNow: number;
  /** Server-owned threshold for `mature`, in days. */
  masteryThresholdDays: number;
}

const MASTERY_THRESHOLD_DAYS = 21;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(WordReview)
    private readonly reviews: Repository<WordReview>,
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
    private readonly xp: XpService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
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
  ): Promise<WordReview & { xpEarned?: number }> {
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
        // The progress counters need explicit zeros for the same reason as the
        // SM-2 fields: `create()` does NOT apply `@Column({ default: 0 })`,
        // that only happens on a DB insert. Without these, the `+= 1` below
        // evaluated `undefined + 1` → NaN → Postgres rejected the insert, so
        // the FIRST-EVER review of any word failed with a 500.
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
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

    const saved = await this.reviews.save(review);

    // XP is awarded AFTER the schedule is safely persisted: a failure to award
    // must never cost the learner their review progress.
    const xpEarned = await this.awardReviewXp(userId, wordId, passed);
    return Object.assign(saved, { xpEarned });
  }

  /**
   * Grants review XP at most once per (user, word, day).
   *
   * Returns the XP actually granted so the client can show a truthful number —
   * the mobile app previously invented "+300 XP" locally because the API told
   * it nothing.
   */
  private async awardReviewXp(
    userId: string,
    wordId: string,
    passed: boolean,
  ): Promise<number> {
    const key = `reviewxp:${userId}:${wordId}:${dayKeyUB()}`;
    try {
      const claimed = await this.redis.set(key, '1', 'EX', REVIEW_XP_TTL_SECONDS, 'NX');
      if (claimed === null) return 0; // already earned for this word today
    } catch {
      // Redis down → skip the award rather than risk uncapped farming.
      return 0;
    }

    const amount = passed ? REVIEW_XP_PASS : REVIEW_XP_FAIL;
    await this.xp.award({
      userId,
      amount,
      source: XpSource.WORD_REVIEW,
      referenceId: wordId,
      metadata: { passed },
    });
    return amount;
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
  async getSaved(userId: string): Promise<LearnCard[]> {
    const rows = await this.reviews.find({
      where: { userId, saved: true },
      relations: { word: true },
      order: { lastSeenAt: 'DESC' },
    });
    return rows.map((r) => this.toLearnCard(r.word, r));
  }

  /**
   * Word stats for the swipe-learning UI.
   *
   * `known` stays for older clients. The real SRS buckets let the app show
   * mastery instead of treating one correct swipe as "learned".
   */
  async getStats(userId: string): Promise<ReviewStats> {
    const row = await this.reviews
      .createQueryBuilder('r')
      .select(
        `COUNT(*) FILTER (WHERE r.repetitions >= 1)::int`,
        'known',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE COALESCE(r.review_count, 0) = 0)::int`,
        'new',
      )
      .addSelect(
        `COUNT(*) FILTER (
          WHERE COALESCE(r.review_count, 0) > 0 AND r.repetitions = 0
        )::int`,
        'learning',
      )
      .addSelect(
        `COUNT(*) FILTER (
          WHERE r.repetitions >= 1 AND r.interval_days < :threshold
        )::int`,
        'young',
      )
      .addSelect(
        `COUNT(*) FILTER (
          WHERE r.repetitions >= 1 AND r.interval_days >= :threshold
        )::int`,
        'mature',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE r.next_review_at <= :now)::int`,
        'dueNow',
      )
      .where('r.user_id = :userId', { userId })
      .setParameters({ threshold: MASTERY_THRESHOLD_DAYS, now: new Date() })
      .getRawOne<{
        known: number | string;
        new: number | string;
        learning: number | string;
        young: number | string;
        mature: number | string;
        dueNow: number | string;
      }>();

    return {
      known: Number(row?.known ?? 0),
      new: Number(row?.new ?? 0),
      learning: Number(row?.learning ?? 0),
      young: Number(row?.young ?? 0),
      mature: Number(row?.mature ?? 0),
      dueNow: Number(row?.dueNow ?? 0),
      masteryThresholdDays: MASTERY_THRESHOLD_DAYS,
    };
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
    const reviewRows = await this.reviews.find({
      where: { userId, wordId: In(words.map((w) => w.id)) },
      select: {
        wordId: true,
        saved: true,
        repetitions: true,
        nextReviewAt: true,
        intervalDays: true,
      },
    });
    const byWord = new Map(reviewRows.map((r) => [r.wordId, r]));

    return words.map((w) => this.toLearnCard(w, byWord.get(w.id)));
  }

  private toLearnCard(
    word: Word,
    review?: Pick<WordReview, 'saved' | 'repetitions' | 'nextReviewAt' | 'intervalDays'>,
  ): LearnCard {
    return {
      ...word,
      saved: review?.saved ?? false,
      repetitions: review?.repetitions ?? 0,
      dueAt: review?.nextReviewAt?.toISOString() ?? null,
      intervalDays: review?.intervalDays ?? 0,
    };
  }
}
