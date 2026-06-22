import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { RecallStatus } from '../common/enums';
import { User } from './user.entity';
import { Word } from './word.entity';

/**
 * Spaced-repetition state for one (user, word) pair. Drives the review queue:
 * the app asks for words whose `nextReviewAt` is due.
 *
 * Fields follow a simple SM-2-style scheme — `easeFactor`, `intervalDays`, and
 * `repetitions` advance on each correct recall and reset on a lapse. The actual
 * algorithm lives in the service layer; this entity is just storage.
 */
@Entity('word_reviews')
@Unique('uq_word_review_user_word', ['userId', 'wordId'])
export class WordReview extends BaseEntity {
  @ManyToOne(() => User, (user) => user.wordReviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Word, (word) => word.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'word_id' })
  word: Word;

  @Column({ name: 'word_id', type: 'uuid' })
  wordId: string;

  /** SM-2 ease factor; starts at 2.5. */
  @Column({ name: 'ease_factor', type: 'float', default: 2.5 })
  easeFactor: number;

  /** Days until the next review after the last successful recall. */
  @Column({ name: 'interval_days', type: 'int', default: 0 })
  intervalDays: number;

  /** Consecutive successful recalls. */
  @Column({ type: 'int', default: 0 })
  repetitions: number;

  /** When this word is next due. Indexed because it's the review-queue filter. */
  @Index()
  @Column({ name: 'next_review_at', type: 'timestamptz', nullable: true })
  nextReviewAt: Date | null;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null;

  // ── Swipe / per-user progress (separate from SM-2 scheduling) ────────────

  /** ⭐ Whether the user saved (starred) this word. */
  @Column({ type: 'boolean', default: false })
  saved: boolean;

  /** Last swipe verdict: forgot / learning / know. Null until first swipe. */
  @Column({
    name: 'recall_status',
    type: 'enum',
    enum: RecallStatus,
    nullable: true,
  })
  recallStatus: RecallStatus | null;

  /** Total times the user has seen this card. */
  @Column({ name: 'review_count', type: 'int', default: 0 })
  reviewCount: number;

  /** Times swiped "Know". */
  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount: number;

  /** Times swiped "Forgot". Difficulty signal = wrong / (wrong + correct). */
  @Column({ name: 'wrong_count', type: 'int', default: 0 })
  wrongCount: number;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;
}
