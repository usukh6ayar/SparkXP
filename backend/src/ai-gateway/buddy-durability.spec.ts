import { BuddyService, deferredWrite } from './buddy.service';

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

  function harness(
    opts: { usageWriteFails?: boolean; pipelineDelayMs?: number } = {},
  ) {
    const multi = { incr: jest.fn(), expire: jest.fn(), exec: jest.fn() };
    multi.incr.mockReturnValue(multi);
    multi.expire.mockReturnValue(multi);
    multi.exec.mockResolvedValue([]);

    /** Flips only once the usage row is actually written. */
    const saved = { done: false };
    const save = jest.fn(async () => {
      // A real insert is not instantaneous; without the delay a missing join
      // would still look correct simply because nothing yielded.
      // A failing write rejects *immediately* so it can land while the rest of
      // the pipeline is still running — see the `deferredWrite` suite below.
      if (opts.usageWriteFails) throw new Error('ledger write failed');
      await new Promise((r) => setTimeout(r, 20));
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
      //
      // `pipelineDelayMs` stands in for the seconds a real turn spends in the
      // LLM and TTS. It matters: with an instant failure the join is attached
      // before a fast-failing write can reject, which hides the bug below.
      buddies: {
        findOne: jest.fn(async () => {
          if (opts.pipelineDelayMs) {
            await new Promise((r) => setTimeout(r, opts.pipelineDelayMs));
          }
          throw new Error('pipeline stopped here');
        }),
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

  it('still surfaces the failure when the write fails mid-turn', async () => {
    // Same as above, but the write rejects while the pipeline is still running
    // rather than after it has already failed — the ordering `deferredWrite`
    // exists for (see the suite below). The error must survive the wait.
    const h = harness({ usageWriteFails: true, pipelineDelayMs: 50 });
    await expect(call(h.ctx)).rejects.toThrow('ledger write failed');
  });
});

/**
 * `deferredWrite` — why "start the write, join it later" needs a helper at all.
 *
 * Between starting and joining, the promise has **no** rejection handler on it.
 * If it rejects in that window Node reports an unhandled rejection, and since
 * v15 the default action for one is to throw — which kills the entire API
 * process, not just the turn. The window here is the length of a voice turn
 * (seconds of LLM + TTS), so one failed ledger insert would take the server
 * down. Verified on this repo's Node (v25): a promise rejecting at 100ms and
 * awaited at 1500ms exits the process before the `try/catch` is ever reached.
 *
 * Do not try to assert this with a `process.on('unhandledRejection')` spy:
 * Jest's sandboxed `process` never registers the listener with real Node, so
 * such a test passes whether or not the bug is present. It was written that way
 * first and proved nothing.
 *
 * What the tests below pin instead is the thing that actually fixes it — the
 * handler goes on **synchronously**. Swapping `deferredWrite` for the plain
 * `async () => { await promise; }` version does not merely fail these: it takes
 * the Jest worker down with `[Error: ledger write failed] Node.js v25.2.1`,
 * which is precisely what it would do to the API in production.
 */
describe('deferredWrite', () => {
  it('attaches a rejection handler synchronously', () => {
    const promise = Promise.reject(new Error('ledger write failed'));
    // `.catch()` is `.then(undefined, fn)` — spying on `then` asks the real
    // question: was a handler registered before this function returned?
    const then = jest.spyOn(promise, 'then');
    const join = deferredWrite(promise);
    expect(then).toHaveBeenCalledTimes(1);
    return expect(join()).rejects.toThrow('ledger write failed');
  });

  it('rethrows the original failure when joined', async () => {
    const boom = new Error('ledger write failed');
    const join = deferredWrite(Promise.reject(boom));
    await new Promise((r) => setTimeout(r, 20)); // reject well before the join
    await expect(join()).rejects.toBe(boom);
  });

  it('resolves quietly when the write succeeds', async () => {
    await expect(
      deferredWrite(Promise.resolve('row'))(),
    ).resolves.toBeUndefined();
  });

  it('can be joined more than once without changing the outcome', async () => {
    const join = deferredWrite(
      Promise.reject(new Error('ledger write failed')),
    );
    await expect(join()).rejects.toThrow('ledger write failed');
    await expect(join()).rejects.toThrow('ledger write failed');
  });
});
