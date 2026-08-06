import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserLessonStar } from '../entities/user-lesson-star.entity';
import { LevelRequirement } from '../entities/level-requirement.entity';
import { Lesson } from '../entities/lesson.entity';
import { ContentLevel } from '../common/enums';

/** How many stars a lesson-test score earns. Tunable here (thresholds only). */
export function starsForScore(percentage: number): number {
  if (percentage >= 90) return 3;
  if (percentage >= 70) return 2;
  if (percentage >= 50) return 1;
  return 0;
}

/** Fallback star gate per level when `level_requirements` has no row. Cumulative
 *  total stars — `a1` is always open. Overridden by the DB (admin-tunable). */
const DEFAULT_REQUIRED: Record<string, number> = {
  a1: 0,
  a2: 3,
  b1: 9,
  b2: 18,
  c1: 30,
  c2: 45,
};

/** One island's gate on the Lessons map. */
export interface LevelUnlock {
  /** Stars the user has earned inside this level's lessons. */
  starsEarned: number;
  /** Total stars needed (across all levels) to open this island. */
  starsRequired: number;
  /** Whether the user has enough stars to enter. */
  unlocked: boolean;
}

/**
 * Lesson stars + the star-gated island/castle unlock system.
 *
 * Stars are the permanent record of how well a lesson's test went; the running
 * TOTAL is the key that opens later islands. Both live here so the "award on a
 * good score" and "is this castle open?" rules stay in one place.
 */
@Injectable()
export class StarsService {
  constructor(
    @InjectRepository(UserLessonStar)
    private readonly stars: Repository<UserLessonStar>,
    @InjectRepository(LevelRequirement)
    private readonly requirements: Repository<LevelRequirement>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
  ) {}

  /**
   * Record stars for a lesson from a test score, keeping the BEST ever.
   *
   * Idempotent and monotonic: a worse re-take never lowers the rating, and a
   * score of 0 stars is not written (nothing earned yet). Called from the quiz
   * submit flow for lesson-linked tests.
   */
  async awardFromScore(userId: string, lessonId: string, percentage: number): Promise<number> {
    const pct = Math.max(0, Math.min(100, Math.round(percentage)));
    const stars = starsForScore(pct);
    const existing = await this.stars.findOne({ where: { userId, lessonId } });

    if (!existing) {
      // Nothing earned yet and no row — don't create an empty 0-star record.
      if (stars <= 0) return 0;
      await this.stars.save(
        this.stars.create({ userId, lessonId, stars, bestScore: pct, completedAt: new Date() }),
      );
      return stars;
    }

    // Monotonic best-of: stars and bestScore only ever rise; completedAt is
    // stamped the first time the lesson is passed.
    let changed = false;
    if (stars > existing.stars) { existing.stars = stars; changed = true; }
    if (pct > existing.bestScore) { existing.bestScore = pct; changed = true; }
    if (stars > 0 && !existing.completedAt) { existing.completedAt = new Date(); changed = true; }
    if (changed) await this.stars.save(existing);
    return existing.stars;
  }

  /** Full per-lesson star rows for the current user (stars + best score + when
   *  first completed) — richer than `getStarsMap`. */
  async getLessonStarsDetailed(
    userId: string,
  ): Promise<{ lessonId: string; stars: number; bestScore: number; completedAt: string | null }[]> {
    const rows = await this.stars.find({
      where: { userId },
      select: { lessonId: true, stars: true, bestScore: true, completedAt: true },
    });
    return rows.map((r) => ({
      lessonId: r.lessonId,
      stars: r.stars,
      bestScore: r.bestScore,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }));
  }

  /**
   * Record a lesson result directly (a lesson + its test score) and return the
   * updated star row. Same monotonic best-of rules as the quiz-submit path — a
   * lesson without a linked quiz can report its result here.
   */
  async recordLessonResult(
    userId: string,
    lessonId: string,
    score: number,
  ): Promise<{ lessonId: string; stars: number; bestScore: number; completedAt: string | null }> {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Хичээл олдсонгүй');

    const pct = Math.max(0, Math.min(100, Math.round(score)));
    await this.awardFromScore(userId, lessonId, pct);

    const row = await this.stars.findOne({ where: { userId, lessonId } });
    return {
      lessonId,
      stars: row?.stars ?? 0,
      bestScore: row?.bestScore ?? pct,
      completedAt: row?.completedAt ? row.completedAt.toISOString() : null,
    };
  }

  /** All of a user's lesson stars → `{ [lessonId]: 0..3 }` (only earned rows). */
  async getStarsMap(userId: string): Promise<Record<string, number>> {
    const rows = await this.stars.find({
      where: { userId },
      select: { lessonId: true, stars: true },
    });
    const map: Record<string, number> = {};
    for (const r of rows) map[r.lessonId] = r.stars;
    return map;
  }

  /** Total stars a user has earned across every lesson. */
  async totalStars(userId: string): Promise<number> {
    const row = await this.stars
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.stars), 0)', 'sum')
      .where('s.user_id = :userId', { userId })
      .getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0);
  }

  /**
   * Per-CEFR-level unlock state for the Lessons map: stars earned in the level,
   * the star gate, and whether it is open. An island opens once the user's TOTAL
   * stars reach its requirement, so early islands fund the later ones.
   */
  async getLevelUnlocks(userId: string): Promise<Record<string, LevelUnlock>> {
    const [total, perLevelRows, reqRows] = await Promise.all([
      this.totalStars(userId),
      // Stars earned per level = sum over the user's lesson stars, grouped by the
      // lesson's CEFR level (top-level lessons only — the trail lists those).
      this.stars
        .createQueryBuilder('s')
        .innerJoin(Lesson, 'l', 'l.id = s.lesson_id')
        .select('l.level', 'level')
        .addSelect('COALESCE(SUM(s.stars), 0)', 'sum')
        .where('s.user_id = :userId', { userId })
        .andWhere('l.parent_lesson_id IS NULL')
        .groupBy('l.level')
        .getRawMany<{ level: string; sum: string }>(),
      this.requirements.find(),
    ]);

    const earned: Record<string, number> = {};
    for (const r of perLevelRows) earned[r.level] = Number(r.sum);

    const required: Record<string, number> = { ...DEFAULT_REQUIRED };
    for (const r of reqRows) required[r.levelCode] = r.starsRequired;

    const out: Record<string, LevelUnlock> = {};
    for (const code of Object.values(ContentLevel)) {
      const starsRequired = required[code] ?? 0;
      out[code] = {
        starsEarned: earned[code] ?? 0,
        starsRequired,
        unlocked: total >= starsRequired,
      };
    }
    return out;
  }
}
