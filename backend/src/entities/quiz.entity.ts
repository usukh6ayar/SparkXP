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
