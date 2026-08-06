import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { BuddyBackground } from './buddy-background.entity';

/**
 * A background a user owns (bought). `equipped` marks the one currently shown
 * behind their buddy — at most one per user (enforced in the service, which
 * clears the others on equip). Unique per (user, background) so a background
 * can't be bought twice.
 */
@Entity('user_buddy_backgrounds')
@Unique('uq_user_buddy_background', ['userId', 'backgroundId'])
export class UserBuddyBackground extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => BuddyBackground, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'background_id' })
  background: BuddyBackground;

  @Column({ name: 'background_id', type: 'uuid' })
  backgroundId: string;

  @Column({ type: 'boolean', default: false })
  equipped: boolean;
}
