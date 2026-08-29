import { toGeminiContents } from '../../common/gemini/gemini-text';

/**
 * Gemini's conversation shape differs from OpenAI's / Anthropic's in three ways
 * that the buddy pipeline trips over in normal operation, so each is pinned:
 *
 *  - there is no `assistant` role, it is `model`;
 *  - `runTurn` takes the last N messages, so the history can START on an
 *    assistant turn;
 *  - `completeTurn`'s "that wasn't valid JSON" retry appends an assistant
 *    message, so the history can END on one — leaving nothing to answer.
 */
describe('toGeminiContents', () => {
  it('maps assistant → model and keeps the text', () => {
    expect(
      toGeminiContents([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ]),
    ).toEqual([
      { role: 'user', parts: [{ text: 'Hello' }] },
      { role: 'model', parts: [{ text: 'Hi there!' }] },
      { role: 'user', parts: [{ text: 'How are you?' }] },
    ]);
  });

  it('drops leading model turns so the conversation starts on the user', () => {
    const contents = toGeminiContents([
      { role: 'assistant', content: 'Truncated history starts here' },
      { role: 'user', content: 'Hello' },
    ]);
    expect(contents).toHaveLength(1);
    expect(contents[0]).toEqual({ role: 'user', parts: [{ text: 'Hello' }] });
  });

  it('appends a user turn when the history ends on a model turn', () => {
    // This is the JSON-repair retry: without a trailing user turn Gemini has
    // nothing to respond to.
    const contents = toGeminiContents([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Return only valid JSON.' },
    ]);
    expect(contents[contents.length - 1].role).toBe('user');
    expect(contents).toHaveLength(3);
  });

  it('skips empty messages rather than sending blank parts', () => {
    expect(
      toGeminiContents([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: '   ' },
      ]),
    ).toEqual([{ role: 'user', parts: [{ text: 'Hello' }] }]);
  });
});
