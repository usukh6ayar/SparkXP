import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Pay-as-you-go: extra AI Buddy minutes sold one-off on the website (Byl).
 * Used only after the monthly plan limit runs out, and they never expire.
 * Admin-editable like plans; `isActive = false` takes it off sale.
 */
@Entity('voice_packs')
export class VoicePack extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  /** Price in MNT (integer). */
  @Column({ name: 'price_amount', type: 'int' })
  priceAmount: number;

  /** Extra minutes of Spark speaking (TTS). */
  @Column({ name: 'voice_minutes', type: 'int', default: 0 })
  voiceMinutes: number;

  /** Extra minutes of the learner's speech recognised (STT). */
  @Column({ name: 'stt_minutes', type: 'int', default: 0 })
  sttMinutes: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
