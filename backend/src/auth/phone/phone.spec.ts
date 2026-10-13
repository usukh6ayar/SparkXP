import { HttpException } from '@nestjs/common';
import { normalizePhone, tryNormalizePhone } from './phone';

describe('tryNormalizePhone', () => {
  it.each([
    ['99112233', '99112233'],
    ['9911 2233', '99112233'],
    ['9911-2233', '99112233'],
    ['+976 9911 2233', '99112233'],
    ['97699112233', '99112233'],
    ['(88) 11-22-33', '88112233'],
  ])('%s → %s', (input, expected) => {
    expect(tryNormalizePhone(input)).toBe(expected);
  });

  it.each(['9911223', '991122334', '19112233', '4911223a', '', 'abcdefgh'])(
    'rejects %p',
    (input) => {
      expect(tryNormalizePhone(input)).toBeNull();
    },
  );
});

describe('normalizePhone', () => {
  it('throws INVALID_PHONE with a code the app can match', () => {
    try {
      normalizePhone('123');
      fail('expected a throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(400);
      expect((err as HttpException).getResponse()).toMatchObject({ code: 'INVALID_PHONE' });
    }
  });
});
