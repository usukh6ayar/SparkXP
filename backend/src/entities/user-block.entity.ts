import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * The blocker no longer sees the blocked user (leaderboards, Home preview) —
 * App Store guideline 1.2. One row per pair; unblocking deletes it.
 */
@Entity('user_blocks')
@Unique('UQ_user_blocks_pair', ['blockerId', 'blockedId'])
export class UserBlock extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_id' })
  blocker: User;

  @Column({ name: 'blocker_id', type: 'uuid' })
  blockerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_id' })
  blocked: User;

  @Column({ name: 'blocked_id', type: 'uuid' })
  blockedId: string;
}
