import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { VisemeCue } from '../ai-gateway/providers/tts.adapter';

/**
 * TTS cache for repeated AI Buddy phrases ("Great job!", "Can you say more?").
 * Keyed by (text hash + voice) so identical replies reuse one Cloudinary audio
 * file — cutting Gemini TTS cost and latency. See docx §6 "Audio cache".
 */
@Entity('buddy_voice_cache')
@Index('IDX_buddy_voice_cache_hash_voice', ['textHash', 'voiceId'], { unique: true })
export class BuddyVoiceCache extends BaseEntity {
  /** sha256 of the reply text. */
  @Column({ name: 'text_hash', type: 'varchar' })
  textHash: string;

  /** TTS voice name the audio was generated with. */
  @Column({ name: 'voice_id', type: 'varchar' })
  voiceId: string;

  @Column({ name: 'audio_url', type: 'varchar' })
  audioUrl: string;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs: number;

  /**
   * Lip-sync timeline that belongs to this exact clip (Azure `VisemeReceived`).
   *
   * Cached alongside the audio because it is only obtainable while synthesizing:
   * a cache hit that returned the audio without its visemes would silently drop
   * the mouth back to text-guessed shapes for the most-repeated phrases.
   * `null` for providers that report no timing (Gemini).
   */
  @Column({ name: 'visemes', type: 'jsonb', nullable: true })
  visemes: VisemeCue[] | null;

  /** How many times this cached clip has been served. */
  @Column({ name: 'hit_count', type: 'int', default: 0 })
  hitCount: number;
}
