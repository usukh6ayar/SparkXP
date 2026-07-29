import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { Lesson } from '../entities/lesson.entity';
import { Plan } from '../entities/plan.entity';
import { SparksService } from '../sparks/sparks.service';
import { XpSource, ContentLevel, SparksSource } from '../common/enums';
import {
  computeLevel,
  dayKeyUB,
  dayKeyUBOffset,
  startOfUBDay,
  type LevelInfo,
  resolveStreak,
  MAX_HELD_FREEZES,
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
  /** Unused streak freezes the learner owns. */
  streakFreezes: number;
  /**
   * Sparks price of one freeze, resolved from the user's plan.
   * Sent so the app never hard-codes a price that admin can change — the same
   * reason `HeartsState` carries `refillCost`.
   */
  streakFreezeCost: number;
  /** Most freezes that may be held at once. */
  maxStreakFreezes: number;
  todayXp: number;
  dailyGoal: number;
  cefrLevel: string | null;
  lessonsDone: number;
  quizzesDone: number;
  /** Per-CEFR-level lesson progress for the Lessons map islands (a1…c2). */
  progressByLevel: Record<string, { done: number; total: number }>;
}

/** Fallback daily-XP goal for rows predating the per-user column. */
const DAILY_GOAL = 50;

/** The goals the app offers (Хөнгөн / Дунд / Ширүүн). */
export const DAILY_GOAL_CHOICES = [20, 50, 100] as const;

/** Free-tier Sparks price of one streak freeze (plans may override). */
const STREAK_FREEZE_SPARKS = 100;

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
    private readonly sparks: SparksService,
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

      // Advance the streak — but only once the DAILY GOAL is met, not on the
      // first XP of the day.
      //
      // Previously a single correct answer (1 XP) advanced the streak, which
      // made the number meaningless: "I opened the app" rather than "I did my
      // practice". Duolingo ties the streak to the goal for the same reason.
      const user = await manager.findOne(User, {
        where: { id: opts.userId },
        select: {
          id: true,
          currentStreak: true,
          longestStreak: true,
          lastActiveDate: true,
          streakFreezes: true,
          dailyGoalXp: true,
        },
      });
      if (user) {
        const today = dayKeyUB();
        // Sum today's XP INSIDE the transaction so the row just written counts.
        const todayRow = await manager
          .createQueryBuilder(XpLog, 'x')
          .select('COALESCE(SUM(x.amount), 0)', 'sum')
          .where('x.user_id = :userId', { userId: opts.userId })
          .andWhere('x.created_at >= :start', { start: startOfUBDay() })
          .getRawOne<{ sum: string }>();
        const todayXp = Number(todayRow?.sum ?? 0);
        const goal = user.dailyGoalXp ?? DAILY_GOAL;

        if (user.lastActiveDate !== today && todayXp >= goal) {
          const next = resolveStreak({
            lastActiveDate: user.lastActiveDate,
            currentStreak: user.currentStreak ?? 0,
            freezes: user.streakFreezes ?? 0,
            today,
          });
          await manager.update(User, { id: opts.userId }, {
            currentStreak: next.streak,
            longestStreak: Math.max(user.longestStreak ?? 0, next.streak),
            lastActiveDate: today,
            streakFreezes: next.freezesLeft,
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
  /**
   * Buy one streak freeze with Sparks.
   *
   * Capped at MAX_HELD_FREEZES so it can't be stockpiled into permanent streak
   * immunity — the streak has to still mean something.
   */
  /**
   * The user's plan, or null if they have none / it lapsed. Shared so
   * `buyStreakFreeze` and `getGamification` can never disagree about the price.
   */
  private activePlanOf(user: User): Plan | null {
    return user.plan &&
      (!user.planExpiresAt || user.planExpiresAt.getTime() > Date.now())
      ? user.plan
      : null;
  }

  async buyStreakFreeze(userId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { plan: true },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    const cost =
      this.activePlanOf(user)?.streakFreezeSparks ?? STREAK_FREEZE_SPARKS;
    const held = user.streakFreezes ?? 0;

    if (held >= MAX_HELD_FREEZES) {
      throw new BadRequestException(
        `Хамгийн ихдээ ${MAX_HELD_FREEZES} freeze хадгална`,
      );
    }
    if (user.sparks < cost) {
      throw new BadRequestException('Sparks хүрэлцэхгүй байна');
    }

    await this.sparks.change({
      userId,
      amount: -cost,
      source: SparksSource.STORE_PURCHASE,
      metadata: { item: 'streak_freeze', held: held + 1 },
    });
    await this.users.update(userId, { streakFreezes: held + 1 });

    return this.getGamification(userId);
  }

  /** Persist the user's chosen daily XP goal, then return the fresh summary. */
  async setDailyGoal(userId: string, dailyGoalXp: number) {
    await this.users.update(userId, { dailyGoalXp });
    return this.getGamification(userId);
  }

  async getGamification(userId: string): Promise<GamificationSummary> {
    const user = await this.users.findOne({
      where: { id: userId },
      // `plan` (+ planExpiresAt) are needed to price a streak freeze. Without
      // the relation `activePlanOf` would always see undefined and silently
      // report the free-tier price to paying users.
      relations: { plan: true },
      select: {
        // `id` is REQUIRED once `relations` is used: TypeORM builds a DISTINCT
        // sub-query on the primary key, and omitting it fails at runtime with
        // "column distinctAlias.User_id does not exist".
        id: true,
        xp: true,
        currentStreak: true,
        longestStreak: true,
        lastActiveDate: true,
        level: true,
        dailyGoalXp: true,
        streakFreezes: true,
        planExpiresAt: true,
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
      streakFreezes: user?.streakFreezes ?? 0,
      streakFreezeCost:
        (user && this.activePlanOf(user)?.streakFreezeSparks) ?? STREAK_FREEZE_SPARKS,
      maxStreakFreezes: MAX_HELD_FREEZES,
      todayXp: Number(todayRow?.sum ?? 0),
      dailyGoal: user?.dailyGoalXp ?? DAILY_GOAL,
      cefrLevel: user?.level ?? null,
      lessonsDone: Number(lessonRow?.n ?? 0),
      quizzesDone,
      progressByLevel,
    };
  }

  /** Distinct lesson ids this user has completed (lesson XP is logged once per
   *  lesson, so a lesson's XpLog row = that lesson is done). */
  async getCompletedLessonIds(userId: string): Promise<Set<string>> {
    const rows = await this.xpLogs
      .createQueryBuilder('x')
      .select('DISTINCT x.reference_id', 'id')
      .where('x.user_id = :userId', { userId })
      .andWhere('x.source = :src', { src: XpSource.LESSON })
      .andWhere('x.reference_id IS NOT NULL')
      .getRawMany<{ id: string }>();
    return new Set(rows.map((r) => r.id));
  }
}
