import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PaymentsEnabledGuard } from './payments-enabled.guard';

/**
 * The whole point of this guard is that it FAILS CLOSED: an unset or
 * mistyped `PAYMENTS_ENABLED` must block, because the route behind it grants
 * paid plans without checking anything with QPay. These cases are the ones a
 * future refactor could silently break.
 */
describe('PaymentsEnabledGuard', () => {
  const guardWith = (value: string | undefined) =>
    new PaymentsEnabledGuard({ get: () => value } as unknown as ConfigService);

  it('allows the request only when the flag is exactly "true"', () => {
    expect(guardWith('true').canActivate()).toBe(true);
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['false', 'false'],
    // Anything truthy-looking but not the literal flag still has to block —
    // this is the "someone typed 1 / yes / TRUE in Railway" case.
    ['1', '1'],
    ['yes', 'yes'],
    ['TRUE (wrong case)', 'TRUE'],
  ])('blocks when the flag is %s', (_label, value) => {
    expect(() => guardWith(value).canActivate()).toThrow(ServiceUnavailableException);
  });
});
