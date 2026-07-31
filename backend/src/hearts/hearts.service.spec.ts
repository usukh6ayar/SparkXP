import { HeartsService } from './hearts.service';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';

/**
 * Covers the lazy-regeneration math — the part of hearts most likely to break
 * silently. A bug here either strands users at 0 hearts or hands out free ones,
 * and neither shows up as a crash.
 */

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;
/** Mirrors DEFAULTS.regenMinutes in hearts.service.ts. */
const REGEN = 30 * MIN;

/** Minimal fake repo — `get()` persists, so we capture what it would write. */
function makeService(user: Partial<User>, redisBlob: string | null = null) {
  const updates: Record<string, unknown>[] = [];
  const users = {
    findOne: async () => user as User,
    update: async (_id: string, patch: Record<string, unknown>) => {
      updates.push(patch);
      Object.assign(user, patch);
    },
  };
  const sparks = { change: async () => undefined };
  // No runtime override configured → the service falls back to code DEFAULTS.
  const redis = { get: async () => redisBlob };
  const svc = new HeartsService(users as never, sparks as never, redis as never);
  return { svc, updates };
}

function freeUser(over: Partial<User> = {}): Partial<User> {
  return { id: 'u1', hearts: 5, heartsUpdatedAt: null, sparks: 0, plan: null, planExpiresAt: null, ...over };
}

describe('HeartsService — regeneration', () => {
  it('reports a full bar and no countdown when hearts are maxed', async () => {
    const { svc } = makeService(freeUser());
    const s = await svc.get('u1');
    expect(s.hearts).toBe(5);
    expect(s.nextHeartAt).toBeNull();
    expect(s.refillCost).toBeNull();
  });

  it('grants one heart per regen period and carries the remainder forward', async () => {
    // 2.25 periods since the anchor at 2 hearts → +2 hearts, a quarter of a
    // period of progress preserved.
    const user = freeUser({ hearts: 2, heartsUpdatedAt: new Date(Date.now() - 2.25 * REGEN) });
    const { svc } = makeService(user);
    const s = await svc.get('u1');

    expect(s.hearts).toBe(4);
    // The next heart must be ~0.75 of a period away, NOT a fresh full one —
    // otherwise every read would quietly reset progress toward the next heart.
    const msToNext = new Date(s.nextHeartAt!).getTime() - Date.now();
    expect(msToNext).toBeGreaterThan(0.5 * REGEN);
    expect(msToNext).toBeLessThan(REGEN);
  });

  it('never exceeds the max no matter how much time passed', async () => {
    const user = freeUser({ hearts: 1, heartsUpdatedAt: new Date(Date.now() - 500 * HOUR) });
    const { svc } = makeService(user);
    const s = await svc.get('u1');
    expect(s.hearts).toBe(5);
    expect(s.fullAt).toBeNull();
  });

  it('does not regenerate before a full period elapses', async () => {
    const user = freeUser({ hearts: 3, heartsUpdatedAt: new Date(Date.now() - 0.9 * REGEN) });
    const { svc } = makeService(user);
    expect((await svc.get('u1')).hearts).toBe(3);
  });
});

describe('HeartsService — losing hearts', () => {
  it('decrements and starts the regen clock', async () => {
    const { svc } = makeService(freeUser());
    const s = await svc.lose('u1');
    expect(s.hearts).toBe(4);
    expect(s.nextHeartAt).not.toBeNull();
    expect(s.refillCost).toBe(50);
  });

  it('floors at zero and never goes negative', async () => {
    const user = freeUser({ hearts: 0, heartsUpdatedAt: new Date() });
    const { svc } = makeService(user);
    expect((await svc.lose('u1')).hearts).toBe(0);
  });

  it('keeps the existing anchor so a second loss does not reset progress', async () => {
    const anchor = new Date(Date.now() - 0.25 * REGEN);
    const user = freeUser({ hearts: 3, heartsUpdatedAt: anchor });
    const { svc } = makeService(user);
    const s = await svc.lose('u1');

    expect(s.hearts).toBe(2);
    // Countdown still measured from the ORIGINAL anchor, so it is SHORTER than
    // a fresh period — a second loss must not reset progress.
    const msToNext = new Date(s.nextHeartAt!).getTime() - Date.now();
    expect(msToNext).toBeLessThan(REGEN);
  });
});

describe('HeartsService — plans', () => {
  const premium = { unlimitedHearts: true, maxHearts: null, heartRegenMinutes: null, heartRefillSparks: null } as Plan;

  it('never decrements for an unlimited plan', async () => {
    const user = freeUser({ hearts: 1, plan: premium, planExpiresAt: new Date(Date.now() + 30 * 24 * HOUR) });
    const { svc, updates } = makeService(user);

    const s = await svc.lose('u1');
    expect(s.unlimited).toBe(true);
    expect(s.hearts).toBe(5);
    expect(updates).toHaveLength(0); // nothing written to the DB
  });

  it('falls back to the free tier once the plan has expired', async () => {
    const user = freeUser({ hearts: 2, plan: premium, planExpiresAt: new Date(Date.now() - HOUR) });
    const { svc } = makeService(user);
    const s = await svc.get('u1');
    expect(s.unlimited).toBe(false);
    expect(s.hearts).toBe(2);
  });

  it('honours per-plan overrides for max and regen speed', async () => {
    const custom = { unlimitedHearts: false, maxHearts: 10, heartRegenMinutes: 60, heartRefillSparks: 25 } as Plan;
    const user = freeUser({
      hearts: 4,
      plan: custom,
      planExpiresAt: new Date(Date.now() + HOUR),
      heartsUpdatedAt: new Date(Date.now() - 3 * HOUR),
    });
    const { svc } = makeService(user);
    const s = await svc.get('u1');

    expect(s.max).toBe(10);
    expect(s.hearts).toBe(7); // 3h at 1 heart/hour
    expect(s.refillCost).toBe(25);
  });
});

describe('HeartsService — runtime tuning (Redis `hearts:defaults`)', () => {
  it('honours a regen override so hearts can be tuned without a deploy', async () => {
    // 20 min elapsed. The 30-min default gives 0 hearts back. With the
    // override at 5 min it should be capped back up to max instead.
    const user = freeUser({ hearts: 1, heartsUpdatedAt: new Date(Date.now() - 20 * MIN) });
    const { svc } = makeService(user, JSON.stringify({ regenMinutes: 5 }));
    expect((await svc.get('u1')).hearts).toBe(5);
  });

  it('honours a maxHearts override', async () => {
    const { svc } = makeService(freeUser({ hearts: 8 }), JSON.stringify({ maxHearts: 10 }));
    const s = await svc.get('u1');
    expect(s.max).toBe(10);
    expect(s.hearts).toBe(8);
  });

  it('falls back to code defaults when the blob is malformed', async () => {
    // Bad JSON must never take hearts down with it.
    const { svc } = makeService(freeUser(), 'not-json{');
    const s = await svc.get('u1');
    expect(s.max).toBe(5);
  });
});
