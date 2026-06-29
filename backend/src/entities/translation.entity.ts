import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * Cache of AI-generated word explanations (the dictionary "double-tap → meaning"
 * lookups). Distinct from the curated `Word` bank: this stores raw Gemini
 * translations so any given word is only ever sent to the AI once. The lookup
 * order is Word DB → this cache → Gemini (then saved here).
 */
@Entity('translations')
export class Translation extends BaseEntity {
  /** Normalised (lowercase, trimmed) English word — the unique cache key. */
  @Index({ unique: true })
  @Column()
  word: string;

  /** Short Mongolian meaning (a few words) — shown in the tap popover. */
  @Column({ type: 'text' })
  translation: string;

  /** Pronunciation audio (ElevenLabs → Cloudinary), generated lazily on the
   *  first speaker tap and reused forever after. */
  @Column({ name: 'audio_url', type: 'varchar', nullable: true })
  audioUrl: string | null;

  /** Which model produced the translation, e.g. 'gemini-2.5-flash'. */
  @Column({ type: 'varchar', nullable: true })
  source: string | null;
}
