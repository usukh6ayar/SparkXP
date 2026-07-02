import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { BuddySessionMode } from '../common/enums';
import { User } from './user.entity';

/**
 * One AI Buddy conversation session. Turns (messages) reference this session so
 * we can replay context, show history, and scope usage/analytics per session.
 * Ends when `endedAt` is set (or is simply abandoned).
 */
@Entity('buddy_sessions')
export class BuddySession extends BaseEntity {
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Which buddy persona the user is talking to (AiBuddy.slug). */
  @Column({ name: 'buddy_slug', type: 'varchar' })
  buddySlug: string;

  /** Optional conversation topic chosen at start. */
  @Column({ type: 'varchar', nullable: true })
  topic: string | null;

  @Column({ type: 'enum', enum: BuddySessionMode, default: BuddySessionMode.VOICE })
  mode: BuddySessionMode;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;
}
