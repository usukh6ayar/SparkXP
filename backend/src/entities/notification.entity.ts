import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * One entry in a user's notification centre.
 *
 * Two shapes share this table:
 * - **Broadcast** (`userId` NULL) — an admin announcement, optionally narrowed
 *   to one role via `targetRole`. This is the original behaviour.
 * - **Personal** (`userId` set) — addressed at one user, e.g. "your teacher
 *   assigned homework". One row per recipient.
 *
 * `data` carries the deep link so tapping the row lands on the right screen
 * (`{ type: 'assignment', url: '/assignments' }`). Kept as jsonb because each
 * notification type needs different keys.
 */
@Entity('notifications')
export class Notification extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** NULL = broadcast to everyone (subject to `targetRole`). */
  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Index('idx_notifications_user_id')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'target_role', type: 'varchar', nullable: true })
  targetRole: string | null;

  /** Deep-link payload the app uses to route the tap. */
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount: number;
}
