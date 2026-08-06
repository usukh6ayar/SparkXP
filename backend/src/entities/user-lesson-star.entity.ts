import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

/**
 * A user's earned stars (0–3) on one lesson.
 *
 * Stars come from the lesson's test score and are the currency that unlocks the
 * next island/castle (see `StarsService`). Kept as the running BEST for that
 * lesson — a re-take can raise the rating but never lower it — so the value is
 * permanent progress, not a snapshot of the last attempt.
 *
 * Unique per (user, lesson): one star rating per lesson.
 */
@Entity('user_lesson_stars')
@Unique('uq_user_lesson_star', ['userId', 'lessonId'])
export class UserLessonStar extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  /** 0–3. The best rating the user has achieved on this lesson's test. */
  @Column({ type: 'smallint', default: 0 })
  stars: number;

  /** Best test score (%) ever achieved on this lesson — what the stars derive
   *  from. Kept alongside `stars` so the UI can show the exact percentage. */
  @Column({ name: 'best_score', type: 'int', default: 0 })
  bestScore: number;

  /** When the lesson was first completed (first ≥1-star result). Null until the
   *  learner passes it once. */
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
