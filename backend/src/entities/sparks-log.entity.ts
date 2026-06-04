import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { SparksSource } from '../common/enums';
import { User } from './user.entity';

/**
 * Append-only ledger of every Sparks change — the twin of XpLog, but Sparks
 * are spendable so `amount` can be negative.
 *
 *   +amount = earned (quiz, lesson, streak, admin grant)
 *   -amount = spent  (unlocking a lesson, store purchase)
 *
 * `User.sparks` is a denormalized cache of the running sum. Keeping a row per
 * change lets us audit anti-abuse and reconstruct a balance if needed.
 */
@Entity('sparks_logs')
export class SparksLog extends BaseEntity {
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Positive = earned, negative = spent. */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: SparksSource })
  source: SparksSource;

  /** Optional reference to what caused it (lesson id, quiz id, ...). Not a FK
   *  so the ledger stays immutable. */
  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
