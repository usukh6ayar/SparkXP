import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * Subscription plan sold to individual users (Standard / Plus / Premier).
 * Amount is stored in MNT minor units (tögrög — no decimal in MNT).
 * Admins can create/update plans from the dashboard without a code deploy.
 */
@Entity('plans')
export class Plan extends BaseEntity {
  /** Human-readable name shown to users. */
  @Column()
  name: string;

  /** URL-safe identifier, e.g. "standard", "plus", "premier". */
  @Column({ unique: true })
  slug: string;

  /** Price in MNT (integer). */
  @Column({ name: 'price_amount', type: 'int' })
  priceAmount: number;

  /** How many days of access this plan grants. */
  @Column({ name: 'duration_days', type: 'int', default: 30 })
  durationDays: number;

  /** Feature list / marketing copy stored as jsonb. */
  @Column({ type: 'jsonb', nullable: true })
  features: string[] | null;

  /** False = hidden from new purchases (keep for historical records). */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // --- Monthly usage limits (null = unlimited) ---

  /** AI TTS voice output minutes allowed per month. */
  @Column({ name: 'voice_minutes_limit', type: 'int', nullable: true })
  voiceMinutesLimit: number | null;

  /** User speech-to-text (STT) minutes allowed per month. */
  @Column({ name: 'stt_minutes_limit', type: 'int', nullable: true })
  sttMinutesLimit: number | null;

  /** Gemini AI dictionary explanations allowed per month. */
  @Column({ name: 'dictionary_ai_limit', type: 'int', nullable: true })
  dictionaryAiLimit: number | null;

  /** AI text chat token budget per month (in thousands). */
  @Column({ name: 'ai_text_tokens_limit', type: 'int', nullable: true })
  aiTextTokensLimit: number | null;

  /** AI buddy memory storage cap per user (MB). */
  @Column({ name: 'memory_mb_limit', type: 'int', nullable: true })
  memoryMbLimit: number | null;

  // --- Hearts (quiz lives) ---
  // Tunable per plan from admin so the economy can change without an app
  // update (CLAUDE.md core rule). null = fall back to the free-tier default.

  /** Premium perk: never run out of hearts. */
  @Column({ name: 'unlimited_hearts', type: 'boolean', default: false })
  unlimitedHearts: boolean;

  /** Hearts a user tops out at (null → default 5). */
  @Column({ name: 'max_hearts', type: 'int', nullable: true })
  maxHearts: number | null;

  /** Minutes to regenerate ONE heart (null → default 240 = 4h, Duolingo-like). */
  @Column({ name: 'heart_regen_minutes', type: 'int', nullable: true })
  heartRegenMinutes: number | null;

  /** Sparks cost to refill hearts to full (null → default 50). */
  @Column({ name: 'heart_refill_sparks', type: 'int', nullable: true })
  heartRefillSparks: number | null;

  @OneToMany(() => User, (user) => user.plan)
  subscribers: User[];
}
