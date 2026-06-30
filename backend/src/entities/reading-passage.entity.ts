import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ContentLevel } from '../common/enums';

/**
 * One sentence of a reading passage. Phase 1 stores `text` only; `audioUrl` and
 * the optional `startMs`/`endMs` timings are filled later for Shadow Reading
 * Mode (Phase 3). Kept in a jsonb array on the passage (no separate table) —
 * sentences are always read/written together with their passage.
 */
export interface ReadingSentence {
  index: number;
  text: string;
  audioUrl: string | null;
  startMs?: number;
  endMs?: number;
}

/**
 * A key vocabulary item for a passage. Phase 1 stores the bare `word`; Phase 2
 * (Guess Before Translate) grows it with AI-generated guess choices that an
 * admin reviews before publishing.
 */
export interface ReadingKeyVocab {
  word: string;
  correctMeaning?: string;
  /** Exactly 3 options shown to the learner (1 correct + 2 plausible decoys). */
  choices?: string[];
  /** Index into `choices` of the correct option. */
  correctIndex?: number;
  /** True once an admin has reviewed the AI-generated choices. */
  reviewed?: boolean;
}

/**
 * A reading passage authored from the admin panel (Reading feature, M7).
 *
 * Metadata (`cefr`, `wordCount`, `estimatedReadingTime`, `keyVocab`) lives in
 * real columns — not buried in jsonb — so the later difficulty estimator /
 * recommendation engine can query and filter on them (same reasoning as why
 * `Word` got `status`/`category` columns, see VOCABULARY_SYSTEM.md).
 *
 * Publish gating mirrors `Lesson.isPublished`: students only ever see published
 * passages; the admin authors them as drafts first.
 */
@Entity('reading_passages')
export class ReadingPassage extends BaseEntity {
  @Column()
  title: string;

  @Index()
  @Column({ type: 'enum', enum: ContentLevel, default: ContentLevel.A1 })
  cefr: ContentLevel;

  /**
   * Topic/category (сэдэв) — free text, suggestions in
   * READING_CATEGORY_SUGGESTIONS. The stored value is the display label so the
   * mobile reading screen can group/tab on it directly. Nullable = "no topic".
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  /** Total word count, computed server-side from the sentence text on save. */
  @Column({ name: 'word_count', type: 'int', default: 0 })
  wordCount: number;

  /** Estimated reading time in seconds (≈ wordCount / 200 wpm), editable. */
  @Column({ name: 'estimated_reading_time', type: 'int', default: 0 })
  estimatedReadingTime: number;

  /** Cover image CDN URL (uploaded via POST /api/upload). */
  @Column({ name: 'cover_image_url', type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  /** Key vocabulary, with optional AI guess-choices (Phase 2). */
  @Column({ name: 'key_vocab', type: 'jsonb', default: [] })
  keyVocab: ReadingKeyVocab[];

  /** The passage split into sentences (+ per-sentence audio in Phase 3). */
  @Column({ type: 'jsonb', default: [] })
  sentences: ReadingSentence[];

  @Index()
  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;
}
