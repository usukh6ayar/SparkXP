import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TROPHY_CATALOG, TROPHY_TIERS, Trophy } from './catalog';

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

export interface UserTrophy extends Trophy {
  /** ~87KB WebP, 640px — detail view / unlock celebration. */
  image: string;
  /** ~19KB WebP, 256px — use this for grids and lists. */
  thumb: string;
  earned: boolean;
}

export interface AchievementsResponse {
  tiers: string[];
  total: number;
  earned: number;
  trophies: UserTrophy[];
}

@Injectable()
export class AchievementsService {
  /** Media host without a trailing slash, resolved once at startup. */
  private readonly mediaBase: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    config: ConfigService,
  ) {
    this.mediaBase = config
      .get<string>('R2_PUBLIC_BASE_URL', FALLBACK_MEDIA_BASE)
      .replace(/\/$/, '');
  }

  /**
   * The full trophy catalog (images from Cloudflare R2) with an `earned` flag
   * per trophy for this user (from `User.trophies`), plus a summary count.
   * Awarding logic is separate — this endpoint only reads state for display.
   */
  async getForUser(userId: string): Promise<AchievementsResponse> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, trophies: true },
    });
    const earnedSet = new Set(user?.trophies ?? []);
    const trophies: UserTrophy[] = TROPHY_CATALOG.map((t) => ({
      ...t,
      image: `${this.mediaBase}/${FULL_FOLDER}/${t.slug}.webp`,
      thumb: `${this.mediaBase}/${THUMB_FOLDER}/${t.slug}.webp`,
      earned: earnedSet.has(t.slug),
    }));
    return {
      tiers: TROPHY_TIERS,
      total: trophies.length,
      earned: trophies.filter((t) => t.earned).length,
      trophies,
    };
  }
}
