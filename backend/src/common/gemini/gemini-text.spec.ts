import { ConfigService } from '@nestjs/config';
import { runGeminiText } from './gemini-text';

/**
 * `thinkingConfig` is accepted by the `gemini-2.5-*` series and **rejected
 * outright** by the newer flash-lite models — a 400 on the whole request.
 *
 * This path is shared by AI quiz generation, dictionary/idiom/reading authoring
 * and the AI Buddy's own reply, and every one of those callers passes
 * `thinkingBudget: 0`. So without this recovery, pointing `GEMINI_MODEL` (or
 * `GEMINI_LLM_MODEL`) at a non-2.5 model takes all of them down at once, with a
 * bare 400 in the log as the only clue.
 */
describe('runGeminiText — thinkingConfig recovery', () => {
  const config = {
    get: (key: string, fallback?: string) =>
      key === 'GEMINI_API_KEY' ? 'test-key' : fallback,
  } as unknown as ConfigService;

  function harness(statuses: number[]) {
    const bodies: Record<string, unknown>[] = [];
    let call = 0;
    const fetchMock = jest.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      const status = statuses[Math.min(call++, statuses.length - 1)];
      return {
        ok: status === 200,
        status,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 },
        }),
        text: async () => 'thinkingConfig is not supported',
      };
    });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    return { bodies };
  }

  const thinking = (body: Record<string, unknown>) =>
    (body.generationConfig as Record<string, unknown>)?.thinkingConfig;

  it('retries once without thinkingConfig after a 400', async () => {
    const h = harness([400, 200]);
    const res = await runGeminiText(config, 'hi', 'test', {
      thinkingBudget: 0,
    });
    expect(res.text).toBe('{"ok":true}');
    expect(h.bodies).toHaveLength(2);
    expect(thinking(h.bodies[0])).toEqual({ thinkingBudget: 0 });
    expect(thinking(h.bodies[1])).toBeUndefined();
  });

  it('does not retry a 400 when thinkingConfig was never sent', async () => {
    // A 400 with nothing to drop is a real request error; retrying it unchanged
    // would just fail the same way and hide the cause.
    const h = harness([400, 200]);
    await expect(runGeminiText(config, 'hi', 'test')).rejects.toThrow();
    expect(h.bodies).toHaveLength(1);
  });

  it('drops the schema first, then thinkingConfig', async () => {
    const h = harness([400, 400, 200]);
    await runGeminiText(config, 'hi', 'test', {
      json: true,
      schema: { type: 'object' },
      thinkingBudget: 0,
    });
    expect(h.bodies).toHaveLength(3);
    const cfg = (i: number) =>
      h.bodies[i].generationConfig as Record<string, unknown>;
    expect(cfg(0).responseSchema).toBeDefined();
    expect(cfg(1).responseSchema).toBeUndefined();
    expect(thinking(h.bodies[1])).toBeDefined();
    expect(thinking(h.bodies[2])).toBeUndefined();
  });
});
