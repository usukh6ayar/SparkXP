import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ContentLevel } from '../common/enums';
import { Lesson } from './lesson.entity';

/**
 * A quiz attached (optionally) to a lesson. The question set lives in the
 * `questions` jsonb column (CLAUDE.md) so admins can author varied question
 * types — multiple choice, fill-in-the-blank, matching — without a schema
 * migration. Shape is validated per question type in the service layer.
 */
@Entity('quizzes')
export class Quiz extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ContentLevel, default: ContentLevel.A1 })
  level: ContentLevel;

  /** Flexible question array (CLAUDE.md: use jsonb for quiz.questions). */
  @Column({ type: 'jsonb', default: [] })
  questions: unknown[];

  /**
   * Quiz category displayed on the mobile home screen.
   * 'multiple_choice' | 'fill_blank' | 'word_match'
   */
  @Column({ name: 'quiz_type', type: 'varchar', nullable: true, default: 'multiple_choice' })
  quizType: string | null;

  /**
   * Topic category for grouping a lesson's quizzes on the lesson screen
   * (e.g. "Дүрэм", "Үг", "Сонсгол"). Admin-set, free text.
   * For a standalone exercise (Дасгал) this holds the SKILL
   * (listening/reading/writing/speaking).
   */
  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  /**
   * Sub-category (сэдэв) within a skill — e.g. a listening exercise's
   * "Өдөр тутмын яриа". Free text: the stored value IS the label, so admin and
   * mobile show the same string (mobile groups the skill's exercises by it).
   */
  @Column({ type: 'varchar', nullable: true })
  topic: string | null;

  /** XP awarded for a passing attempt. */
  @Column({ name: 'xp_reward', type: 'int', default: 0 })
  xpReward: number;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished: boolean;

  @ManyToOne(() => Lesson, (lesson) => lesson.quizzes, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson | null;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;
}
