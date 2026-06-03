import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ContentLevel } from '../common/enums';
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

  @Column()
  mongolian: string;

  /** e.g. noun, verb, adjective. Free text for MVP. */
  @Column({ name: 'part_of_speech', type: 'varchar', nullable: true })
  partOfSpeech: string | null;

  @Column({ name: 'example_sentence', type: 'text', nullable: true })
  exampleSentence: string | null;

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
