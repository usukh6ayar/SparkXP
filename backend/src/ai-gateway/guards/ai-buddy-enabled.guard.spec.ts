import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  AiBuddyEnabledGuard,
  isAiBuddyEnabled,
} from './ai-buddy-enabled.guard';

/**
 * This guard FAILS CLOSED: an unset or mistyped `AI_BUDDY_ENABLED` must block,
 * because the routes behind it bill Gemini and Anthropic per call while
 * payments are disabled — so nobody can be charged for what they spend.
 * A "1" / "yes" / "TRUE" typed into Railway must NOT open the tap.
 */
describe('AiBuddyEnabledGuard', () => {
  const configWith = (value: string | undefined) =>
    ({ get: () => value }) as unknown as ConfigService;
  const guardWith = (value: string | undefined) =>
    new AiBuddyEnabledGuard(configWith(value));

  it('allows the request only when the flag is exactly "true"', () => {
    expect(guardWith('true').canActivate()).toBe(true);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['false', 'false'],
    ['1', '1'],
    ['yes', 'yes'],
    ['TRUE (wrong case)', 'TRUE'],
    [' true (padded)', ' true'],
  ])('blocks when the flag is %s', (_label, value) => {
    expect(() => guardWith(value).canActivate()).toThrow(
      ServiceUnavailableException,
    );
  });

  /**
   * The availability endpoint and the guard must never disagree — if they did,
   * the app would show the buddy tab as open and then 503 on the first turn.
   */
  it.each([
    ['true', true],
    ['false', false],
    [undefined, false],
    ['TRUE', false],
    ['1', false],
  ])('isAiBuddyEnabled(%s) === %s, matching the guard', (value, expected) => {
    expect(isAiBuddyEnabled(configWith(value as string | undefined))).toBe(
      expected,
    );

    // …and the guard agrees: open ⇒ allows, closed ⇒ throws.
    if (expected) {
      expect(guardWith(value as string | undefined).canActivate()).toBe(true);
    } else {
      expect(() =>
        guardWith(value as string | undefined).canActivate(),
      ).toThrow(ServiceUnavailableException);
    }
  });
});
