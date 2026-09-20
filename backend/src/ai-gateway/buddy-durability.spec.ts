import { BuddyService } from './buddy.service';

/**
 * Durability boundaries on the voice-turn critical path.
 *
 * Two bookkeeping writes were taken off the critical path for latency
 * (2026-09-20): the STT usage row no longer sits between the transcript and the
 * LLM, and the LLM usage + token counters no longer sit between a validated
 * reply and speech synthesis. Both are now *started* early and *joined* later.
 *
 * That is only safe while the join is real. The failure mode it replaces —
 * plain fire-and-forget — is invisible: turns keep working, students keep
 * talking, and the billing ledger quietly loses rows. Nothing in the type
 * system distinguishes the two, so it is pinned here.
 */
describe('BuddyService.audioTurn — usage durability', () => {
  const USER = 'user-1';
  const SESSION = 'session-1';

  function harness(opts: { usageWriteFails?: boolean } = {}) {
    const multi = { incr: jest.fn(), expire: jest.fn(), exec: jest.fn() };
    multi.incr.mockReturnValue(multi);
    multi.expire.mockReturnValue(multi);
    multi.exec.mockResolvedValue([]);

    /** Flips only once the usage row is actually written. */
    const saved = { done: false };
    const save = jest.fn(async () => {
      // A real insert is not instantaneous; without the delay a missing join
      // would still look correct simply because nothing yielded.
      await new Promise((r) => setTimeout(r, 20));
      if (opts.usageWriteFails) throw new Error('ledger write failed');
      saved.done = true;
      return {};
    });

    const ctx = Object.create(BuddyService.prototype) as Record<
      string,
      unknown
    >;
    Object.assign(ctx, {
      sessions: {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: SESSION, userId: USER, buddySlug: 'fox' }),
      },
      users: {
        findOne: jest.fn().mockResolvedValue({ id: USER, level: 'b1' }),
      },
      gateway: {
        getLimits: jest.fn().mockResolvedValue({
          dailyVoiceTurnLimit: 60,
          sttMinConfidence: 0.4,
          maxContextMessages: 10,
        }),
      },
      usage: {
        checkStt: jest.fn().mockResolvedValue({
          allowed: true,
          usedSeconds: 0,
          limitSeconds: null,
          warnLevel: 'none',
        }),
        checkVoice: jest.fn().mockResolvedValue({
          allowed: true,
          usedSeconds: 0,
          limitSeconds: null,
          warnLevel: 'none',
        }),
      },
      redis: {
        get: jest.fn().mockResolvedValue('0'),
        multi: jest.fn(() => multi),
      },
      safetyEvents: {
        create: jest.fn((e) => e),
        save: jest.fn().mockResolvedValue({}),
      },
      aiUsages: { create: jest.fn((row) => row), save },
      stt: {
        transcribe: jest.fn().mockResolvedValue({
          text: 'I went to the park yesterday',
          confidence: 1,
          seconds: 3,
        }),
      },
      // Ends the turn right after the usage write is in flight. What happens to
      // that write when the rest of the pipeline fails is exactly the question.
      buddies: {
        findOne: jest
          .fn()
          .mockRejectedValue(new Error('pipeline stopped here')),
      },
      memory: { getContextMemories: jest.fn().mockResolvedValue([]) },
      messages: { find: jest.fn().mockResolvedValue([]) },
      logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
      turnStreams: { open: jest.fn() },
    });
    return { ctx, saved, save };
  }

  const call = (ctx: unknown) =>
    BuddyService.prototype.audioTurn.call(ctx, USER, SESSION, {
      buffer: Buffer.from(''),
      mimetype: 'audio/m4a',
    });

  it('finishes the STT usage write before the turn settles', async () => {
    const h = harness();
    await expect(call(h.ctx)).rejects.toThrow('pipeline stopped here');
    // The turn is over; the ledger row must already be on disk. A
    // fire-and-forget write would still be in flight here.
    expect(h.saved.done).toBe(true);
  });

  it('charges STT exactly once, with the seconds the provider reported', async () => {
    const h = harness();
    await expect(call(h.ctx)).rejects.toThrow();
    expect(h.save).toHaveBeenCalledTimes(1);
    expect(
      (h.ctx.aiUsages as { create: jest.Mock }).create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ voiceSeconds: 3, userId: USER }),
    );
  });

  it('surfaces a failed usage write instead of swallowing it', async () => {
    // Billing that fails silently is worse than a turn that fails loudly: the
    // student would keep speaking for free and nobody would find out until the
    // month's numbers did not add up.
    const h = harness({ usageWriteFails: true });
    await expect(call(h.ctx)).rejects.toThrow('ledger write failed');
  });
});
