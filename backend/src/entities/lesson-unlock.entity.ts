import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { LessonUnlockSource } from '../common/enums';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

/**
 * Record that a lesson is permanently open to a user. Unique per (user, lesson)
 * so it can never be granted twice.
 *
 * Originally this only meant "bought with Sparks". It is now the single record
 * of lesson access from every route — Sparks, one of the three free-tier
 * rights, or teacher-assigned homework — with `source` saying which. Keeping
 * one table means access is a single lookup instead of four.
 *
 * An active subscription is deliberately NOT recorded here: a plan opens every
 * lesson, and it expires, so writing rows for it would leave the user with
 * permanent access to whatever they happened to browse.
 */
@Entity('lesson_unlocks')
@Unique('uq_lesson_unlock_user_lesson', ['userId', 'lessonId'])
export class LessonUnlock extends BaseEntity {
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

  /**
   * Sparks paid at unlock time (snapshot — the lesson price may change later).
   * NULL for every non-Sparks source, where "how much was paid" has no answer.
   */
  @Column({ name: 'sparks_spent', type: 'int', nullable: true })
  sparksSpent: number | null;

  /** How this access was earned — see `LessonUnlockSource`. */
  @Column({
    type: 'enum',
    enum: LessonUnlockSource,
    default: LessonUnlockSource.SPARKS,
  })
  source: LessonUnlockSource;
}
