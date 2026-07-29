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

/** The catalog stores R2 keys; the API still returns a ready-to-use `image`. */
export interface UserTrophy extends Omit<Trophy, 'imagePath'> {
  image: string;
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
    const trophies: UserTrophy[] = TROPHY_CATALOG.map(({ imagePath, ...t }) => ({
      ...t,
      image: `${this.mediaBase}/${imagePath}`,
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
