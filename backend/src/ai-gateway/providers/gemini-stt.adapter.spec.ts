import { ConfigService } from '@nestjs/config';
import { GeminiSttAdapter } from './gemini-stt.adapter';

/**
 * `thinkingConfig` is accepted by `gemini-2.5-*` and **rejected outright** by the
 * newer flash-lite models — a 400 on every request, which takes voice down
 * completely. The default STT model was moved off 2.5 for latency, so the rule
 * that decides whether to send it is now load-bearing.
 */
describe('GeminiSttAdapter thinkingConfig handling', () => {
  const audio = Buffer.from('fake audio');

  function harness(model?: string, statuses: number[] = [200]) {
    const bodies: Record<string, unknown>[] = [];
    let call = 0;
    const fetchMock = jest.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      const status = statuses[Math.min(call++, statuses.length - 1)];
      return {
        ok: status === 200,
        status,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'hello there' }] } }],
        }),
        text: async () => 'rejected',
      };
    });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    const config = {
      get: (key: string, fallback?: string) =>
        key === 'GEMINI_API_KEY' ? 'test-key' : (model ?? fallback),
    } as unknown as ConfigService;
    return { adapter: new GeminiSttAdapter(config), bodies, fetchMock };
  }

  const thinking = (body: Record<string, unknown>) =>
    (body.generationConfig as Record<string, unknown>)?.thinkingConfig;

  it('does not send thinkingConfig on the default (3.5-flash-lite) model', async () => {
    const h = harness();
    await h.adapter.transcribe(audio, 'audio/m4a');
    expect(h.bodies).toHaveLength(1);
    expect(thinking(h.bodies[0])).toBeUndefined();
  });

  it('still sends it on the 2.5 series, where thinking is on by default', async () => {
    const h = harness('gemini-2.5-flash');
    await h.adapter.transcribe(audio, 'audio/m4a');
    expect(thinking(h.bodies[0])).toEqual({ thinkingBudget: 0 });
  });

  it('recovers from a 400 by retrying without thinkingConfig', async () => {
    // Guards the case where a future model name still matches "gemini-2.5" in
    // spirit but rejects the field: one wasted call beats silent total failure.
    const h = harness('gemini-2.5-flash', [400, 200]);
    const result = await h.adapter.transcribe(audio, 'audio/m4a');
    expect(h.bodies).toHaveLength(2);
    expect(thinking(h.bodies[0])).toBeDefined();
    expect(thinking(h.bodies[1])).toBeUndefined();
    expect(result.text).toBe('hello there');
  });

  it('does not loop on a 400 that is not about thinkingConfig', async () => {
    const h = harness(undefined, [400, 400]);
    await expect(h.adapter.transcribe(audio, 'audio/m4a')).rejects.toThrow();
    // No thinkingConfig was sent, so there is nothing to drop and retry.
    expect(h.bodies).toHaveLength(1);
  });

  it('keeps temperature 0 — a transcript is not a creative task', async () => {
    const h = harness();
    await h.adapter.transcribe(audio, 'audio/m4a');
    expect(
      (h.bodies[0].generationConfig as Record<string, unknown>).temperature,
    ).toBe(0);
  });
});

/**
 * Regression: "do you like music?" turn.
 *
 * Яриагүй аудио дээр Gemini хоосон биш, **өөрийн prompt-оо** буцаадаг. Хуучин
 * код түүнийг `confidence: 1`-тэй transcript болгож дамжуулдаг байсан тул
 * buddy LLM хөрвүүлэх хүсэлт хүлээж авч *"I can't help with audio
 * transcription. Let's practice speaking instead!"* гэж татгалзаж, тэр нь
 * түүхэнд хадгалагдаж session-ыг хордуулж байв.
 */
describe('GeminiSttAdapter — prompt echo нь transcript болж гарахгүй', () => {
  const audio = Buffer.from('fake audio');

  function harness(text: string) {
    (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
      text: async () => '',
    }));
    const config = {
      get: (key: string, fallback?: string) =>
        key === 'GEMINI_API_KEY' ? 'test-key' : fallback,
    } as unknown as ConfigService;
    return new GeminiSttAdapter(config);
  }

  it('жинхэнэ асуултыг хэвээр дамжуулна: "do you like music?"', async () => {
    const result = await harness('do you like music?').transcribe(
      audio,
      'audio/m4a',
    );
    expect(result.text).toBe('do you like music?');
    expect(result.confidence).toBe(1);
  });

  it('prompt-ийн цуурайг "яриа алга" болгоно (LLM хүртэл очихгүй)', async () => {
    const result = await harness(
      'Transcribe the speech in this audio verbatim.',
    ).transcribe(audio, 'audio/m4a');
    // Хоосон текст + 0 итгэл → `audioTurn` дахин хэлэхийг гуйна.
    expect(result.text).toBe('');
    expect(result.confidence).toBe(0);
  });

  it('цэг/том жижиг үсгийн ялгаатай цуурайг ч барина', async () => {
    const result = await harness(
      'transcribe the speech in this audio verbatim',
    ).transcribe(audio, 'audio/m4a');
    expect(result.text).toBe('');
  });

  it('prompt-ийн үгээр эхэлсэн БОГИНО жинхэнэ хариуг тасалдаггүй', async () => {
    // 4 үгээс богино → цуурай гэж үзэхгүй (хуурамч эерэгээс хамгаална).
    const result = await harness('transcribe this').transcribe(
      audio,
      'audio/m4a',
    );
    expect(result.text).toBe('transcribe this');
    expect(result.confidence).toBe(1);
  });
});
