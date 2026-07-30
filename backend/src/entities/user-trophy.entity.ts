import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * One trophy earned by one user. `created_at` (from BaseEntity) is the moment it
 * was earned, so no separate column is needed.
 *
 * The unique constraint is load-bearing, not just hygiene: trophy checks run
 * fire-and-forget after every XP award, so two actions in the same second race
 * each other. `INSERT ... ON CONFLICT DO NOTHING` against this index is atomic,
 * whereas a read-modify-write on a jsonb array would silently drop a trophy.
 */
@Entity('user_trophies')
@Unique(['userId', 'slug'])
export class UserTrophy extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Catalog slug (e.g. `starter_first_quiz`). Also keys the R2 image paths. */
  @Column({ type: 'varchar' })
  slug: string;

  /** null = the unlock celebration has not been shown to the user yet. */
  @Column({ name: 'seen_at', type: 'timestamptz', nullable: true })
  seenAt: Date | null;
}
