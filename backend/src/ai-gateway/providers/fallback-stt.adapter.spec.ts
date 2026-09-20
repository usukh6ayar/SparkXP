import { FallbackSttAdapter } from './fallback-stt.adapter';
import { SttProviderError } from './azure-stt.adapter';
import { SttAdapter, SttResult } from './stt.adapter';

/**
 * The fallback exists so that hitting Azure's rate limit slows a turn down
 * instead of losing it. Its two rules are easy to break by "improving" it:
 *
 *  - the secondary must NOT be called on a successful turn (racing both would
 *    double the STT bill on every single turn, for no latency gain);
 *  - the secondary must NOT be called when the AUDIO is the problem — a 4xx
 *    means the second provider will fail the same way, having spent the
 *    student's time twice.
 */
describe('FallbackSttAdapter', () => {
  const ok = (text: string): SttResult => ({ text, confidence: 1, seconds: 3 });

  function harness(primaryBehaviour: () => Promise<SttResult>) {
    const secondary = {
      transcribe: jest.fn(async () => ok('from secondary')),
      transcribeUrl: jest.fn(async () => ok('from secondary')),
    };
    const primary: SttAdapter = {
      transcribe: jest.fn(primaryBehaviour),
      transcribeUrl: jest.fn(primaryBehaviour),
    };
    return {
      primary,
      secondary,
      adapter: new FallbackSttAdapter(
        primary,
        secondary as unknown as SttAdapter,
        'azure',
      ),
    };
  }

  it('returns the primary result and never touches the secondary', async () => {
    const h = harness(async () => ok('from primary'));
    await expect(
      h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
    ).resolves.toEqual(ok('from primary'));
    expect(h.secondary.transcribe).not.toHaveBeenCalled();
  });

  it('falls over on 429 — the rate limit this whole layer exists for', async () => {
    const h = harness(async () => {
      throw new SttProviderError(429, 'throttled');
    });
    const result = await h.adapter.transcribe(Buffer.from(''), 'audio/m4a');
    expect(result.text).toBe('from secondary');
    expect(h.secondary.transcribe).toHaveBeenCalledTimes(1);
  });

  it('falls over on a provider 5xx', async () => {
    const h = harness(async () => {
      throw new SttProviderError(503, 'unavailable');
    });
    await expect(
      h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
    ).resolves.toEqual(ok('from secondary'));
  });

  it('falls over on a network error, which carries no status', async () => {
    const h = harness(async () => {
      throw new Error('fetch failed');
    });
    await expect(
      h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
    ).resolves.toEqual(ok('from secondary'));
  });

  it('does NOT fall over on a 4xx — the audio, not the provider, is at fault', async () => {
    const h = harness(async () => {
      throw new SttProviderError(400, 'unusable audio');
    });
    await expect(
      h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
    ).rejects.toThrow('unusable audio');
    expect(h.secondary.transcribe).not.toHaveBeenCalled();
  });

  /**
   * The breaker is what makes the rate limit survivable. Without it a full
   * quota window means every turn pays Azure's round trip to be told "429" and
   * THEN Gemini's — slower than never having switched providers at all.
   */
  describe('circuit breaker', () => {
    it('skips the primary entirely after it fails once', async () => {
      const h = harness(async () => {
        throw new SttProviderError(429, 'throttled');
      });
      await h.adapter.transcribe(Buffer.from(''), 'audio/m4a');
      await h.adapter.transcribe(Buffer.from(''), 'audio/m4a');
      // Tried once, then left alone; the secondary served both turns.
      expect(h.primary.transcribe).toHaveBeenCalledTimes(1);
      expect(h.secondary.transcribe).toHaveBeenCalledTimes(2);
    });

    it("honours the provider's retry-after and retries once it passes", async () => {
      jest.useFakeTimers();
      try {
        let throttled = true;
        const h = harness(async () => {
          if (throttled) throw new SttProviderError(429, 'throttled', 54_000);
          return ok('from primary');
        });
        await h.adapter.transcribe(Buffer.from(''), 'audio/m4a');

        // Still inside the window Azure asked for → primary untouched.
        jest.advanceTimersByTime(53_000);
        await h.adapter.transcribe(Buffer.from(''), 'audio/m4a');
        expect(h.primary.transcribe).toHaveBeenCalledTimes(1);

        // Window over → the primary is tried again, and a success closes it.
        throttled = false;
        jest.advanceTimersByTime(2_000);
        await expect(
          h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
        ).resolves.toEqual(ok('from primary'));
        await h.adapter.transcribe(Buffer.from(''), 'audio/m4a');
        expect(h.primary.transcribe).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not open on a 4xx — the audio was the problem, not the provider', async () => {
      const h = harness(async () => {
        throw new SttProviderError(400, 'unusable audio');
      });
      await expect(
        h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
      ).rejects.toThrow('unusable audio');
      await expect(
        h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
      ).rejects.toThrow('unusable audio');
      expect(h.primary.transcribe).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * A hung provider is not the same as a failing one, and it is the failure the
   * fallback cannot see: `fetch` has no short timeout of its own, so a dead
   * connection would hold the turn open for minutes while the student stares at
   * "бодож байна…". The adapter's `AbortSignal.timeout` is what turns that
   * silence into an error this layer can act on.
   */
  it('falls over when the primary times out rather than hanging the turn', async () => {
    const h = harness(async () => {
      // What `fetch` throws on an aborted request: no HTTP status at all.
      throw Object.assign(new Error('The operation was aborted'), {
        name: 'TimeoutError',
      });
    });
    await expect(
      h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
    ).resolves.toEqual(ok('from secondary'));
  });

  /**
   * An EMPTY transcript is a success, not a failure — and it must stay that way.
   *
   * Both readings are defensible and one of them is expensive: the student may
   * simply have said nothing. Retrying on a second provider would bill every
   * accidental mic tap twice and double the wait before the buddy says "say
   * that again". The caller (`buddy.service`) already turns an empty transcript
   * into that prompt, free of charge.
   */
  it('accepts an empty transcript instead of retrying on the other provider', async () => {
    const h = harness(async () => ({ text: '', confidence: 1, seconds: 0 }));
    const result = await h.adapter.transcribe(Buffer.from(''), 'audio/m4a');
    expect(result.text).toBe('');
    expect(h.secondary.transcribe).not.toHaveBeenCalled();
  });

  /**
   * When BOTH providers are down the caller must see a real failure. Swallowing
   * it here — returning an empty result, say — would be read as "the student
   * said nothing", and they would be asked to repeat themselves into an outage
   * for as long as it lasted.
   */
  it('surfaces the secondary failure when both providers are down', async () => {
    const h = harness(async () => {
      throw new SttProviderError(503, 'azure down');
    });
    h.secondary.transcribe.mockRejectedValueOnce(new Error('gemini down'));
    await expect(
      h.adapter.transcribe(Buffer.from(''), 'audio/m4a'),
    ).rejects.toThrow('gemini down');
  });

  it('applies the same rules to URL transcription', async () => {
    const h = harness(async () => {
      throw new SttProviderError(429, 'throttled');
    });
    await expect(h.adapter.transcribeUrl('https://x/a.mp4')).resolves.toEqual(
      ok('from secondary'),
    );
    expect(h.secondary.transcribeUrl).toHaveBeenCalledTimes(1);
  });
});
