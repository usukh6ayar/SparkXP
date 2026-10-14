import { BadRequestException } from '@nestjs/common';
import { containsBlockedWord } from '../common/validation/blocked-words';
import {
  withoutHidden,
  type LeaderboardEntry,
} from '../leaderboard/leaderboard.service';
import { ModerationService } from './moderation.service';

/** App Store 1.2: report, block, and the name filter. */

const entry = (rank: number, userId: string): LeaderboardEntry => ({
  rank,
  userId,
  fullName: userId,
  username: null,
  avatarUrl: null,
  province: null,
  district: null,
  xp: 100 - rank,
});

describe('withoutHidden', () => {
  const list = [entry(1, 'a'), entry(2, 'b'), entry(3, 'c'), entry(4, 'd')];

  it('drops blocked users but keeps everyone else at their real rank', () => {
    const out = withoutHidden(list, new Set(['b']), 3);
    expect(out.map((e) => [e.rank, e.userId])).toEqual([
      [1, 'a'],
      [3, 'c'],
      [4, 'd'],
    ]);
  });

  it('caps at the limit when nobody is blocked', () => {
    expect(withoutHidden(list, new Set(), 2).map((e) => e.userId)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('containsBlockedWord', () => {
  it.each(['fuck_you', 'F.U.C.K', 'sh1tlord', 'Гичий', 'пиздец'])(
    'blocks %s',
    (name) => {
      expect(containsBlockedWord(name)).toBe(true);
    },
  );

  it.each(['bat_erdene', 'Essex', 'Nazira', 'хуй салхи', 'Dickens', 'Болд'])(
    'allows %s',
    (name) => {
      expect(containsBlockedWord(name)).toBe(false);
    },
  );
});

describe('ModerationService', () => {
  const ME = '11111111-1111-1111-1111-111111111111';
  const OTHER = '22222222-2222-2222-2222-222222222222';

  function setup(openReport: object | null = null) {
    const reports = {
      findOne: jest.fn().mockResolvedValue(openReport),
      create: jest.fn((x) => x),
      save: jest.fn(),
      update: jest.fn(),
    };
    const users = {
      exist: jest.fn().mockResolvedValue(true),
      update: jest.fn(),
    };
    const service = new ModerationService(
      reports as never,
      {} as never,
      users as never,
    );
    return { service, reports, users };
  }

  it('refuses to report yourself', async () => {
    const { service } = setup();
    await expect(service.report(ME, ME, 'photo')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not stack a second open report on the same person', async () => {
    const { service, reports } = setup({ id: 'r1' });
    await service.report(ME, OTHER, 'name');
    expect(reports.save).not.toHaveBeenCalled();
  });

  it('remove_avatar clears the photo and closes every open report on that user', async () => {
    const { service, reports, users } = setup({ id: 'r1', reportedId: OTHER });
    await service.resolve('r1', 'remove_avatar');
    expect(users.update).toHaveBeenCalledWith(OTHER, { avatarUrl: null });
    expect(reports.update).toHaveBeenCalledWith(
      { reportedId: OTHER, status: 'open' },
      expect.objectContaining({ status: 'resolved', action: 'remove_avatar' }),
    );
  });

  it('dismiss closes only that report and touches no profile', async () => {
    const { service, reports, users } = setup({ id: 'r1', reportedId: OTHER });
    await service.resolve('r1', 'dismiss');
    expect(users.update).not.toHaveBeenCalled();
    expect(reports.update).toHaveBeenCalledWith(
      { id: 'r1' },
      expect.objectContaining({ action: 'dismiss' }),
    );
  });
});
