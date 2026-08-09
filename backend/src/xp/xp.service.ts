import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual, IsNull } from 'typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { Lesson } from '../entities/lesson.entity';
import { Plan } from '../entities/plan.entity';
import { Event } from '../entities/event.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { SparksService } from '../sparks/sparks.service';
import { AchievementsService } from '../achievements/achievements.service';
import { StarsService, type LevelUnlock } from './stars.service';
import { XpSource, ContentLevel, SparksSource, EventType } from '../common/enums';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { loadRewards, streakXp, type XpRewards } from './xp-rewards';
import {
  computeLevel,
  dayKeyUB,
  startOfUBDay,
  type LevelInfo,
  isStreakAlive,
  resolveStreak,
  streakCelebrationDue,
  MAX_HELD_FREEZES,
} from './gamification';

export interface AwardXpOptions {
  userId: string;
  amount: number;
  source: XpSource;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * "Your streak just went up" — sent once per day, then cleared by
 * `POST /gamification/streak-seen`. The app celebrates it like a trophy unlock.
 */
export interface StreakCelebration {
  /** The streak the learner reached today. */
  streak: number;
  /** The bonus XP that streak paid, from the (tunable) reward table. */
  bonusXp: number;
}

/** Gamification summary returned to the app (Home / Profile). */
export interface GamificationSummary extends LevelInfo {
  xp: number;
  currentStreak: number;
  longestStreak: number;
  /** Unused streak freezes the learner owns. */
  streakFreezes: number;
  /** Freezes consumed by the current streak. */
  streakFreezesUsed: number;
  /**
   * Sparks price of one freeze, resolved from the user's plan.
   * Sent so the app never hard-codes a price that admin can change — the same
   * reason `HeartsState` carries `refillCost`.
   */
  streakFreezeCost: number;
  /** Most freezes that may be held at once. */
  maxStreakFreezes: number;
  /**
   * Set on the first read of a day the streak advanced, so the app can throw a
   * celebration. null once it has been shown (see `markStreakSeen`).
   */
  streakCelebration: StreakCelebration | null;
  todayXp: number;
  dailyGoal: number;
  cefrLevel: string | null;
  lessonsDone: number;
  quizzesDone: number;
  /** Per-CEFR-level lesson progress for the Lessons map islands (a1…c2). */
  progressByLevel: Record<string, { done: number; total: number }>;
  /** Per-CEFR-level star gate: stars earned, stars required, and unlocked. */
  levelUnlocks: Record<string, LevelUnlock>;
  /** Standalone quiz/exercise attempts completed today. */
  todayExercises: number;
  /** Daily exercise target for the Soril "Өнөөдрийн зам". */
  dailyExerciseGoal: number;
}

/** Fallback daily-XP goal for rows predating the per-user column. */
const DAILY_GOAL = 50;

/** The goals the app offers (Хөнгөн / Дунд / Ширүүн). */
export const DAILY_GOAL_CHOICES = [20, 50, 100] as const;

/** Free-tier Sparks price of one streak freeze (plans may override). */
const STREAK_FREEZE_SPARKS = 100;

/** Standalone exercises needed to fill the Soril daily path. */
const DAILY_EXERCISE_GOAL = 5;

/** Sparks paid once per day for completing the Soril daily path. */
const DAILY_PATH_SPARKS = 15;

/**
 * Where "the streak celebration was already shown today" is remembered.
 *
 * Redis, not a column: the fact that the streak advanced today is already
 * durable in `users.last_active_date`, so only the "seen" flag needs storing —
 * and prod runs `DB_SYNCHRONIZE=false`, so this avoids a migration for a value
 * that is worthless after 24 hours anyway. Two days of TTL covers the UB
 * timezone edge without ever growing.
 */
const streakSeenKey = (userId: string) => `streak:seen:${userId}`;
const STREAK_SEEN_TTL_SECONDS = 48 * 60 * 60;

@Injectable()
export class XpService {
  constructor(
    @InjectRepository(XpLog)
    private readonly xpLogs: Repository<XpLog>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    @InjectRepository(Event)
    private readonly events: Repository<Event>,
    private readonly dataSource: DataSource,
    private readonly sparks: SparksService,
    private readonly achievements: AchievementsService,
    private readonly stars: StarsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * XP multiplier from any live `double_xp` event (1 when none). Applied to every
   * award so a Double-XP event actually doubles what lands in the ledger.
   */
  private async activeXpMultiplier(): Promise<number> {
    const now = new Date();
    const ev = await this.events
      .createQueryBuilder('e')
      .where('e.type = :type', { type: EventType.DOUBLE_XP })
      .andWhere('e.is_active = true')
      .andWhere('e.starts_at <= :now', { now })
      .andWhere('e.ends_at >= :now', { now })
      .orderBy('e.xp_multiplier', 'DESC')
      .getOne();
    if (!ev) return 1;
    const m = Number(ev.xpMultiplier ?? 2);
    return m >= 1 ? m : 1;
  }

  /**
   * The XP award table, with any runtime Redis override applied. Callers use
   * this instead of hardcoding amounts — see `xp-rewards.ts`.
   */
  rewards(): Promise<XpRewards> {
    return loadRewards(this.redis);
  }

  /**
   * Award XP atomically: write an XpLog row, increment User.xp, and advance the
   * daily streak — all in one transaction. Anti-abuse: amount must be > 0.
   */
  async award(opts: AwardXpOptions): Promise<XpLog> {
    if (opts.amount <= 0) return null as unknown as XpLog;

    // A live Double-XP event multiplies the award before anything is written, so
    // the ledger, the User.xp cache and every downstream total stay consistent.
    const multiplier = await this.activeXpMultiplier();
    const amount = Math.round(opts.amount * multiplier);

    // Set inside the transaction when this award pushed the daily goal over
    // the line, so the streak bonus below can be paid exactly once per day.
    let streakAdvancedTo: number | null = null;

    const log = await this.dataSource.transaction(async (manager) => {
      const log = manager.create(XpLog, {
        userId: opts.userId,
        amount,
        source: opts.source,
        referenceId: opts.referenceId ?? null,
        metadata:
          multiplier > 1
            ? { ...(opts.metadata ?? {}), xpMultiplier: multiplier }
            : (opts.metadata ?? null),
      });
      await manager.save(log);

      // Increment the denormalized cache on User — safe inside the transaction.
      await manager.increment(User, { id: opts.userId }, 'xp', amount);

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
          streakFreezesUsedCurrent: true,
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
            streakFreezesUsedCurrent:
              next.streak === 1
                ? 0
                : (user.streakFreezesUsedCurrent ?? 0) + next.freezesUsed,
          });
          streakAdvancedTo = next.streak;
        }
      }

      return log;
    });

    // Streak bonus, paid AFTER the commit so it sees the advanced streak.
    // This recurses into award() exactly once: by now `lastActiveDate` is
    // today, so the streak block above is skipped and no second bonus fires.
    // `awardOnce` keyed on the day is the belt-and-braces guard.
    if (streakAdvancedTo !== null && opts.source !== XpSource.STREAK) {
      await this.awardStreakBonus(opts.userId, streakAdvancedTo);
    }

    // Fire-and-forget, and only once the transaction has COMMITTED: the check
    // reads users.xp and the streak this award just changed. Hooked here rather
    // than in awardOnce() because words.service.ts and reviews.service.ts call
    // award() directly. checkAfterXp swallows its own errors.
    void this.achievements.checkAfterXp(opts.userId, opts.source);

    return log;
  }

  /**
   * Pay the daily-goal streak bonus. `referenceId` is the day key, so
   * `awardOnce` makes it idempotent even if two awards race to extend the
   * streak. Never throws: the learning action that triggered it must not fail
   * because a bonus could not be written.
   */
  private async awardStreakBonus(userId: string, streak: number): Promise<void> {
    try {
      const rewards = await this.rewards();
      await this.awardOnce({
        userId,
        amount: streakXp(streak, rewards),
        source: XpSource.STREAK,
        referenceId: dayKeyUB(),
        metadata: { streak },
      });
    } catch {
      // non-critical
    }
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

  /** Remember that today's streak celebration has been shown. */
  async markStreakSeen(userId: string): Promise<{ ok: true }> {
    await this.redis
      .set(streakSeenKey(userId), dayKeyUB(), 'EX', STREAK_SEEN_TTL_SECONDS)
      .catch(() => null);
    return { ok: true };
  }

  /**
   * Today's unshown streak celebration, or null. The rule itself lives in
   * `streakCelebrationDue` so it can be tested without a database.
   */
  private async pendingStreakCelebration(
    userId: string,
    streak: number,
    lastActiveDate: string | null,
  ): Promise<StreakCelebration | null> {
    // A Redis failure reads as 'error' → treated as already seen.
    const seenDate = await this.redis
      .get(streakSeenKey(userId))
      .catch(() => 'error');
    const due = streakCelebrationDue({
      lastActiveDate,
      today: dayKeyUB(),
      seenDate,
      streak,
    });
    if (!due) return null;
    return { streak, bonusXp: streakXp(streak, await this.rewards()) };
  }

  /** Persist the user's chosen daily XP goal, then return the fresh summary. */
  async setDailyGoal(userId: string, dailyGoalXp: number) {
    await this.users.update(userId, { dailyGoalXp });
    return this.getGamification(userId);
  }

  async claimDailyPath(userId: string): Promise<{
    sparksAwarded: number;
    alreadyClaimed: boolean;
    todayExercises: number;
    dailyExerciseGoal: number;
  }> {
    const today = dayKeyUB();
    const start = startOfUBDay();

    return this.dataSource.transaction(async (manager) => {
      // Serialize claims per user/day so two taps cannot double-award.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `daily-path:${userId}:${today}`,
      ]);

      const attempts = await manager.getRepository(QuizAttempt).count({
        where: {
          userId,
          assignmentId: IsNull(),
          createdAt: MoreThanOrEqual(start),
        },
      });

      if (attempts < DAILY_EXERCISE_GOAL) {
        throw new BadRequestException('Өнөөдрийн зам хараахан дүүрээгүй байна');
      }

      const existing = await manager
        .getRepository(SparksLog)
        .createQueryBuilder('s')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.source = :source', { source: SparksSource.DAILY_PATH })
        .andWhere('s.metadata @> CAST(:meta AS jsonb)', {
          meta: JSON.stringify({ day: today }),
        })
        .getOne();

      if (existing) {
        return {
          sparksAwarded: 0,
          alreadyClaimed: true,
          todayExercises: attempts,
          dailyExerciseGoal: DAILY_EXERCISE_GOAL,
        };
      }

      const log = manager.create(SparksLog, {
        userId,
        amount: DAILY_PATH_SPARKS,
        source: SparksSource.DAILY_PATH,
        referenceId: null,
        metadata: { day: today, todayExercises: attempts },
      });
      await manager.save(log);
      await manager.increment(User, { id: userId }, 'sparks', DAILY_PATH_SPARKS);

      return {
        sparksAwarded: DAILY_PATH_SPARKS,
        alreadyClaimed: false,
        todayExercises: attempts,
        dailyExerciseGoal: DAILY_EXERCISE_GOAL,
      };
    });
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
        streakFreezesUsedCurrent: true,
        planExpiresAt: true,
      },
    });
    const xp = user?.xp ?? 0;

    // A streak counts if the last active day is today/yesterday — OR if the
    // learner holds enough freezes to bridge the gap. Freezes are only spent
    // when the goal is met (`resolveStreak` in `award()`), so without this the
    // app reported 0 in the meantime and a paid-for freeze looked broken.
    const today = dayKeyUB();
    const alive = isStreakAlive({
      lastActiveDate: user?.lastActiveDate ?? null,
      today,
      freezes: user?.streakFreezes ?? 0,
    });
    const currentStreak = alive ? (user?.currentStreak ?? 0) : 0;
    // `lastActiveDate === today` only happens once the daily goal is met, so it
    // doubles as "the streak advanced today" — no extra state needed.
    const streakCelebration = await this.pendingStreakCelebration(
      userId,
      currentStreak,
      user?.lastActiveDate ?? null,
    );

    const [todayRow, lessonRow, quizzesDone, todayExercises, levelTotals, levelDone] = await Promise.all([
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
      this.dataSource.getRepository(QuizAttempt).count({
        where: {
          userId,
          assignmentId: IsNull(),
          createdAt: MoreThanOrEqual(startOfUBDay()),
        },
      }),
      // Published lessons per CEFR level → island "total".
      this.lessons
        .createQueryBuilder('l')
        .select('l.level', 'level')
        .addSelect('COUNT(*)', 'n')
        .where('l.is_published = true')
        // Top-level only — the level trail lists exactly these, so the header
        // "done/total" and the number of nodes can't disagree.
        .andWhere('l.parent_lesson_id IS NULL')
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
        // Count only lessons the student can still see on the trail, so `done`
        // can never exceed the ticks (an unpublished lesson drops from both).
        .andWhere('l.is_published = true')
        .andWhere('l.parent_lesson_id IS NULL')
        .groupBy('l.level')
        .getRawMany<{ level: string; n: string }>(),
    ]);

    // Seed every CEFR level to 0/0, then fill in the grouped counts.
    const progressByLevel: Record<string, { done: number; total: number }> = {};
    for (const lvl of Object.values(ContentLevel)) progressByLevel[lvl] = { done: 0, total: 0 };
    for (const r of levelTotals) if (progressByLevel[r.level]) progressByLevel[r.level].total = Number(r.n);
    for (const r of levelDone) if (progressByLevel[r.level]) progressByLevel[r.level].done = Number(r.n);

    // Island unlocks: star-gated (§ Castle unlock), plus everything up to the
    // learner's own declared CEFR level — otherwise the level they pick at
    // sign-up has no effect on what they can open.
    const levelUnlocks = await this.stars.getLevelUnlocks(userId, user?.level);

    return {
      xp,
      ...computeLevel(xp),
      currentStreak,
      longestStreak: user?.longestStreak ?? 0,
      streakFreezes: user?.streakFreezes ?? 0,
      streakFreezesUsed: alive ? (user?.streakFreezesUsedCurrent ?? 0) : 0,
      streakFreezeCost:
        (user && this.activePlanOf(user)?.streakFreezeSparks) ?? STREAK_FREEZE_SPARKS,
      maxStreakFreezes: MAX_HELD_FREEZES,
      streakCelebration,
      todayXp: Number(todayRow?.sum ?? 0),
      dailyGoal: user?.dailyGoalXp ?? DAILY_GOAL,
      cefrLevel: user?.level ?? null,
      lessonsDone: Number(lessonRow?.n ?? 0),
      quizzesDone,
      todayExercises,
      dailyExerciseGoal: DAILY_EXERCISE_GOAL,
      progressByLevel,
      levelUnlocks,
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
