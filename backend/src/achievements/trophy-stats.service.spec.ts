import { BuddySessionMode } from '../common/enums';
import { TrophyStatsService } from './trophy-stats.service';

/**
 * Regression guard for a bug that awarded trophies to users who had not earned
 * them: the zeroed stats object was a module-level constant, so `{ ...EMPTY }`
 * handed every call the SAME nested `buddySessions` / `quizCount` objects and
 * one user's counts leaked into the next user's evaluation. Nothing threw —
 * users just received other people's trophies.
 */

/** Minimal fake repo: only what TrophyStatsService actually calls. */
function fakeRepo(
  rows: Record<string, unknown>[],
  one?: Record<string, unknown>,
) {
  const qb = {
    select: () => qb,
    addSelect: () => qb,
    where: () => qb,
    groupBy: () => qb,
    getRawMany: async () => rows,
    getRawOne: async () => one ?? rows[0],
  };
  return {
    createQueryBuilder: () => qb,
    findOne: async () => null,
    count: async () => 0,
  } as never;
}

describe('TrophyStatsService', () => {
  it('does not leak one user’s keyed stats into the next call', async () => {
    // First call sees a voice session; the second sees none.
    let sessions: Record<string, unknown>[] = [
      { mode: BuddySessionMode.VOICE, n: 3 },
    ];
    const service = new TrophyStatsService(
      fakeRepo([]),
      fakeRepo([]),
      fakeRepo([]),
      fakeRepo([]),
      {
        createQueryBuilder: () => ({
          select: () => ({
            addSelect: () => ({
              where: () => ({
                groupBy: () => ({
                  getRawMany: async () => sessions,
                }),
              }),
            }),
          }),
        }),
      } as never,
      fakeRepo([]),
    );

    const first = await service.load('user-a', ['buddy_sessions']);
    expect(first.buddySessions[BuddySessionMode.VOICE]).toBe(3);

    sessions = [];
    const second = await service.load('user-b', ['buddy_sessions']);
    expect(second.buddySessions[BuddySessionMode.VOICE]).toBeUndefined();
    expect(second.buddySessions.total).toBe(0);

    // And the first result must not have been mutated by the second call.
    expect(first.buddySessions[BuddySessionMode.VOICE]).toBe(3);
  });

  it('returns zeros for stats the caller did not ask for', async () => {
    const service = new TrophyStatsService(
      fakeRepo([]),
      fakeRepo([]),
      fakeRepo([]),
      fakeRepo([]),
      fakeRepo([]),
      fakeRepo([]),
    );
    const stats = await service.load('user-a', ['xp_total']);
    expect(stats.quizCount).toEqual({});
    expect(stats.buddySessions).toEqual({});
    expect(stats.cardsSwiped).toBe(0);
  });
});
