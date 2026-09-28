import { capsInForce } from './buddy-usage.service';

/** Which voice caps apply — the rule that stops free users getting unlimited voice. */
const ESSENTIAL = { voiceMinutesLimit: 35, sttMinutesLimit: 100 };
const PLUS = { voiceMinutesLimit: 50, sttMinutesLimit: 120 } as never;
const NOW = Date.parse('2026-10-01T00:00:00Z');

describe('capsInForce', () => {
  it('uses the active plan', () => {
    const user = { plan: PLUS, planExpiresAt: new Date(NOW + 1000) };
    expect(capsInForce(user, ESSENTIAL, NOW)).toBe(PLUS);
  });

  it('gives a user with no plan the Essential caps, not unlimited', () => {
    expect(
      capsInForce({ plan: null, planExpiresAt: null }, ESSENTIAL, NOW),
    ).toEqual(ESSENTIAL);
  });

  it('gives a user whose plan expired the Essential caps', () => {
    const user = { plan: PLUS, planExpiresAt: new Date(NOW - 1000) };
    expect(capsInForce(user, ESSENTIAL, NOW)).toEqual(ESSENTIAL);
  });

  it('falls back to unlimited only when no Essential plan exists', () => {
    expect(capsInForce({ plan: null, planExpiresAt: null }, null, NOW)).toEqual(
      {
        voiceMinutesLimit: null,
        sttMinutesLimit: null,
      },
    );
  });
});
