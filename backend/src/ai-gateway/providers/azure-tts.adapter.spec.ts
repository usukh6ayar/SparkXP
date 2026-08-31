import { ConfigService } from '@nestjs/config';
import { AzureTtsAdapter, buildSsml } from './azure-tts.adapter';

/**
 * The SSML builder is the part of the Azure adapter worth pinning: it is where
 * admin-supplied text (a buddy's `ttsParams`) and LLM-supplied text (the reply)
 * meet markup. Everything else in the adapter is the Speech SDK's own I/O.
 */
describe('buildSsml', () => {
  it('asks for viseme events', () => {
    // Without this element some voices emit no visemes at all, which during the
    // Go/No-Go test is indistinguishable from "this voice is unsupported".
    expect(buildSsml('Hi', 'en-US-AvaMultilingualNeural')).toContain(
      '<mstts:viseme type="redlips_front"/>',
    );
  });

  it('declares the mstts namespace the viseme element needs', () => {
    expect(buildSsml('Hi', 'v')).toContain(
      'xmlns:mstts="https://www.w3.org/2001/mstts"',
    );
  });

  it('escapes the reply text', () => {
    // A reply is LLM output: "fish & chips" would otherwise be a malformed
    // document and Azure rejects the whole request, so the buddy goes silent.
    const ssml = buildSsml('fish & chips <b> "x"', 'v');
    expect(ssml).toContain('fish &amp; chips &lt;b&gt; &quot;x&quot;');
    expect(ssml).not.toContain('& c');
  });

  it('escapes the voice name and prosody values', () => {
    const ssml = buildSsml('Hi', 'evil"voice', { rate: '"break' });
    expect(ssml).toContain('name="evil&quot;voice"');
    expect(ssml).toContain('rate="&quot;break"');
  });

  it('escapes an express-as style so it cannot break out of the attribute', () => {
    const ssml = buildSsml('Hi', 'v', { style: 'cheerful"/><script>' });
    expect(ssml).toContain('style="cheerful&quot;/&gt;&lt;script&gt;"');
    expect(ssml).not.toContain('<script>');
  });

  it('omits express-as when no style is set', () => {
    expect(buildSsml('Hi', 'v')).not.toContain('express-as');
  });

  it('prefers per-buddy params over the env defaults', () => {
    const ssml = buildSsml('Hi', 'v', { rate: '-10%' }, { rate: '+5%', pitch: '+2%' });
    expect(ssml).toContain('rate="-10%"');
    expect(ssml).toContain('pitch="+2%"'); // not overridden → default applies
  });

  it('falls back to neutral prosody when nothing is configured', () => {
    const ssml = buildSsml('Hi', 'v');
    expect(ssml).toContain('rate="0%"');
    expect(ssml).toContain('pitch="0%"');
  });

  it('treats an empty env default as unset, not as an empty attribute', () => {
    // `.env` with a bare "AZURE_TTS_RATE=" yields '' (not undefined), and
    // `rate=""` is invalid SSML — Azure cancels the whole synthesis.
    const ssml = buildSsml('Hi', 'v', undefined, { rate: '', pitch: '' });
    expect(ssml).toContain('rate="0%"');
    expect(ssml).toContain('pitch="0%"');
    expect(ssml).not.toContain('rate=""');
  });
});

/**
 * Voice resolution is the other half worth pinning: the admin voice dropdown
 * offered **Gemini** names for a long time, and passing one of those straight
 * to Azure fails the first synthesis and silently falls back — two provider
 * calls per turn, the wrong voice, and no visible error.
 */
describe('AzureTtsAdapter.resolveVoice', () => {
  const adapter = (configured?: string) =>
    new AzureTtsAdapter({
      get: (_key: string, fallback?: string) => configured ?? fallback,
    } as unknown as ConfigService);

  it('keeps a real Azure voice name', () => {
    expect(adapter().resolveVoice('en-GB-SoniaNeural')).toBe('en-GB-SoniaNeural');
  });

  it('keeps an HD voice name containing a colon', () => {
    const hd = 'en-US-Tyler:DragonHDFlashLatestNeural';
    expect(adapter().resolveVoice(hd)).toBe(hd);
  });

  it('rejects a leftover Gemini voice name and uses the configured voice', () => {
    expect(adapter('en-US-AvaMultilingualNeural').resolveVoice('Kore')).toBe(
      'en-US-AvaMultilingualNeural',
    );
  });

  it('rejects a leftover ElevenLabs voice id', () => {
    expect(adapter('en-US-AvaMultilingualNeural').resolveVoice('21m00Tcm4TlvDq8ikWAM')).toBe(
      'en-US-AvaMultilingualNeural',
    );
  });

  it('falls back to the configured voice when the buddy has none', () => {
    expect(adapter('en-US-JennyNeural').resolveVoice(null)).toBe('en-US-JennyNeural');
  });
});

/**
 * Synthesizer pooling.
 *
 * Reusing one synthesizer instead of building a fresh one per chunk is the
 * single biggest TTS latency win measured (time-to-first-audio p50 799ms →
 * 159ms): the SDK opens a WebSocket per `SpeechSynthesizer`, and the streaming
 * turn pays that handshake once *per spoken chunk*.
 *
 * It is also the change most able to fail quietly — a returned-but-broken
 * connection, or two turns sharing one instance and interleaving their viseme
 * events — so the lifecycle rules are pinned here rather than trusted.
 */
describe('AzureTtsAdapter synthesizer pool', () => {
  interface FakeSynth {
    closed: boolean;
    synthesizing?: unknown;
    visemeReceived?: unknown;
    close: () => void;
  }
  const make = (): FakeSynth => {
    const s: FakeSynth = { closed: false, close: () => { s.closed = true; } };
    return s;
  };
  /** Reach the private pool helpers without booting the SDK. */
  const pooled = (adapter: unknown) =>
    adapter as unknown as {
      pool: Map<string, { synthesizer: FakeSynth; idleSince: number }[]>;
      release: (voice: string, s: FakeSynth) => void;
      acquire: (voice: string) => FakeSynth;
      dispose: (s: FakeSynth) => void;
    };
  const adapter = () =>
    pooled(new AzureTtsAdapter({ get: (_k: string, f?: string) => f } as unknown as ConfigService));

  it('hands a released synthesizer back out for the next chunk', () => {
    const a = adapter();
    const s = make();
    a.release('en-US-AvaMultilingualNeural', s);
    expect(a.acquire('en-US-AvaMultilingualNeural')).toBe(s);
  });

  it('removes a synthesizer from the pool while it is in use', () => {
    // Two concurrent turns must never share one instance: the SDK's
    // `visemeReceived` is a per-instance handler, so their mouth timings
    // would interleave into each other's audio.
    const a = adapter();
    const s = make();
    a.release('v', s);
    expect(a.acquire('v')).toBe(s);
    expect(a.pool.get('v')).toHaveLength(0);
  });

  it('clears event handlers on release so a pooled instance is inert', () => {
    const a = adapter();
    const s = make();
    s.synthesizing = () => undefined;
    s.visemeReceived = () => undefined;
    a.release('v', s);
    expect(s.synthesizing).toBeUndefined();
    expect(s.visemeReceived).toBeUndefined();
  });

  it('closes an idle synthesizer that outlived the TTL instead of using it', () => {
    // Azure drops idle connections; handing a stale one to the next student
    // turns a latency win into a failed turn.
    const a = adapter();
    const stale = make();
    a.pool.set('v', [{ synthesizer: stale, idleSince: Date.now() - 10 * 60_000 }]);
    // No key configured, so building a fresh one throws — which is fine here:
    // what matters is that the stale entry was closed rather than returned.
    expect(() => a.acquire('v')).toThrow();
    expect(stale.closed).toBe(true);
  });

  it('caps the pool, closing the overflow rather than holding connections open', () => {
    const a = adapter();
    const kept = Array.from({ length: 4 }, make);
    kept.forEach((s) => a.release('v', s));
    const overflow = make();
    a.release('v', overflow);
    expect(a.pool.get('v')).toHaveLength(4);
    expect(overflow.closed).toBe(true);
  });

  it('keeps pools separate per voice', () => {
    const a = adapter();
    const ava = make();
    a.release('en-US-AvaMultilingualNeural', ava);
    expect(a.pool.get('en-GB-SoniaNeural')).toBeUndefined();
  });
});
