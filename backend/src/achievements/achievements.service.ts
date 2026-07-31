import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { XpSource } from '../common/enums';
import { UserTrophy } from '../entities/user-trophy.entity';
import { TROPHY_CATALOG, TROPHY_TIERS, Trophy } from './catalog';
import { ConditionType, evaluate, typesForSource } from './conditions';
import { TrophyStatsService } from './trophy-stats.service';

/**
 * Fallback delivery host: the bucket's r2.dev subdomain. It is rate limited and
 * uncached, so production must set R2_PUBLIC_BASE_URL to a custom domain —
 * see docs/INFRA_COST_MODEL.md §12c.
 */
const FALLBACK_MEDIA_BASE =
  'https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev';

/**
 * Both sizes are flat folders keyed by slug, so no path needs storing anywhere.
 * Serving the right one matters: the 100-badge grid is 2.4MB of thumbs but
 * 8.7MB of full images (and was 206MB before they were re-encoded to WebP).
 */
const FULL_FOLDER = 'trophies/full';
const THUMB_FOLDER = 'trophies/thumb';

/** One catalog trophy as the app sees it. */
export interface TrophyView extends Trophy {
  /** ~87KB WebP, 640px — detail view / unlock celebration. */
  image: string;
  /** ~19KB WebP, 256px — use this for grids and lists. */
  thumb: string;
  earned: boolean;
  earnedAt: Date | null;
}

export interface AchievementsResponse {
  tiers: string[];
  total: number;
  earned: number;
  /** Earned but never celebrated — the app should show these, then POST /seen. */
  unseen: string[];
  /** Slugs the user pinned to their profile, in display order (max 5). */
  pinned: string[];
  trophies: TrophyView[];
}

/** How many trophies a learner may pin to their profile. */
export const MAX_PINNED_TROPHIES = 5;

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);
  /** Media host without a trailing slash, resolved once at startup. */
  private readonly mediaBase: string;

  constructor(
    @InjectRepository(UserTrophy)
    private readonly earned: Repository<UserTrophy>,
    private readonly stats: TrophyStatsService,
    config: ConfigService,
  ) {
    this.mediaBase = config
      .get<string>('R2_PUBLIC_BASE_URL', FALLBACK_MEDIA_BASE)
      .replace(/\/$/, '');
  }

  /** The full catalog with this user's earned flags, dates and unseen list. */
  async getForUser(userId: string): Promise<AchievementsResponse> {
    const rows = await this.earned.find({
      where: { userId },
      select: { slug: true, createdAt: true, seenAt: true, pinnedRank: true },
    });
    const bySlug = new Map(rows.map((r) => [r.slug, r]));

    const trophies: TrophyView[] = TROPHY_CATALOG.map((t) => {
      const row = bySlug.get(t.slug);
      return {
        ...t,
        image: `${this.mediaBase}/${FULL_FOLDER}/${t.slug}.webp`,
        thumb: `${this.mediaBase}/${THUMB_FOLDER}/${t.slug}.webp`,
        earned: Boolean(row),
        earnedAt: row?.createdAt ?? null,
      };
    });

    return {
      tiers: TROPHY_TIERS,
      total: trophies.length,
      earned: rows.length,
      unseen: rows.filter((r) => r.seenAt === null).map((r) => r.slug),
      pinned: rows
        .filter((r) => r.pinnedRank !== null)
        .sort((a, b) => a.pinnedRank! - b.pinnedRank!)
        .map((r) => r.slug),
      trophies,
    };
  }

  /**
   * Replace the user's pinned set with `slugs`, in the given order.
   *
   * Replace-the-whole-set (rather than pin/unpin one at a time) keeps the order
   * unambiguous and makes the call idempotent — the app sends what the profile
   * row should look like and gets exactly that.
   */
  async setPinned(userId: string, slugs: string[]): Promise<{ pinned: string[] }> {
    const wanted = [...new Set(slugs)];
    if (wanted.length > MAX_PINNED_TROPHIES) {
      throw new BadRequestException(
        `Хамгийн ихдээ ${MAX_PINNED_TROPHIES} трофей онцолно`,
      );
    }

    const held = new Set(
      (
        await this.earned.find({ where: { userId }, select: { slug: true } })
      ).map((r) => r.slug),
    );
    const missing = wanted.filter((slug) => !held.has(slug));
    if (missing.length) {
      throw new BadRequestException('Аваагүй трофейг онцолж болохгүй');
    }

    // One transaction: clearing first then ranking means a half-applied write
    // can never leave two trophies sharing a rank.
    await this.earned.manager.transaction(async (manager) => {
      await manager.update(UserTrophy, { userId }, { pinnedRank: null });
      for (const [rank, slug] of wanted.entries()) {
        await manager.update(UserTrophy, { userId, slug }, { pinnedRank: rank });
      }
    });

    return { pinned: wanted };
  }

  /** Marks unlock celebrations as shown. No slugs = every outstanding one. */
  async markSeen(
    userId: string,
    slugs?: string[],
  ): Promise<{ updated: number }> {
    const res = await this.earned.update(
      {
        userId,
        seenAt: IsNull(),
        ...(slugs?.length ? { slug: In(slugs) } : {}),
      },
      { seenAt: new Date() },
    );
    return { updated: res.affected ?? 0 };
  }

  /**
   * Re-checks the trophies an award of `source` could have unlocked.
   *
   * Called fire-and-forget after XP is committed, so it must never throw: a
   * trophy bug must not break the learning action that triggered it.
   */
  async checkAfterXp(userId: string, source: XpSource): Promise<string[]> {
    try {
      return await this.award(userId, typesForSource(source));
    } catch (err) {
      this.logger.error(
        `trophy check failed for ${userId}/${source}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return [];
    }
  }

  /**
   * Which of the given condition types the user now satisfies but has not been
   * given yet. Writes nothing — `award()` and the backfill's dry run share it.
   */
  async evaluateFor(userId: string, types: ConditionType[]): Promise<string[]> {
    const wanted = new Set<string>(types);
    const candidates = TROPHY_CATALOG.filter(
      (t) => t.condition !== null && wanted.has(t.condition.type),
    );
    if (!candidates.length) return [];

    const held = new Set(
      (
        await this.earned.find({ where: { userId }, select: { slug: true } })
      ).map((r) => r.slug),
    );
    const unheld = candidates.filter((t) => !held.has(t.slug));
    // Nothing left to win from this action — skip the stat queries entirely.
    if (!unheld.length) return [];

    const stats = await this.stats.load(userId, types);
    // `held` is already loaded, so use it rather than a second COUNT.
    stats.trophyCount = held.size;

    return unheld
      .filter((t) => evaluate(t.condition!, stats))
      .map((t) => t.slug);
  }

  /**
   * Awards every trophy from `types` the user has newly earned.
   *
   * @param seen mark inserted rows as already celebrated (backfill uses this)
   */
  async award(
    userId: string,
    types: ConditionType[],
    seen = false,
  ): Promise<string[]> {
    const won = await this.evaluateFor(userId, types);
    if (!won.length) return [];

    // ON CONFLICT DO NOTHING: two awards racing each other must not duplicate
    // or throw — the unique index on (user_id, slug) is the arbiter.
    await this.earned
      .createQueryBuilder()
      .insert()
      .into(UserTrophy)
      .values(
        won.map((slug) => ({ userId, slug, seenAt: seen ? new Date() : null })),
      )
      .orIgnore()
      .execute();

    this.logger.log(
      `awarded ${won.length} trophies to ${userId}: ${won.join(', ')}`,
    );
    return won;
  }
}
