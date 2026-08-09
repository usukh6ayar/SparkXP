import { StarsService } from './stars.service';
import { ContentLevel } from '../common/enums';

/**
 * Island unlocks on the Lessons map.
 *
 * The bug this guards: unlocks were computed from stars ALONE, so the CEFR
 * level a learner picks at sign-up changed nothing. Someone who said "I'm B2"
 * still landed on a map with only A1 open and had to grind 18 stars of beginner
 * material to reach their own level — the app asked for their level and then
 * ignored it.
 */
describe('StarsService.getLevelUnlocks', () => {
  /** Builds the service with a fixed star total and no per-level star rows. */
  const serviceWith = (totalStars: number) => {
    // One fluent builder serving both queries: every chaining method returns
    // itself, and the two terminals answer what each call site reads —
    // `getRawOne` the star total, `getRawMany` the per-level rows (none here,
    // so `starsEarned` is 0 and only the unlock flag is under test).
    const qb: Record<string, unknown> = {
      getRawOne: async () => ({ sum: String(totalStars) }),
      getRawMany: async () => [],
    };
    for (const m of ['select', 'addSelect', 'innerJoin', 'where', 'andWhere', 'groupBy']) {
      qb[m] = () => qb;
    }
    const stars = { createQueryBuilder: () => qb } as never;

    // No rows ⇒ the DEFAULT_REQUIRED gates apply (a1:0 a2:3 b1:9 b2:18 c1:30 c2:45).
    const requirements = { find: async () => [] } as never;
    // `lessons` is only used by other methods on the service.
    const lessons = {} as never;

    return new StarsService(stars, requirements, lessons);
  };

  const openLevels = (unlocks: Record<string, { unlocked: boolean }>) =>
    Object.values(ContentLevel).filter((c) => unlocks[c].unlocked);

  it('with no stars and no declared level, only a1 is open', async () => {
    const unlocks = await serviceWith(0).getLevelUnlocks('u1', null);
    expect(openLevels(unlocks)).toEqual(['a1']);
  });

  it('opens every level up to the declared one, with no stars earned', async () => {
    const unlocks = await serviceWith(0).getLevelUnlocks('u1', 'b2');
    expect(openLevels(unlocks)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('still gates levels ABOVE the declared one behind stars', async () => {
    const unlocks = await serviceWith(0).getLevelUnlocks('u1', 'b1');
    expect(unlocks.b2.unlocked).toBe(false); // needs 18 stars
    expect(unlocks.c2.unlocked).toBe(false);
  });

  it('stars still open levels above the declared one', async () => {
    // 18 stars clears the b2 gate even though the learner declared a1.
    const unlocks = await serviceWith(18).getLevelUnlocks('u1', 'a1');
    expect(unlocks.b2.unlocked).toBe(true);
    expect(unlocks.c1.unlocked).toBe(false); // 30 required
  });

  it('is case-insensitive about the stored level', async () => {
    const unlocks = await serviceWith(0).getLevelUnlocks('u1', 'B1');
    expect(unlocks.b1.unlocked).toBe(true);
  });

  it('ignores a level string that is not a CEFR code', async () => {
    // A stray value must not silently open everything.
    const unlocks = await serviceWith(0).getLevelUnlocks('u1', 'fluent');
    expect(openLevels(unlocks)).toEqual(['a1']);
  });

  it('treats a missing level exactly like the old stars-only behaviour', async () => {
    const withNothing = await serviceWith(9).getLevelUnlocks('u1', undefined);
    expect(openLevels(withNothing)).toEqual(['a1', 'a2', 'b1']);
  });
});
