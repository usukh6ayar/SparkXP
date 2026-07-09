import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { XpLog } from '../entities/xp-log.entity';
import { TROPHY_CATALOG, TROPHY_TIERS, Trophy } from './catalog';

export interface UserTrophy extends Trophy {
  earned: boolean;
}

export interface AchievementsResponse {
  tiers: string[];
  total: number;
  earned: number;
  /** Slugs granted on THIS request (for a one-time celebration in the UI). */
  newlyAwarded: string[];
  trophies: UserTrophy[];
}

/** Signals we can derive cheaply (User row + XpLog counts by source). */
interface Ctx {
  xp: number;
  longestStreak: number;
  count: Record<string, number>; // XpSource → count
}

/**
 * Auto-award rules for the trophies we can detect from existing signals. More
 * can be added over time; unmapped trophies stay locked until granted elsewhere.
 * Slugs must exist in the catalog (validated at award time).
 */
const CRITERIA: { slug: string; met: (c: Ctx) => boolean }[] = [
  // First-time actions
  { slug: 'starter_first_word', met: (c) => (c.count.word_review ?? 0) >= 1 },
  { slug: 'starter_first_swipe', met: (c) => (c.count.word_review ?? 0) >= 1 },
  { slug: 'starter_first_quiz', met: (c) => (c.count.quiz ?? 0) >= 1 },
  { slug: 'starter_first_voice', met: (c) => (c.count.ai_buddy ?? 0) >= 1 },
  { slug: 'starter_hello_buddy', met: (c) => (c.count.ai_buddy ?? 0) >= 1 },
  // Quiz volume
  { slug: 'bronze_quiz_rookie', met: (c) => (c.count.quiz ?? 0) >= 5 },
  { slug: 'silver_quiz_figther', met: (c) => (c.count.quiz ?? 0) >= 15 },
  { slug: 'gold_quiz_veteran', met: (c) => (c.count.quiz ?? 0) >= 30 },
  // Word volume
  { slug: 'bronze_word_paw', met: (c) => (c.count.word_review ?? 0) >= 20 },
  // Buddy volume
  { slug: 'silver_voice_builder', met: (c) => (c.count.ai_buddy ?? 0) >= 10 },
  // Streak milestones (best streak ever)
  { slug: 'bronze_weekly_flame', met: (c) => c.longestStreak >= 7 },
  { slug: 'sapphire_iron_habit', met: (c) => c.longestStreak >= 30 },
  { slug: 'crystal_iron_habit2', met: (c) => c.longestStreak >= 60 },
  { slug: 'emerald_hundred_day_fox', met: (c) => c.longestStreak >= 100 },
  { slug: 'ruby_half_year_spark', met: (c) => c.longestStreak >= 180 },
  { slug: 'mythic_one_year_spark', met: (c) => c.longestStreak >= 365 },
];

const CATALOG_SLUGS = new Set(TROPHY_CATALOG.map((t) => t.slug));

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(XpLog) private readonly xpLogs: Repository<XpLog>,
  ) {}

  /**
   * The full trophy catalog (images from Cloudflare R2) with an `earned` flag
   * per trophy for this user. Lazily evaluates the auto-award rules first, so
   * opening the screen grants any newly-qualified trophies.
   */
  async getForUser(userId: string): Promise<AchievementsResponse> {
    const newlyAwarded = await this.evaluateAndAward(userId);
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, trophies: true },
    });
    const earnedSet = new Set(user?.trophies ?? []);
    const trophies: UserTrophy[] = TROPHY_CATALOG.map((t) => ({
      ...t,
      earned: earnedSet.has(t.slug),
    }));
    return {
      tiers: TROPHY_TIERS,
      total: trophies.length,
      earned: trophies.filter((t) => t.earned).length,
      newlyAwarded,
      trophies,
    };
  }

  /**
   * Evaluate the auto-award rules for the user and grant any newly-earned
   * trophies (idempotent — never re-grants). Returns the slugs granted now.
   */
  async evaluateAndAward(userId: string): Promise<string[]> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, xp: true, longestStreak: true, trophies: true },
    });
    if (!user) return [];

    const rows = await this.xpLogs
      .createQueryBuilder('x')
      .select('x.source', 'source')
      .addSelect('COUNT(*)', 'n')
      .where('x.userId = :userId', { userId })
      .groupBy('x.source')
      .getRawMany<{ source: string; n: string }>();
    const count: Record<string, number> = {};
    for (const r of rows) count[r.source] = Number(r.n);

    const ctx: Ctx = { xp: user.xp, longestStreak: user.longestStreak, count };
    const owned = new Set(user.trophies ?? []);
    const newly = CRITERIA.filter(
      (cr) => CATALOG_SLUGS.has(cr.slug) && !owned.has(cr.slug) && safeMet(cr.met, ctx),
    ).map((cr) => cr.slug);

    if (newly.length) {
      user.trophies = [...(user.trophies ?? []), ...newly];
      await this.users.save(user);
    }
    return newly;
  }

  /** Grant specific trophies directly (e.g. from other services). Idempotent. */
  async award(userId: string, slugs: string[]): Promise<string[]> {
    const valid = slugs.filter((s) => CATALOG_SLUGS.has(s));
    if (!valid.length) return [];
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, trophies: true } });
    if (!user) return [];
    const owned = new Set(user.trophies ?? []);
    const newly = valid.filter((s) => !owned.has(s));
    if (newly.length) {
      user.trophies = [...(user.trophies ?? []), ...newly];
      await this.users.save(user);
    }
    return newly;
  }
}

/** A bad rule must never break the whole evaluation. */
function safeMet(fn: (c: Ctx) => boolean, ctx: Ctx): boolean {
  try {
    return fn(ctx);
  } catch {
    return false;
  }
}
