import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { SparksSource } from '../common/enums';
import { SparksService } from '../sparks/sparks.service';

/**
 * Free-tier defaults, used when the user has no plan (or the plan leaves the
 * field null). Plan columns override these so the economy is tunable from
 * admin without shipping an app update.
 */
const DEFAULTS = {
  maxHearts: 5,
  regenMinutes: 240, // one heart per 4 hours
  refillSparks: 50,
};

/** Hearts state as the client sees it. */
export interface HeartsState {
  /** Hearts available right now (regeneration already folded in). */
  hearts: number;
  /** Cap for this user's plan. */
  max: number;
  /** True for premium plans — `hearts` is cosmetic and never decrements. */
  unlimited: boolean;
  /** ISO time the NEXT heart regenerates, or null when full/unlimited. */
  nextHeartAt: string | null;
  /** ISO time hearts are back to full, or null when full/unlimited. */
  fullAt: string | null;
  /** Sparks needed to refill now (null when full/unlimited). */
  refillCost: number | null;
}

@Injectable()
export class HeartsService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly sparks: SparksService,
  ) {}

  /** Per-plan config with the free-tier defaults folded in. */
  private configOf(user: User) {
    const plan = user.plan;
    // An expired plan is treated as no plan.
    const active =
      plan && (!user.planExpiresAt || user.planExpiresAt.getTime() > Date.now())
        ? plan
        : null;

    return {
      unlimited: active?.unlimitedHearts ?? false,
      max: active?.maxHearts ?? DEFAULTS.maxHearts,
      regenMinutes: active?.heartRegenMinutes ?? DEFAULTS.regenMinutes,
      refillSparks: active?.heartRefillSparks ?? DEFAULTS.refillSparks,
    };
  }

  /**
   * Folds elapsed time into the stored counter.
   *
   * `users.hearts` is only accurate as of `hearts_updated_at`; this computes
   * the true current value without a cron job ticking every row. Returns the
   * new count plus the anchor timestamp it should be stored against — carrying
   * the remainder forward so partial progress toward the next heart isn't lost
   * every time we read.
   */
  private regenerate(user: User, max: number, regenMinutes: number) {
    const stored = user.hearts ?? max;
    const since = user.heartsUpdatedAt;

    if (stored >= max || !since || regenMinutes <= 0) {
      return { hearts: Math.min(stored, max), anchor: since };
    }

    const periodMs = regenMinutes * 60_000;
    const elapsed = Date.now() - since.getTime();
    const gained = Math.floor(elapsed / periodMs);
    if (gained <= 0) return { hearts: stored, anchor: since };

    const hearts = Math.min(max, stored + gained);
    // Full again → the anchor no longer matters. Otherwise keep the leftover
    // so the next heart doesn't restart its 4h clock from zero.
    const anchor =
      hearts >= max ? null : new Date(since.getTime() + gained * periodMs);
    return { hearts, anchor };
  }

  /** Builds the client-facing state (and the timestamps it counts down to). */
  private toState(
    hearts: number,
    anchor: Date | null,
    cfg: ReturnType<HeartsService['configOf']>,
  ): HeartsState {
    if (cfg.unlimited) {
      return {
        hearts: cfg.max,
        max: cfg.max,
        unlimited: true,
        nextHeartAt: null,
        fullAt: null,
        refillCost: null,
      };
    }

    const full = hearts >= cfg.max;
    const base = anchor?.getTime() ?? Date.now();
    const periodMs = cfg.regenMinutes * 60_000;
    const missing = cfg.max - hearts;

    return {
      hearts,
      max: cfg.max,
      unlimited: false,
      nextHeartAt: full ? null : new Date(base + periodMs).toISOString(),
      fullAt: full ? null : new Date(base + missing * periodMs).toISOString(),
      refillCost: full ? null : cfg.refillSparks,
    };
  }

  /** Loads the user with the plan relation hearts config depends on. */
  private async load(userId: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { plan: true },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    return user;
  }

  /**
   * Current hearts. Persists the regenerated value so the stored counter
   * doesn't drift further behind on every read.
   */
  async get(userId: string): Promise<HeartsState> {
    const user = await this.load(userId);
    const cfg = this.configOf(user);
    if (cfg.unlimited) return this.toState(cfg.max, null, cfg);

    const { hearts, anchor } = this.regenerate(user, cfg.max, cfg.regenMinutes);
    if (hearts !== user.hearts) {
      await this.users.update(userId, {
        hearts,
        heartsUpdatedAt: anchor,
      });
    }
    return this.toState(hearts, anchor, cfg);
  }

  /**
   * Spends one heart on a wrong answer. Never throws when already empty — the
   * caller (quiz `/check`) still needs to return the graded answer; it just
   * reads `hearts === 0` to end the run.
   */
  async lose(userId: string): Promise<HeartsState> {
    const user = await this.load(userId);
    const cfg = this.configOf(user);
    if (cfg.unlimited) return this.toState(cfg.max, null, cfg);

    const current = this.regenerate(user, cfg.max, cfg.regenMinutes);
    if (current.hearts <= 0) return this.toState(0, current.anchor, cfg);

    const hearts = current.hearts - 1;
    // Dropping below max starts (or keeps) the regen clock. If it was already
    // running, keep the existing anchor so this loss doesn't reset progress
    // toward the next heart.
    const anchor = current.anchor ?? new Date();

    await this.users.update(userId, { hearts, heartsUpdatedAt: anchor });
    return this.toState(hearts, anchor, cfg);
  }

  /** Refills to full by spending Sparks. */
  async refill(userId: string): Promise<HeartsState> {
    const user = await this.load(userId);
    const cfg = this.configOf(user);
    if (cfg.unlimited) return this.toState(cfg.max, null, cfg);

    const { hearts } = this.regenerate(user, cfg.max, cfg.regenMinutes);
    if (hearts >= cfg.max) {
      throw new BadRequestException('Зүрх аль хэдийн дүүрэн байна');
    }
    if (user.sparks < cfg.refillSparks) {
      throw new BadRequestException('Sparks хүрэлцэхгүй байна');
    }

    await this.sparks.change({
      userId,
      amount: -cfg.refillSparks,
      source: SparksSource.STORE_PURCHASE,
      metadata: { item: 'hearts_refill', from: hearts, to: cfg.max },
    });
    await this.users.update(userId, {
      hearts: cfg.max,
      heartsUpdatedAt: null,
    });

    return this.toState(cfg.max, null, cfg);
  }
}
