import { AchievementsService, MAX_PINNED_TROPHIES } from './achievements.service';
import { UserTrophy } from '../entities/user-trophy.entity';

/**
 * Pinning is the one trophy write the app can drive directly, so it is the one
 * place a client bug could put junk in the table: too many slugs, duplicates,
 * or a trophy the user never earned. These guards live in the service, not the
 * DTO, because only the service knows what the user owns.
 */

interface Update {
  where: Record<string, unknown>;
  patch: Record<string, unknown>;
}

/** Minimal fake repo: records what `setPinned` would write. */
function makeService(held: string[]) {
  const updates: Update[] = [];
  const manager = {
    update: async (_entity: unknown, where: Update['where'], patch: Update['patch']) => {
      updates.push({ where, patch });
    },
    transaction: undefined as never,
  };
  const earned = {
    find: async () => held.map((slug) => ({ slug }) as UserTrophy),
    manager: {
      transaction: async (run: (m: typeof manager) => Promise<void>) => run(manager),
    },
  };
  const config = { get: (_k: string, fallback: string) => fallback };
  const svc = new AchievementsService(earned as never, null as never, config as never);
  return { svc, updates };
}

describe('AchievementsService.setPinned', () => {
  it('clears the old set first, then ranks the new one in order', async () => {
    const { svc, updates } = makeService(['a', 'b', 'c']);

    await expect(svc.setPinned('u1', ['c', 'a'])).resolves.toEqual({ pinned: ['c', 'a'] });

    expect(updates[0]).toEqual({ where: { userId: 'u1' }, patch: { pinnedRank: null } });
    expect(updates.slice(1)).toEqual([
      { where: { userId: 'u1', slug: 'c' }, patch: { pinnedRank: 0 } },
      { where: { userId: 'u1', slug: 'a' }, patch: { pinnedRank: 1 } },
    ]);
  });

  it('accepts an empty set as "unpin everything"', async () => {
    const { svc, updates } = makeService(['a']);

    await expect(svc.setPinned('u1', [])).resolves.toEqual({ pinned: [] });
    expect(updates).toEqual([{ where: { userId: 'u1' }, patch: { pinnedRank: null } }]);
  });

  it('drops duplicates rather than giving one trophy two ranks', async () => {
    const { svc, updates } = makeService(['a', 'b']);

    await expect(svc.setPinned('u1', ['a', 'a', 'b'])).resolves.toEqual({
      pinned: ['a', 'b'],
    });
    expect(updates.slice(1)).toHaveLength(2);
  });

  it('rejects more than the cap', async () => {
    const many = Array.from({ length: MAX_PINNED_TROPHIES + 1 }, (_, i) => `t${i}`);
    const { svc, updates } = makeService(many);

    await expect(svc.setPinned('u1', many)).rejects.toThrow();
    expect(updates).toHaveLength(0); // nothing written
  });

  it('rejects a trophy the user has not earned', async () => {
    const { svc, updates } = makeService(['a']);

    await expect(svc.setPinned('u1', ['a', 'stolen'])).rejects.toThrow();
    expect(updates).toHaveLength(0);
  });
});
