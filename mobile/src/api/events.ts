import { apiRequest } from './client';

/** Kinds of Home event. `double_xp` also doubles XP awards server-side. */
export type EventType = 'daily' | 'weekly_challenge' | 'double_xp';

/** A live Home event (from GET /api/events/active). */
export interface AppEvent {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  /** ISO timestamps; the card counts down to `endsAt`. */
  startsAt: string;
  endsAt: string;
  rewardXp: number | null;
  /** Multiplier for `double_xp` (e.g. "2.00"); null otherwise. */
  xpMultiplier: string | null;
}

/** GET /events/active — events live right now, soonest-ending first. */
export function getActiveEvents(token: string): Promise<AppEvent[]> {
  return apiRequest<AppEvent[]>('/events/active', { token });
}
