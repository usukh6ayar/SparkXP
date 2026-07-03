import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { Lesson } from '../entities/lesson.entity';
import { XpSource, ContentLevel } from '../common/enums';
import {
  computeLevel,
  dayKeyUB,
  dayKeyUBOffset,
  startOfUBDay,
  type LevelInfo,
} from './gamification';

export interface AwardXpOptions {
  userId: string;
  amount: number;
  source: XpSource;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

/** Gamification summary returned to the app (Home / Profile). */
export interface GamificationSummary extends LevelInfo {
  xp: number;
  currentStreak: number;
  longestStreak: number;
  todayXp: number;
  dailyGoal: number;
  cefrLevel: string | null;
  lessonsDone: number;
  quizzesDone: number;
  /** Per-CEFR-level lesson progress for the Lessons map islands (a1…c2). */
  progressByLevel: Record<string, { done: number; total: number }>;
}

/** Default daily-XP goal (could become plan/admin-configurable later). */
const DAILY_GOAL = 50;

@Injectable()
export class XpService {
  constructor(
    @InjectRepository(XpLog)
    private readonly xpLogs: Repository<XpLog>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Award XP atomically: write an XpLog row, increment User.xp, and advance the
   * daily streak — all in one transaction. Anti-abuse: amount must be > 0.
   */
  async award(opts: AwardXpOptions): Promise<XpLog> {
    if (opts.amount <= 0) return null as unknown as XpLog;

    return this.dataSource.transaction(async (manager) => {
      const log = manager.create(XpLog, {
        userId: opts.userId,
        amount: opts.amount,
        source: opts.source,
        referenceId: opts.referenceId ?? null,
        metadata: opts.metadata ?? null,
      });
      await manager.save(log);

      // Increment the denormalized cache on User — safe inside the transaction.
      await manager.increment(User, { id: opts.userId }, 'xp', opts.amount);

      // Advance the streak (first activity of the day only).
      const user = await manager.findOne(User, {
        where: { id: opts.userId },
        select: { id: true, currentStreak: true, longestStreak: true, lastActiveDate: true },
      });
      if (user) {
        const today = dayKeyUB();
        if (user.lastActiveDate !== today) {
          const yesterday = dayKeyUBOffset(-1);
          const streak = user.lastActiveDate === yesterday ? (user.currentStreak ?? 0) + 1 : 1;
          const longest = Math.max(user.longestStreak ?? 0, streak);
          await manager.update(User, { id: opts.userId }, {
            currentStreak: streak,
            longestStreak: longest,
            lastActiveDate: today,
          });
        }
      }

      return log;
    });
  }

  /**
   * Award XP only if this (user, source, referenceId) hasn't been awarded
   * before — used for one-time events like completing a lesson. Returns the new
   * log, or null if it was already awarded.
   */
  async awardOnce(opts: AwardXpOptions): Promise<XpLog | null> {
    if (opts.referenceId) {
      const existing = await this.xpLogs.findOne({
        where: { userId: opts.userId, source: opts.source, referenceId: opts.referenceId },
        select: { id: true },
      });
      if (existing) return null;
    }
    return this.award(opts);
  }

  /** Streak + level + today's XP for the gamification UI. */
  async getGamification(userId: string): Promise<GamificationSummary> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: {
        xp: true,
        currentStreak: true,
        longestStreak: true,
        lastActiveDate: true,
        level: true,
      },
    });
    const xp = user?.xp ?? 0;

    // A streak only counts if the last active day is today or yesterday.
    const today = dayKeyUB();
    const yesterday = dayKeyUBOffset(-1);
    const alive = user?.lastActiveDate === today || user?.lastActiveDate === yesterday;
    const currentStreak = alive ? (user?.currentStreak ?? 0) : 0;

    const [todayRow, lessonRow, quizzesDone, levelTotals, levelDone] = await Promise.all([
      this.xpLogs
        .createQueryBuilder('x')
        .select('COALESCE(SUM(x.amount), 0)', 'sum')
        .where('x.user_id = :userId', { userId })
        .andWhere({ createdAt: MoreThanOrEqual(startOfUBDay()) })
        .getRawOne<{ sum: string }>(),
      // Distinct lessons completed (lesson XP is logged once per lesson).
      this.xpLogs
        .createQueryBuilder('x')
        .select('COUNT(DISTINCT x.reference_id)', 'n')
        .where('x.user_id = :userId', { userId })
        .andWhere('x.source = :src', { src: XpSource.LESSON })
        .andWhere('x.reference_id IS NOT NULL')
        .getRawOne<{ n: string }>(),
      this.xpLogs.count({ where: { userId, source: XpSource.QUIZ } }),
      // Published lessons per CEFR level → island "total".
      this.lessons
        .createQueryBuilder('l')
        .select('l.level', 'level')
        .addSelect('COUNT(*)', 'n')
        .where('l.is_published = true')
        .groupBy('l.level')
        .getRawMany<{ level: string; n: string }>(),
      // Distinct lessons this user finished per CEFR level → island "done".
      this.xpLogs
        .createQueryBuilder('x')
        .innerJoin(Lesson, 'l', 'l.id = x.reference_id')
        .select('l.level', 'level')
        .addSelect('COUNT(DISTINCT x.reference_id)', 'n')
        .where('x.user_id = :userId', { userId })
        .andWhere('x.source = :src', { src: XpSource.LESSON })
        .groupBy('l.level')
        .getRawMany<{ level: string; n: string }>(),
    ]);

    // Seed every CEFR level to 0/0, then fill in the grouped counts.
    const progressByLevel: Record<string, { done: number; total: number }> = {};
    for (const lvl of Object.values(ContentLevel)) progressByLevel[lvl] = { done: 0, total: 0 };
    for (const r of levelTotals) if (progressByLevel[r.level]) progressByLevel[r.level].total = Number(r.n);
    for (const r of levelDone) if (progressByLevel[r.level]) progressByLevel[r.level].done = Number(r.n);

    return {
      xp,
      ...computeLevel(xp),
      currentStreak,
      longestStreak: user?.longestStreak ?? 0,
      todayXp: Number(todayRow?.sum ?? 0),
      dailyGoal: DAILY_GOAL,
      cefrLevel: user?.level ?? null,
      lessonsDone: Number(lessonRow?.n ?? 0),
      quizzesDone,
      progressByLevel,
    };
  }
}
