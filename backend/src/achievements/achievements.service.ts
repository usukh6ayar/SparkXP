import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { TROPHY_CATALOG, TROPHY_TIERS, Trophy } from './catalog';

export interface UserTrophy extends Trophy {
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
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

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
