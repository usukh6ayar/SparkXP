import { BuddyService } from './buddy.service';

/**
 * `speak()` — the voice cache half.
 *
 * Two regressions are pinned here, both of which shipped and both of which are
 * invisible from the outside (a wrong-but-playable clip, or a "failed" test
 * that actually synthesized fine):
 *
 *  1. The cache key must use the **resolved** voice. When a buddy has no
 *     `voiceId` the key used to be the literal `'default'`, so every buddy
 *     shared one row and changing `AZURE_TTS_VOICE` kept serving the old clip
 *     forever.
 *  2. `skipCache` (the admin voice test) must skip the **write** as well as the
 *     read. `(textHash, voiceId)` is unique, so the second test of the same
 *     sentence hit a duplicate-key error that `speak`'s catch turned into
 *     "audio_url: null, viseme_count: 0" — indistinguishable from a voice that
 *     genuinely emits no visemes, which is the exact question the endpoint
 *     exists to answer.
 */
describe('BuddyService.speak', () => {
  const BUDDY = { voiceId: null, ttsParams: null } as never;

  function harness(cached: Record<string, unknown> | null = null) {
    const saves: Record<string, unknown>[] = [];
    const lookups: Record<string, unknown>[] = [];
    return {
      saves,
      lookups,
      ctx: {
        tts: {
          resolveVoice: jest.fn(() => 'en-US-AvaMultilingualNeural'),
          synthesize: jest.fn(async () => ({
            audio: Buffer.from('fake'),
            durationMs: 1200,
            model: 'azure',
            voiceId: 'en-US-AvaMultilingualNeural',
            mimeType: 'audio/mpeg',
            fileExtension: 'mp3',
            visemes: [{ id: 1, offsetMs: 0 }],
          })),
        },
        voiceCache: {
          findOne: jest.fn(async (q: { where: Record<string, unknown> }) => {
            lookups.push(q.where);
            return cached;
          }),
          increment: jest.fn(async () => undefined),
          create: jest.fn((row: Record<string, unknown>) => row),
          save: jest.fn(async (row: Record<string, unknown>) => { saves.push(row); return row; }),
        },
        imageStorage: { storeMedia: jest.fn(async () => 'https://cdn/clip.mp3') },
        logUsage: jest.fn(async () => undefined),
        logger: { error: jest.fn() },
      },
    };
  }

  const call = (ctx: unknown, skipCache = false) =>
    (BuddyService.prototype as never as {
      speak: (
        u: string, b: unknown, t: string, s: string, timer?: unknown, skip?: boolean,
      ) => Promise<{ audioUrl: string | null; visemes: unknown }>;
    }).speak.call(ctx, 'user-1', BUDDY, 'Hello there', 'session-1', undefined, skipCache);

  it('keys the cache on the resolved voice, not the raw voiceId', async () => {
    const h = harness();
    await call(h.ctx);
    expect(h.ctx.tts.resolveVoice).toHaveBeenCalledWith(null);
    expect(h.lookups[0].voiceId).toBe('en-US-AvaMultilingualNeural');
    expect(h.lookups[0].voiceId).not.toBe('default');
  });

  it('serves a cached clip without calling the provider', async () => {
    const h = harness({ id: 'c1', audioUrl: 'https://cdn/old.mp3', durationMs: 900, visemes: [] });
    const result = await call(h.ctx);
    expect(h.ctx.tts.synthesize).not.toHaveBeenCalled();
    expect(result.audioUrl).toBe('https://cdn/old.mp3');
  });

  it('skipCache bypasses the cached clip and calls the provider', async () => {
    const h = harness({ id: 'c1', audioUrl: 'https://cdn/old.mp3', durationMs: 900, visemes: [] });
    const result = await call(h.ctx, true);
    expect(h.ctx.voiceCache.findOne).not.toHaveBeenCalled();
    expect(h.ctx.tts.synthesize).toHaveBeenCalled();
    expect(result.audioUrl).toBe('https://cdn/clip.mp3');
  });

  it('skipCache does not write a row, so repeat tests cannot collide', async () => {
    const h = harness();
    await call(h.ctx, true);
    await call(h.ctx, true);
    expect(h.saves).toHaveLength(0);
  });

  it('still populates the cache on a normal turn', async () => {
    const h = harness();
    await call(h.ctx);
    expect(h.saves).toHaveLength(1);
    expect(h.saves[0].voiceId).toBe('en-US-AvaMultilingualNeural');
  });
});
