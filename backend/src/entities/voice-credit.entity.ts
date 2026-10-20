import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { AiUsageType } from '../common/enums';
import { User } from './user.entity';

/**
 * Append-only ledger of pay-as-you-go Buddy seconds (twin of SparksLog).
 *
 *   +seconds = a voice pack was paid for (`paymentId` set)
 *   -seconds = usage past the monthly plan limit was taken from the balance
 *
 * Balance per type = SUM(seconds).
 */
@Entity('voice_credits')
@Index('IDX_voice_credits_user_type', ['userId', 'type'])
export class VoiceCredit extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  type: AiUsageType.TTS | AiUsageType.STT;

  /** Positive = bought, negative = spent. */
  @Column({ type: 'int' })
  seconds: number;

  /** The pack purchase that added these seconds. Not a FK — ledger stays immutable. */
  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;
}
