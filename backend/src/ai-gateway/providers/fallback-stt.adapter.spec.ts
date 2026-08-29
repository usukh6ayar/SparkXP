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
      adapter: new FallbackSttAdapter(primary, secondary as unknown as SttAdapter, 'azure'),
    };
  }

  it('returns the primary result and never touches the secondary', async () => {
    const h = harness(async () => ok('from primary'));
    await expect(h.adapter.transcribe(Buffer.from(''), 'audio/m4a')).resolves.toEqual(
      ok('from primary'),
    );
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
    await expect(h.adapter.transcribe(Buffer.from(''), 'audio/m4a')).resolves.toEqual(
      ok('from secondary'),
    );
  });

  it('falls over on a network error, which carries no status', async () => {
    const h = harness(async () => {
      throw new Error('fetch failed');
    });
    await expect(h.adapter.transcribe(Buffer.from(''), 'audio/m4a')).resolves.toEqual(
      ok('from secondary'),
    );
  });

  it('does NOT fall over on a 4xx — the audio, not the provider, is at fault', async () => {
    const h = harness(async () => {
      throw new SttProviderError(400, 'unusable audio');
    });
    await expect(h.adapter.transcribe(Buffer.from(''), 'audio/m4a')).rejects.toThrow(
      'unusable audio',
    );
    expect(h.secondary.transcribe).not.toHaveBeenCalled();
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
