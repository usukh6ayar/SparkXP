import { LessonAccessService, FREE_LESSON_QUOTA } from './lesson-access.service';
import { LessonUnlockSource } from '../common/enums';

/**
 * Covers the rule that decides whether a student may watch a lesson.
 *
 * This is revenue logic in both directions: too strict and a student is locked
 * out of homework their school already paid for, too loose and the whole
 * catalogue is free. Neither failure crashes, so only tests catch them.
 */

interface Setup {
  quotaOn?: boolean;
  /** Rows in `lesson_unlocks` for this user — only `source` matters here. */
  unlockedThisLesson?: LessonUnlockSource | null;
  freeUsed?: number;
  planId?: string | null;
  planExpiresAt?: Date | null;
  assigned?: boolean;
  priceSparks?: number;
}

function makeService(s: Setup = {}) {
  const {
    quotaOn = true,
    unlockedThisLesson = null,
    freeUsed = 0,
    planId = null,
    planExpiresAt = null,
    assigned = false,
    priceSparks = 0,
  } = s;

  const inserted: { source: LessonUnlockSource }[] = [];

  const unlocks = {
    findOne: async () => (unlockedThisLesson ? { id: 'unlock-1' } : null),
    count: async () => freeUsed + inserted.filter((r) => r.source === LessonUnlockSource.FREE).length,
  };
  const lessons = { findOne: async () => ({ id: 'l1', priceSparks }) };
  const users = { findOne: async () => ({ id: 'u1', planId, planExpiresAt }) };
  const assignments = { isAssignedLesson: async () => assigned };
  const config = {
    get: (key: string) =>
      key === 'FREE_LESSON_QUOTA_ENABLED' ? (quotaOn ? 'true' : 'false') : undefined,
  };

  // Runs the callback against a manager whose insert/count mirror the fakes above.
  const dataSource = {
    transaction: async (cb: (m: unknown) => Promise<void>) => {
      const manager = {
        createQueryBuilder: () => ({
          insert: () => ({
            into: () => ({
              values: (v: { source: LessonUnlockSource }) => ({
                orIgnore: () => ({ execute: async () => inserted.push(v) }),
              }),
            }),
          }),
        }),
        count: async () => freeUsed + inserted.filter((r) => r.source === LessonUnlockSource.FREE).length,
      };
      await cb(manager);
    },
  };

  const svc = new LessonAccessService(
    unlocks as never,
    lessons as never,
    users as never,
    assignments as never,
    config as never,
    dataSource as never,
  );
  return { svc, inserted };
}

describe('LessonAccessService — quota disabled (today\'s behaviour)', () => {
  it('keeps free lessons open and reports no quota at all', async () => {
    const { svc } = makeService({ quotaOn: false, priceSparks: 0 });
    const a = await svc.getAccess('u1', 'l1');
    expect(a.hasAccess).toBe(true);
    // null, not 3 — the app must not draw "3 үнэгүй үлдлээ" while the quota is off.
    expect(a.freeRemaining).toBeNull();
    expect(a.freeQuota).toBeNull();
  });

  it('still locks a Sparks-priced lesson that was never bought', async () => {
    const { svc } = makeService({ quotaOn: false, priceSparks: 50 });
    expect((await svc.getAccess('u1', 'l1')).hasAccess).toBe(false);
  });

  it('never spends a free right while switched off', async () => {
    const { svc, inserted } = makeService({ quotaOn: false, priceSparks: 50 });
    await svc.open('u1', 'l1');
    expect(inserted).toHaveLength(0);
  });
});

describe('LessonAccessService — quota enabled', () => {
  it('opens everything for an active subscriber', async () => {
    const { svc } = makeService({
      planId: 'plan-1',
      planExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const a = await svc.getAccess('u1', 'l1');
    expect(a.hasAccess).toBe(true);
    expect(a.reason).toBe('plan');
  });

  it('treats an expired plan as no plan', async () => {
    const { svc } = makeService({
      planId: 'plan-1',
      planExpiresAt: new Date(Date.now() - 1000),
    });
    expect((await svc.getAccess('u1', 'l1')).reason).toBe('locked');
  });

  it('keeps a grandfathered (legacy) lesson open', async () => {
    const { svc } = makeService({ unlockedThisLesson: LessonUnlockSource.LEGACY });
    const a = await svc.getAccess('u1', 'l1');
    expect(a.hasAccess).toBe(true);
    expect(a.reason).toBe('unlocked');
  });

  it('offers homework as openable even with zero free rights left', async () => {
    const { svc } = makeService({ assigned: true, freeUsed: FREE_LESSON_QUOTA });
    const a = await svc.getAccess('u1', 'l1');
    expect(a.canOpen).toBe(true);
    expect(a.freeRemaining).toBe(0);
  });

  it('opens homework WITHOUT spending a free right', async () => {
    const { svc, inserted } = makeService({ assigned: true, freeUsed: 1 });
    await svc.open('u1', 'l1');
    expect(inserted).toEqual([
      expect.objectContaining({ source: LessonUnlockSource.ASSIGNMENT }),
    ]);
  });

  it('spends a right on a lesson the student picked themselves', async () => {
    const { svc, inserted } = makeService({ freeUsed: 0 });
    await svc.open('u1', 'l1');
    expect(inserted).toEqual([
      expect.objectContaining({ source: LessonUnlockSource.FREE }),
    ]);
  });

  it('counts down the remaining rights', async () => {
    const { svc } = makeService({ freeUsed: 2 });
    const a = await svc.getAccess('u1', 'l1');
    expect(a.freeRemaining).toBe(FREE_LESSON_QUOTA - 2);
    expect(a.canOpen).toBe(true);
  });

  it('refuses a fourth self-chosen lesson', async () => {
    const { svc } = makeService({ freeUsed: FREE_LESSON_QUOTA });
    const a = await svc.getAccess('u1', 'l1');
    expect(a.canOpen).toBe(false);
    await expect(svc.open('u1', 'l1')).rejects.toThrow();
  });

  it('is a no-op on an already-open lesson, so a double tap costs nothing', async () => {
    const { svc, inserted } = makeService({
      unlockedThisLesson: LessonUnlockSource.FREE,
      freeUsed: 1,
    });
    await svc.open('u1', 'l1');
    expect(inserted).toHaveLength(0);
  });
});

describe('LessonAccessService — content visibility', () => {
  it('hides paid content from an anonymous caller once the quota is live', async () => {
    const { svc } = makeService({ priceSparks: 0 });
    expect(await svc.canSeeContent(null, 'l1')).toBe(false);
  });

  it('still serves free lessons to anonymous callers while the quota is off', async () => {
    const { svc } = makeService({ quotaOn: false, priceSparks: 0 });
    expect(await svc.canSeeContent(null, 'l1')).toBe(true);
  });

  it('serves content to a student who has access', async () => {
    const { svc } = makeService({ unlockedThisLesson: LessonUnlockSource.FREE });
    expect(await svc.canSeeContent('u1', 'l1')).toBe(true);
  });

  it('withholds content from a student who does not', async () => {
    const { svc } = makeService({ freeUsed: FREE_LESSON_QUOTA });
    expect(await svc.canSeeContent('u1', 'l1')).toBe(false);
  });
});
