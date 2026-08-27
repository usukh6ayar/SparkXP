import { buildSsml } from './azure-tts.adapter';

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
});
