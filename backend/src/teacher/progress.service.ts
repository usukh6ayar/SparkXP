import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { WordReview } from '../entities/word-review.entity';
import { AssignmentCompletion } from '../entities/assignment-completion.entity';
import { Assignment } from '../entities/assignment.entity';
import { User } from '../entities/user.entity';
import { SubmissionStatus } from '../common/enums';
import { ClassesService } from '../classes/classes.service';
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
    @InjectRepository(AssignmentCompletion)
    private readonly submissionRepo: Repository<AssignmentCompletion>,
    @InjectRepository(Assignment)
    private readonly assignmentRepo: Repository<Assignment>,
    private readonly classes: ClassesService,
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

  /**
   * One student's progress for the teacher panel: skill breakdown (+ vocab),
   * recent assignment submissions with scores/status, and activity counters.
   * getStudents enforces teacher/admin access (throws 403/404).
   */
  async studentProgress(classId: string, studentId: string, teacher: User) {
    const roster = await this.classes.getStudents(classId, teacher);
    const student = roster.find((s) => s.id === studentId);
    if (!student) {
      throw new NotFoundException('Сурагч энэ ангид алга');
    }
    const skills = averageBySkill(await this.studentSkillRows(studentId));
    const vocab = await this.vocabMastery(studentId);
    const submissions = await this.submissionRepo.find({
      where: { studentId },
      relations: ['assignment'],
      order: { submittedAt: 'DESC' },
      take: 50,
    });
    return {
      studentId,
      fullName: student.fullName,
      xp: student.xp,
      currentStreak: student.currentStreak,
      skills: { ...skills, vocab },
      assignments: submissions.map((s) => ({
        assignmentId: s.assignmentId,
        type: s.assignment?.type ?? null,
        status: s.status,
        scorePct: s.scorePct,
        submittedAt: s.submittedAt,
      })),
    };
  }

  /**
   * Class analytics for the teacher panel: class-wide skill breakdown, the
   * weakest scored skill, and each student's completion %. getStudents enforces
   * teacher/admin access (throws 403/404).
   */
  async classOverview(classId: string, teacher: User) {
    const roster = await this.classes.getStudents(classId, teacher);
    const studentIds = roster.map((s) => s.id);

    // Class skill breakdown = average over all students' attempts.
    const rows = studentIds.length
      ? ((await this.attempts.find({
          where: { userId: In(studentIds) },
          select: { skill: true, scorePct: true },
        })) as { skill: string; scorePct: number }[])
      : [];
    const skills = averageBySkill(rows);
    const scored = SKILL_DIMENSIONS.filter((s) => skills[s] !== null);
    const weakestSkill =
      scored.length === 0
        ? null
        : scored.reduce((a, b) => (skills[a]! <= skills[b]! ? a : b));

    // Per-student completion % across their pre-created submissions.
    const subs = studentIds.length
      ? await this.submissionRepo.find({ where: { studentId: In(studentIds) } })
      : [];
    const students = roster.map((s) => {
      const mine = subs.filter((x) => x.studentId === s.id);
      const done = mine.filter((x) => x.status !== SubmissionStatus.ASSIGNED).length;
      return {
        studentId: s.id,
        fullName: s.fullName,
        completionPct: mine.length ? Math.round((done / mine.length) * 100) : null,
      };
    });

    return { studentCount: roster.length, skills, weakestSkill, students };
  }

  /**
   * Teacher dashboard: totals across the teacher's own classes — distinct
   * students, students active in the last 7 days (any quiz attempt), and
   * pending / overdue submission counts.
   */
  async dashboard(teacher: User) {
    const { teaching } = await this.classes.findForUser(teacher);
    const classIds = teaching.map((c) => c.id);
    if (classIds.length === 0) {
      return { classCount: 0, studentCount: 0, activeStudents: 0, pending: 0, overdue: 0, classes: [] };
    }

    const students = await this.classes.getStudentsForClasses(classIds);
    const studentIds = [...new Set(students.map((s) => s.id))];
    const sevenDaysAgo = new Date(Date.now() - 7 * 864e5);
    const activeStudents = studentIds.length
      ? await this.attempts
          .createQueryBuilder('a')
          .select('COUNT(DISTINCT a.user_id)', 'n')
          .where('a.user_id IN (:...ids)', { ids: studentIds })
          .andWhere('a.created_at >= :since', { since: sevenDaysAgo })
          .getRawOne<{ n: string }>()
          .then((r) => Number(r?.n ?? 0))
      : 0;

    const assignmentIds = (
      await this.assignmentRepo.find({ where: { classId: In(classIds) }, select: { id: true } })
    ).map((a) => a.id);
    const subs = assignmentIds.length
      ? await this.submissionRepo.find({ where: { assignmentId: In(assignmentIds) } })
      : [];
    const pending = subs.filter((s) => s.status === SubmissionStatus.ASSIGNED).length;
    const overdue = subs.filter((s) => s.status === SubmissionStatus.LATE).length;

    return {
      classCount: teaching.length,
      studentCount: studentIds.length,
      activeStudents,
      pending,
      overdue,
      classes: teaching.map((c) => ({ id: c.id, name: c.name })),
    };
  }
}
