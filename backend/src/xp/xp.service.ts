import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { XpSource } from '../common/enums';
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

    const todayRow = await this.xpLogs
      .createQueryBuilder('x')
      .select('COALESCE(SUM(x.amount), 0)', 'sum')
      .where('x.user_id = :userId', { userId })
      .andWhere({ createdAt: MoreThanOrEqual(startOfUBDay()) })
      .getRawOne<{ sum: string }>();

    return {
      xp,
      ...computeLevel(xp),
      currentStreak,
      longestStreak: user?.longestStreak ?? 0,
      todayXp: Number(todayRow?.sum ?? 0),
      dailyGoal: DAILY_GOAL,
      cefrLevel: user?.level ?? null,
    };
  }
}
