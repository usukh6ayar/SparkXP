import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { Quiz } from './quiz.entity';

/**
 * One graded quiz submission. The source of truth for skill breakdowns —
 * written on every POST /quizzes/:id/submit (assigned or self-directed).
 * `skill` is the NORMALIZED dimension (see teacher/skill.ts), not the raw
 * free-text quiz category.
 */
@Entity('quiz_attempts')
@Index(['userId', 'skill'])
@Index(['userId', 'createdAt'])
@Index(['assignmentId'])
export class QuizAttempt extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  /** Normalized skill: listening | reading | writing | fill | other. */
  @Column({ type: 'varchar' })
  skill: string;

  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount: number;

  @Column({ name: 'total_count', type: 'int', default: 0 })
  totalCount: number;

  /** 0-100, stored for cheap aggregation. */
  @Column({ name: 'score_pct', type: 'int', default: 0 })
  scorePct: number;

  /** Set when this attempt fulfils an assignment. */
  @Column({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignmentId: string | null;
}
