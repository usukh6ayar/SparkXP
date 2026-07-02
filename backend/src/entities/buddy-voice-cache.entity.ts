import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * TTS cache for repeated AI Buddy phrases ("Great job!", "Can you say more?").
 * Keyed by (text hash + voice) so identical replies reuse one Cloudinary audio
 * file — cutting ElevenLabs cost and latency. See docx §6 "Audio cache".
 */
@Entity('buddy_voice_cache')
@Index('IDX_buddy_voice_cache_hash_voice', ['textHash', 'voiceId'], { unique: true })
export class BuddyVoiceCache extends BaseEntity {
  /** sha256 of the reply text. */
  @Column({ name: 'text_hash', type: 'varchar' })
  textHash: string;

  /** ElevenLabs voice id the audio was generated with. */
  @Column({ name: 'voice_id', type: 'varchar' })
  voiceId: string;

  @Column({ name: 'audio_url', type: 'varchar' })
  audioUrl: string;

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs: number;

  /** How many times this cached clip has been served. */
  @Column({ name: 'hit_count', type: 'int', default: 0 })
  hitCount: number;
}
