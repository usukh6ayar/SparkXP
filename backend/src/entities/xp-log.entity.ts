import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { XpSource } from '../common/enums';
import { User } from './user.entity';

/**
 * Append-only ledger of every XP award. This is the source of truth for
 * lifetime XP (User.xp is a denormalized cache of the sum).
 *
 * Keeping a per-award row lets us audit anti-abuse rules (XP must come from
 * real, correct interaction) and reconstruct a user's balance if needed.
 */
@Entity('xp_logs')
export class XpLog extends BaseEntity {
  @Index()
  @ManyToOne(() => User, (user) => user.xpLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** XP granted by this event (positive). */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: XpSource })
  source: XpSource;

  /**
   * Optional reference to the thing that earned the XP (quiz id, word id, ...).
   * Polymorphic per `source`; not a FK so the ledger stays immutable.
   */
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  /** Optional context for audits (e.g. score, streak length). */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
