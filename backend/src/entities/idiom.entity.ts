import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * An English idiom / phrase (e.g. "break the ice") with its Mongolian meaning,
 * authored from the admin panel (Idioms section). Structurally similar to Word
 * but phrase-centric. No CEFR level / category for MVP. Publish gating mirrors
 * Word/Reading: students only ever see published idioms.
 */
@Entity('idioms')
export class Idiom extends BaseEntity {
  /** The English idiom phrase, e.g. "break the ice". */
  @Column()
  phrase: string;

  /** Mongolian rendering of the idiom. */
  @Column()
  mongolian: string;

  /** The real (figurative) meaning, in Mongolian — "Жинхэнэ утга". */
  @Column({ type: 'text', nullable: true })
  meaning: string | null;

  /** Explanation / usage note — "Тайлбар". */
  @Column({ type: 'text', nullable: true })
  definition: string | null;

  /** A natural English example sentence using the idiom. */
  @Column({ name: 'example_sentence', type: 'text', nullable: true })
  exampleSentence: string | null;

  /** Mongolian translation of the example sentence. */
  @Column({ name: 'example_translation', type: 'text', nullable: true })
  exampleTranslation: string | null;

  /** CDN URL for an illustrative image (uploaded via POST /api/upload). */
  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  /** Pronunciation audio (ElevenLabs → Cloudinary), generated once. */
  @Column({ name: 'audio_url', type: 'varchar', nullable: true })
  audioUrl: string | null;

  @Index()
  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;
}
