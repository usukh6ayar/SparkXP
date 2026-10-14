import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/** Why a user was reported (what the reporter saw on the leaderboard). */
export const REPORT_REASONS = ['photo', 'name', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * One user reporting another's profile photo or name — App Store guideline 1.2
 * (user-generated content must be reportable). Admins work the open ones from
 * the «Гомдол» page and resolve them (dismiss / remove photo / reset name).
 */
@Entity('user_reports')
@Index('IDX_user_reports_status', ['status'])
export class UserReport extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reported_id' })
  reported: User;

  @Column({ name: 'reported_id', type: 'uuid' })
  reportedId: string;

  @Column({ type: 'varchar' })
  reason: ReportReason;

  /** `open` until an admin acts on it. */
  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'resolved';

  /** What the admin did: dismiss | remove_avatar | reset_name. */
  @Column({ type: 'varchar', nullable: true })
  action: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
