import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { WordSense } from '../dictionary/senses';

/**
 * The Толь (dictionary) search cache: one row per English word the students
 * have ever searched, holding up to 4 frequency-ordered senses.
 *
 * Deliberately separate from `translations`, which mixes three unrelated things
 * (short glosses, whole-sentence translations keyed by the sentence text, and
 * audio-only stubs with an empty translation). Keeping this table clean is what
 * lets the admin "Толь" page be an unfiltered SELECT.
 *
 * Also separate from the curated `words` bank: nothing a student searches ever
 * lands in the authored vocabulary again.
 */
@Entity('dictionary_entries')
export class DictionaryEntry extends BaseEntity {
  /** Normalised (lowercase, trimmed, single-spaced) English word — cache key. */
  @Index({ unique: true })
  @Column()
  word: string;

  /** 1–4 senses, ordered most-common first. See WordSense. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  senses: WordSense[];

  /** How many times this word has been searched — incremented on cache hits too. */
  @Column({ name: 'search_count', type: 'int', default: 0 })
  searchCount: number;

  @Column({ name: 'last_searched_at', type: 'timestamptz', nullable: true })
  lastSearchedAt: Date | null;

  /** Which model produced the senses, e.g. 'gemini-2.5-flash'. */
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  /** True once an admin has hand-edited the senses. */
  @Column({ type: 'boolean', default: false })
  edited: boolean;
}
