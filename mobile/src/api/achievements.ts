import { apiRequest } from './client';

export interface Trophy {
  slug: string;
  tier: string;
  name: string;
  /** Full-size PNG (~2 MB) — detail view only. */
  image: string;
  /** 256px WebP (~25 KB) — use in the grid. */
  thumb: string;
  earned: boolean;
}

export interface Achievements {
  tiers: string[];
  total: number;
  earned: number;
  /** Slugs granted on this request — show a one-time celebration. */
  newlyAwarded: string[];
  trophies: Trophy[];
}

/** GET /achievements — trophy catalog (R2 images) + this user's earned flags. */
export function getAchievements(token: string): Promise<Achievements> {
  return apiRequest<Achievements>('/achievements', { token });
}
