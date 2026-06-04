import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { LessonType, ContentLevel } from '../common/enums';
import { Organization } from './organization.entity';
import { Word } from './word.entity';
import { Quiz } from './quiz.entity';

/**
 * A unit of learning content. ALL lesson content lives in the DB (never
 * hardcoded) so non-developers can author it from the admin panel.
 *
 * The flexible body lives in the `content` jsonb column — its shape varies by
 * `type` (slides, audio refs, grammar notes, etc.), so we keep it schemaless
 * here and validate per-type in the service layer.
 */
@Entity('lessons')
export class Lesson extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: LessonType })
  type: LessonType;

  @Column({ type: 'enum', enum: ContentLevel, default: ContentLevel.A1 })
  level: ContentLevel;

  /** Flexible per-type body (CLAUDE.md: use jsonb for lesson.content). */
  @Column({ type: 'jsonb', default: {} })
  content: Record<string, unknown>;

  /** Display order within a level/track. */
  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  /**
   * Price in Sparks to unlock this lesson. 0 = free. Spending Sparks creates a
   * SparksLog entry and a LessonUnlock record (see those entities).
   */
  @Column({ name: 'price_sparks', type: 'int', default: 0 })
  priceSparks: number;

  /** Null = global content available to everyone; set = org-specific track. */
  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @OneToMany(() => Word, (word) => word.lesson)
  words: Word[];

  @OneToMany(() => Quiz, (quiz) => quiz.lesson)
  quizzes: Quiz[];
}
