import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { WordReview } from '../entities/word-review.entity';
import { resolveSkill } from './skill';

// ── Pure aggregation helpers (module-level, testable without DI) ──────────────

export const SKILL_DIMENSIONS = ['listening', 'reading', 'writing', 'fill'] as const;
export type SkillBreakdown = Record<(typeof SKILL_DIMENSIONS)[number], number | null>;

/** Average score_pct per mapped skill; unseen dimensions → null; 'other' dropped. */
export function averageBySkill(
  rows: { skill: string; scorePct: number }[],
): SkillBreakdown {
  const sums: Record<string, { total: number; n: number }> = {};
  for (const r of rows) {
    if (!(SKILL_DIMENSIONS as readonly string[]).includes(r.skill)) continue;
    (sums[r.skill] ??= { total: 0, n: 0 }).total += r.scorePct;
    sums[r.skill].n += 1;
  }
  const out = {} as SkillBreakdown;
  for (const s of SKILL_DIMENSIONS) {
    out[s] = sums[s] ? Math.round(sums[s].total / sums[s].n) : null;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    @InjectRepository(WordReview)
    private readonly reviews: Repository<WordReview>,
  ) {}

  /**
   * Persist one graded quiz submission. Called from POST /quizzes/:id/submit.
   * Resolves the skill from the quiz category, falling back to the parent
   * lesson's type only when the category is not itself a skill key.
   */
  async recordAttempt(params: {
    userId: string;
    quiz: Quiz;
    correctCount: number;
    totalCount: number;
    scorePct: number;
    assignmentId?: string | null;
  }): Promise<QuizAttempt> {
    let lessonType = null as Lesson['type'] | null;
    // Only pay for the lookup when the category can't answer it on its own.
    if (params.quiz.lessonId) {
      const lesson = await this.lessons.findOne({
        where: { id: params.quiz.lessonId },
        select: { id: true, type: true },
      });
      lessonType = lesson?.type ?? null;
    }
    const skill = resolveSkill(params.quiz.category, lessonType);
    const attempt = this.attempts.create({
      userId: params.userId,
      quizId: params.quiz.id,
      skill,
      correctCount: params.correctCount,
      totalCount: params.totalCount,
      scorePct: params.scorePct,
      assignmentId: params.assignmentId ?? null,
    });
    return this.attempts.save(attempt);
  }

  /** Vocab dimension: % of the student's reviewed words that are "mature". */
  async vocabMastery(userId: string): Promise<number | null> {
    const total = await this.reviews.count({ where: { userId } });
    if (total === 0) return null;
    const mature = await this.reviews.count({
      where: { userId, intervalDays: MoreThanOrEqual(21) },
    });
    return Math.round((mature / total) * 100);
  }

  /** Raw skill rows for a user, for averageBySkill(). */
  studentSkillRows(userId: string): Promise<{ skill: string; scorePct: number }[]> {
    return this.attempts.find({
      where: { userId },
      select: { skill: true, scorePct: true },
    }) as Promise<{ skill: string; scorePct: number }[]>;
  }
}
