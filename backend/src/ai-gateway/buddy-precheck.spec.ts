import { ForbiddenException } from '@nestjs/common';
import { BuddyService } from './buddy.service';

/**
 * `audioTurn`'s pre-check block: session + user + limits, then the two monthly
 * quotas, then the daily turn counter — all before a byte reaches the STT
 * provider.
 *
 * Why this is worth a test. Those reads used to run one after another and were
 * made concurrent for latency (2026-09-19). Concurrency is exactly where this
 * kind of code goes quietly wrong, and both hazards are invisible at the type
 * level:
 *
 *  - **Which limit the student is told about.** The quotas are now read
 *    together, so the *decision* order has to be kept by hand. `Promise.all`
 *    rejecting on whichever provider happened to answer first would report the
 *    voice cap to someone who actually ran out of speech-recognition minutes.
 *  - **The daily counter is a WRITE.** It must stay behind the quota gates. Run
 *    alongside them and a turn that was refused still burns one of the
 *    student's daily turns — they lose turns to an error they never saw.
 */
describe('BuddyService.audioTurn — pre-checks', () => {
  const USER = 'user-1';
  const SESSION = 'session-1';

  const allowance = (allowed: boolean) => ({
    allowed,
    usedSeconds: 0,
    limitSeconds: allowed ? null : 0,
    warnLevel: 'none' as const,
  });

  function harness(opts: { stt: boolean; voice: boolean }) {
    const multi = { incr: jest.fn(), expire: jest.fn(), exec: jest.fn() };
    multi.incr.mockReturnValue(multi);
    multi.expire.mockReturnValue(multi);
    multi.exec.mockResolvedValue([]);

    const ctx = Object.create(BuddyService.prototype) as Record<
      string,
      unknown
    >;
    Object.assign(ctx, {
      sessions: {
        findOne: jest.fn().mockResolvedValue({ id: SESSION, userId: USER }),
      },
      users: {
        findOne: jest.fn().mockResolvedValue({ id: USER, level: 'b1' }),
      },
      gateway: {
        getLimits: jest.fn().mockResolvedValue({
          dailyVoiceTurnLimit: 60,
          sttMinConfidence: 0.4,
        }),
      },
      usage: {
        checkStt: jest.fn().mockResolvedValue(allowance(opts.stt)),
        checkVoice: jest.fn().mockResolvedValue(allowance(opts.voice)),
      },
      redis: {
        get: jest.fn().mockResolvedValue('0'),
        multi: jest.fn(() => multi),
      },
      safetyEvents: {
        create: jest.fn((e) => e),
        save: jest.fn().mockResolvedValue({}),
      },
      // Reached only when every gate passes. Throwing here is how the test
      // proves the pipeline was entered without running any of it.
      stt: {
        transcribe: jest.fn().mockRejectedValue(new Error('reached STT')),
      },
      logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
      turnStreams: { open: jest.fn() },
    });
    return { ctx, multi };
  }

  const call = (ctx: unknown) =>
    BuddyService.prototype.audioTurn.call(ctx, USER, SESSION, {
      buffer: Buffer.from(''),
      mimetype: 'audio/m4a',
    });

  it('reports the STT cap, not the voice cap, when both are exhausted', async () => {
    const h = harness({ stt: false, voice: false });
    await expect(call(h.ctx)).rejects.toThrow(
      'Сарын дуу таних хязгаар хэтэрлээ',
    );
  });

  it('reports the voice cap when only that one is exhausted', async () => {
    const h = harness({ stt: true, voice: false });
    await expect(call(h.ctx)).rejects.toThrow(ForbiddenException);
    await expect(call(h.ctx)).rejects.toThrow(
      'Сарын дуут яриа хязгаар хэтэрлээ',
    );
  });

  it('does not spend a daily turn on a turn a quota refused', async () => {
    const h = harness({ stt: true, voice: false });
    await expect(call(h.ctx)).rejects.toThrow(ForbiddenException);
    expect(h.multi.incr).not.toHaveBeenCalled();
  });

  it('spends a daily turn and reaches STT once every gate passes', async () => {
    const h = harness({ stt: true, voice: true });
    // STT throws, which `audioTurn` turns into the "say that again" reply —
    // proof the gates were cleared and the provider was actually called.
    await expect(call(h.ctx)).resolves.toMatchObject({ session_id: SESSION });
    expect(h.multi.incr).toHaveBeenCalledTimes(1);
    expect(
      (h.ctx.stt as { transcribe: jest.Mock }).transcribe,
    ).toHaveBeenCalledTimes(1);
  });
});
