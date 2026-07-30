import { BuddySessionMode, XpSource } from '../common/enums';
import {
  ALWAYS_CHECKED,
  TYPES_BY_SOURCE,
  TrophyCondition,
  TrophyStats,
  evaluate,
  typesForSource,
} from './conditions';
import { TROPHY_CATALOG, TROPHY_TIERS } from './catalog';

/**
 * A wrong threshold hands out a trophy nobody earned, or locks one forever —
 * and neither failure throws. These specs are the only thing standing between
 * the catalog and a silently broken reward system.
 */

const ZERO: TrophyStats = {
  xpTotal: 0,
  sparksTotal: 0,
  streakDays: 0,
  trophyCount: 0,
  xpEvents: {},
  quizCount: {},
  quizPerfect: {},
  wordsLearned: 0,
  wordsMature: 0,
  wordsSaved: 0,
  cardsSwiped: 0,
  mistakesFixed: 0,
  buddySessions: {},
  buddyDistinct: 0,
};

describe('evaluate', () => {
  it('is false below, true at, and true above the threshold', () => {
    const c: TrophyCondition = { type: 'xp_total', value: 100 };
    expect(evaluate(c, { ...ZERO, xpTotal: 99 })).toBe(false);
    expect(evaluate(c, { ...ZERO, xpTotal: 100 })).toBe(true);
    expect(evaluate(c, { ...ZERO, xpTotal: 101 })).toBe(true);
  });

  it('reads each simple stat from its own field', () => {
    const cases: [TrophyCondition, Partial<TrophyStats>][] = [
      [{ type: 'sparks_total', value: 5 }, { sparksTotal: 5 }],
      [{ type: 'streak_days', value: 7 }, { streakDays: 7 }],
      [{ type: 'trophy_count', value: 3 }, { trophyCount: 3 }],
      [{ type: 'words_learned', value: 25 }, { wordsLearned: 25 }],
      [{ type: 'words_mature', value: 10 }, { wordsMature: 10 }],
      [{ type: 'words_saved', value: 4 }, { wordsSaved: 4 }],
      [{ type: 'cards_swiped', value: 50 }, { cardsSwiped: 50 }],
      [{ type: 'mistakes_fixed', value: 2 }, { mistakesFixed: 2 }],
      [{ type: 'buddy_distinct', value: 5 }, { buddyDistinct: 5 }],
    ];
    for (const [condition, stats] of cases) {
      expect(evaluate(condition, { ...ZERO, ...stats })).toBe(true);
      expect(evaluate(condition, ZERO)).toBe(false);
    }
  });

  it('treats a missing keyed stat as zero rather than throwing', () => {
    expect(
      evaluate({ type: 'quiz_count', skill: 'fill', value: 1 }, ZERO),
    ).toBe(false);
    expect(
      evaluate({ type: 'xp_events', source: XpSource.READING, value: 1 }, ZERO),
    ).toBe(false);
    expect(
      evaluate(
        { type: 'buddy_sessions', mode: BuddySessionMode.VOICE, value: 1 },
        ZERO,
      ),
    ).toBe(false);
  });

  it('keeps a skill-specific quiz count separate from the total', () => {
    const stats = { ...ZERO, quizCount: { total: 10, listening: 2 } };
    expect(evaluate({ type: 'quiz_count', value: 10 }, stats)).toBe(true);
    expect(
      evaluate({ type: 'quiz_count', skill: 'listening', value: 10 }, stats),
    ).toBe(false);
    expect(
      evaluate({ type: 'quiz_count', skill: 'listening', value: 2 }, stats),
    ).toBe(true);
  });

  it('keeps voice sessions separate from all sessions', () => {
    const stats = { ...ZERO, buddySessions: { total: 20, voice: 3 } };
    expect(evaluate({ type: 'buddy_sessions', value: 20 }, stats)).toBe(true);
    expect(
      evaluate(
        { type: 'buddy_sessions', mode: BuddySessionMode.VOICE, value: 20 },
        stats,
      ),
    ).toBe(false);
  });
});

describe('typesForSource', () => {
  it('always includes the source-independent types', () => {
    // users.xp and the streak move on EVERY award, whatever the source
    // (xp.service.ts:123-136), so gating them by source would never fire.
    for (const source of Object.values(XpSource)) {
      for (const type of ALWAYS_CHECKED) {
        expect(typesForSource(source)).toContain(type);
      }
    }
  });

  it('adds the source-specific types without duplicating', () => {
    const types = typesForSource(XpSource.QUIZ);
    expect(types).toContain('quiz_count');
    expect(types).toContain('quiz_perfect');
    expect(types).not.toContain('cards_swiped');
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('TROPHY_CATALOG', () => {
  const withCondition = TROPHY_CATALOG.filter((t) => t.condition !== null);

  it('has 100 trophies with unique slugs', () => {
    expect(TROPHY_CATALOG).toHaveLength(100);
    expect(new Set(TROPHY_CATALOG.map((t) => t.slug)).size).toBe(100);
  });

  it('gives every trophy a condition except the 4 CEFR finishers', () => {
    const dormant = TROPHY_CATALOG.filter((t) => t.condition === null).map(
      (t) => t.slug,
    );
    expect(dormant.sort()).toEqual([
      'crystal_b1_finisher',
      'emerald_b2_finisher',
      'gold_a1_finisher',
      'sapphire_a2_finisher',
    ]);
  });

  it('uses only condition types that some award actually checks', () => {
    // A type missing from the mapping means those trophies are unreachable —
    // a silent failure no runtime error would reveal.
    const reachable = new Set(Object.values(XpSource).flatMap(typesForSource));
    for (const t of withCondition) {
      expect(reachable).toContain(t.condition!.type);
    }
  });

  it('requires a positive threshold everywhere', () => {
    for (const t of withCondition) {
      expect(t.condition!.value).toBeGreaterThan(0);
    }
  });

  it('raises the threshold as the tier rises, within each condition family', () => {
    // "Family" = same stat and same filter, e.g. quiz_count{listening}.
    const family = (c: TrophyCondition): string =>
      [
        c.type,
        'skill' in c ? c.skill : '',
        'mode' in c ? c.mode : '',
        'source' in c ? c.source : '',
      ].join('|');

    const byFamily = new Map<
      string,
      { tier: number; slug: string; value: number }[]
    >();
    for (const t of withCondition) {
      const key = family(t.condition!);
      const entry = {
        tier: TROPHY_TIERS.indexOf(t.tier),
        slug: t.slug,
        value: t.condition!.value,
      };
      byFamily.set(key, [...(byFamily.get(key) ?? []), entry]);
    }

    // Collect every violation before asserting: fixing them one failure per
    // run would take as many runs as there are mistakes.
    const violations: string[] = [];
    for (const [key, entries] of byFamily) {
      const sorted = [...entries].sort((a, b) => a.tier - b.tier);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (prev.tier === cur.tier) continue; // ties within a tier are fine
        if (cur.value <= prev.value) {
          violations.push(
            `${key}: ${cur.slug}=${cur.value} must exceed ${prev.slug}=${prev.value}`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('TYPES_BY_SOURCE', () => {
  it('covers every XpSource so no award path is silently unmapped', () => {
    for (const source of Object.values(XpSource)) {
      expect(TYPES_BY_SOURCE[source]).toBeDefined();
    }
  });
});
