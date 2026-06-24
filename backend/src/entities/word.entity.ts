import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ContentLevel, WordStatus } from '../common/enums';
import { Lesson } from './lesson.entity';
import { WordReview } from './word-review.entity';

/**
 * A vocabulary item. Bilingual by design (CLAUDE.md): Mongolian primary,
 * English secondary. Audio/image are CDN URLs, not blobs.
 */
@Entity('words')
export class Word extends BaseEntity {
  @Column()
  english: string;

  /** Mongolian meaning, e.g. "Орхих, хаях". */
  @Column()
  mongolian: string;

  /** English dictionary definition, e.g. "to leave someone or something behind". */
  @Column({ name: 'english_definition', type: 'text', nullable: true })
  englishDefinition: string | null;

  /** IPA-style pronunciation, e.g. /əˈbændən/. */
  @Column({ type: 'varchar', nullable: true })
  phonetic: string | null;

  /**
   * Open-ended topical category (Daily Life, Business, Law…). Free text — see
   * VOCAB_CATEGORY_SUGGESTIONS. Not an enum so new categories need no migration.
   */
  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  /**
   * URL-safe key derived from `english` (lowercase, spaces → `_`). Used to
   * auto-match bulk-uploaded media files (e.g. `abandon.mp3` → this word).
   * Indexed but NOT unique — homonyms can share a slug.
   */
  @Index()
  @Column({ type: 'varchar', nullable: true })
  slug: string | null;

  /**
   * Review lifecycle. Defaults to `published` so existing content (and any word
   * created without an explicit status) stays visible to students. Bulk imports
   * set `needs_review` explicitly.
   */
  @Column({ type: 'enum', enum: WordStatus, default: WordStatus.PUBLISHED })
  status: WordStatus;

  /** e.g. noun, verb, adjective. Free text for MVP. */
  @Column({ name: 'part_of_speech', type: 'varchar', nullable: true })
  partOfSpeech: string | null;

  @Column({ name: 'example_sentence', type: 'text', nullable: true })
  exampleSentence: string | null;

  /** Mongolian translation of exampleSentence. */
  @Column({ name: 'example_translation', type: 'text', nullable: true })
  exampleTranslation: string | null;

  /** Comma-separated synonyms, e.g. "happy, glad, joyful". */
  @Column({ type: 'text', nullable: true })
  synonyms: string | null;

  /** Comma-separated antonyms, e.g. "sad, unhappy". */
  @Column({ type: 'text', nullable: true })
  antonyms: string | null;

  /** CDN URL for pronunciation audio. */
  @Column({ name: 'audio_url', type: 'varchar', nullable: true })
  audioUrl: string | null;

  /** CDN URL for an illustrative image. */
  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'enum', enum: ContentLevel, default: ContentLevel.A1 })
  level: ContentLevel;

  /** Optional owning lesson; a word can also exist standalone in the bank. */
  @ManyToOne(() => Lesson, (lesson) => lesson.words, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson | null;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;

  @OneToMany(() => WordReview, (review) => review.word)
  reviews: WordReview[];
}
