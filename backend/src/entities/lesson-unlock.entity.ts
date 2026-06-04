import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

/**
 * Record that a user has unlocked (bought with Sparks) a lesson. Once unlocked,
 * access is permanent — this row is the proof. Unique per (user, lesson) so a
 * lesson can't be bought twice.
 *
 * Created together with a negative SparksLog entry inside one transaction when
 * the purchase happens.
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

  /** Sparks paid at unlock time (snapshot — lesson price may change later). */
  @Column({ name: 'sparks_spent', type: 'int' })
  sparksSpent: number;
}
