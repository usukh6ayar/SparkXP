import {
  BuddyUsageService,
  capWithCredits,
  secondsPastCap,
} from './buddy-usage.service';
import { AiUsageType } from '../common/enums';

describe('pay-as-you-go cap math', () => {
  it('cap = plan headroom + balance', () => {
    expect(capWithCredits(100, 300, 600)).toBe(900); // 200 left on plan + 600
    expect(capWithCredits(400, 300, 600)).toBe(1000); // 100 already from credits
    expect(capWithCredits(100, 300, 0)).toBe(300); // no credits = plan cap
    expect(capWithCredits(100, null, 600)).toBeNull(); // unlimited stays unlimited
  });

  it('only the part of a usage past the plan cap is paid from credits', () => {
    expect(secondsPastCap(250, 50, 300)).toBe(0); // still inside the plan
    expect(secondsPastCap(320, 50, 300)).toBe(20); // crosses the cap
    expect(secondsPastCap(400, 50, 300)).toBe(50); // fully past it
  });
});

describe('BuddyUsageService.spendCredits', () => {
  function setup(balance: number, usedThisMonth: number) {
    const sum = (n: number) => ({
      select: () => ({
        where: () => ({
          andWhere: () => ({
            andWhere: () => ({ getRawOne: async () => ({ sum: String(n) }) }),
            getRawOne: async () => ({ sum: String(n) }),
          }),
        }),
      }),
    });
    const aiUsages = { createQueryBuilder: () => sum(usedThisMonth) };
    const credits = {
      createQueryBuilder: () => sum(balance),
      create: (r: any) => r,
      save: jest.fn(async (r: any) => r),
    };
    const free = { slug: 'free', voiceMinutesLimit: 5, sttMinutesLimit: 10 };
    const plans = { findOne: jest.fn(async () => free) };
    const users = {
      findOne: jest.fn(async () => ({ id: 'u-1', plan: null, planExpiresAt: null })),
    };
    const svc = new BuddyUsageService(
      aiUsages as any,
      plans as any,
      users as any,
      credits as any,
    );
    return { svc, credits, users };
  }

  it('takes the overflow from the balance', async () => {
    // Free TTS cap 5 min = 300 s; this 60 s turn took the month to 330 s.
    const { svc, credits } = setup(600, 330);
    await svc.spendCredits('u-1', AiUsageType.TTS, 60);
    expect(credits.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: AiUsageType.TTS, seconds: -30 }),
    );
  });

  it('never takes more than the balance', async () => {
    const { svc, credits } = setup(10, 400);
    await svc.spendCredits('u-1', AiUsageType.TTS, 60);
    expect(credits.save).toHaveBeenCalledWith(
      expect.objectContaining({ seconds: -10 }),
    );
  });

  it('no balance: one query, nothing written', async () => {
    const { svc, credits, users } = setup(0, 400);
    await svc.spendCredits('u-1', AiUsageType.STT, 60);
    expect(users.findOne).not.toHaveBeenCalled();
    expect(credits.save).not.toHaveBeenCalled();
  });

  it('inside the plan cap: nothing written', async () => {
    const { svc, credits } = setup(600, 200);
    await svc.spendCredits('u-1', AiUsageType.TTS, 60);
    expect(credits.save).not.toHaveBeenCalled();
  });
});
