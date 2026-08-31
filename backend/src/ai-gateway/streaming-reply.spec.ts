import { buildBuddySystemPrompt } from './buddy-contract';
import { readJsonStringField, takeSpeakableChunks } from './streaming-reply';

/**
 * These two functions are what let the buddy start speaking before the LLM has
 * finished its JSON object. They run on *partial* text by definition, so the
 * cases worth pinning are all the half-arrived ones.
 */
describe('readJsonStringField', () => {
  it('returns null before the field has started', () => {
    expect(readJsonStringField('{"emotion":"happy"', 'reply_text')).toBeNull();
  });

  it('reads a value that is still arriving', () => {
    const r = readJsonStringField('{"reply_text":"Sounds like f', 'reply_text');
    expect(r).toEqual({ value: 'Sounds like f', complete: false });
  });

  it('marks the value complete on the closing quote', () => {
    const r = readJsonStringField('{"reply_text":"Nice!","emotion"', 'reply_text');
    expect(r).toEqual({ value: 'Nice!', complete: true });
  });

  it('unescapes quotes rather than ending the string early', () => {
    const r = readJsonStringField('{"reply_text":"She said \\"hi\\" today","x"', 'reply_text');
    expect(r).toEqual({ value: 'She said "hi" today', complete: true });
  });

  it('waits for a half-arrived \\u escape instead of emitting garbage', () => {
    // Cyrillic Ө arrives as Ө; reading it half-done would speak nonsense.
    const r = readJsonStringField('{"reply_text":"a\\u04', 'reply_text');
    expect(r).toEqual({ value: 'a', complete: false });
  });

  it('decodes a complete \\u escape', () => {
    const r = readJsonStringField('{"reply_text":"\\u04e8 hi"', 'reply_text');
    expect(r).toEqual({ value: 'Ө hi', complete: true });
  });

  it('is not confused by a similarly named field', () => {
    const r = readJsonStringField('{"reply_text_raw":"no","reply_text":"yes"', 'reply_text');
    expect(r?.value).toBe('yes');
  });
});

describe('takeSpeakableChunks', () => {
  it('emits nothing while the first sentence is incomplete', () => {
    expect(takeSpeakableChunks('That sounds like a really fun', 0, false).chunks).toEqual([]);
  });

  it('holds a sentence-ending punctuation until the next char confirms it', () => {
    // The '.' is the last character seen; more may follow in the next packet.
    const text = 'That sounds like a really wonderful day out there.';
    expect(takeSpeakableChunks(text, 0, false).chunks).toEqual([]);
    expect(takeSpeakableChunks(text + ' And', 0, false).chunks).toEqual([text]);
  });

  it('does not cut on a short sentence, to avoid a robotic one-word clip', () => {
    expect(takeSpeakableChunks('Nice. ', 0, false).chunks).toEqual([]);
  });

  it('emits everything remaining when the reply is final', () => {
    expect(takeSpeakableChunks('Nice work!', 0, true).chunks).toEqual(['Nice work!']);
  });

  it('reports a consumed offset that lets the caller resume without gaps', () => {
    const text = 'That sounds like a really wonderful day out there. And then?';
    const first = takeSpeakableChunks(text, 0, false);
    expect(first.chunks).toEqual(['That sounds like a really wonderful day out there.']);
    // Resuming from the reported offset must not repeat or drop characters.
    const second = takeSpeakableChunks(text, first.consumed, true);
    expect(second.chunks).toEqual(['And then?']);
  });

  it('does not re-speak what was already consumed', () => {
    const first = 'That sounds like a really wonderful day out there. ';
    const full = first + 'What did you eat for lunch?';
    expect(takeSpeakableChunks(full, first.length, true).chunks).toEqual([
      'What did you eat for lunch?',
    ]);
  });

  it('glues a too-short tail onto the previous chunk', () => {
    const full = 'That sounds like a really wonderful day out there. Yes.';
    expect(takeSpeakableChunks(full, 0, true).chunks).toEqual([
      'That sounds like a really wonderful day out there. Yes.',
    ]);
  });

  it('falls back to a clause break when a sentence runs past the budget', () => {
    // One sentence, no full stop until the very end, longer than MAX_CLAUSE_CHARS
    // (160). Waiting for the period would delay the first audio by the whole
    // sentence, so the comma at char 98 is the right place to start speaking.
    const long =
      'I think that going to the park on a sunny afternoon with your friends is one of the nicest things, ' +
      'and I would really like to hear a lot more about how it went for you later on today.';
    expect(long.length).toBeGreaterThan(160);
    const { chunks } = takeSpeakableChunks(long, 0, true);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatch(/nicest things,$/);
  });

  it('keeps a sentence whole when it fits inside the clause budget', () => {
    // Same shape but short enough — cutting at the comma here would only add a
    // needless TTS call and an unnatural pause.
    const ok = 'I went to the park on a sunny afternoon with my friends, and it was really nice.';
    expect(ok.length).toBeLessThan(160);
    expect(takeSpeakableChunks(ok, 0, true).chunks).toEqual([ok]);
  });
});

/**
 * The streaming turn speaks `reply_text` before the rest of the JSON object has
 * arrived. That is only safe while `safety` is emitted BEFORE it — otherwise a
 * child hears a sentence the safety gate has not seen yet.
 *
 * This is a property of the *prompt*, not of any function, and nothing else
 * would fail if someone tidied the key order. Hence this test.
 */
describe('buddy JSON key order (streaming safety invariant)', () => {
  const prompt = buildBuddySystemPrompt(
    {
      slug: 'police',
      name: 'Test',
      systemPrompt: 'Test buddy.',
    } as never,
    'B1',
    [],
  );

  it('asks for safety before reply_text', () => {
    expect(prompt.indexOf('"safety"')).toBeLessThan(prompt.indexOf('"reply_text"'));
  });

  it('asks for emotion before reply_text, so the face is set on chunk 0', () => {
    expect(prompt.indexOf('"emotion"')).toBeLessThan(prompt.indexOf('"reply_text"'));
  });

  it('asks for follow_up_question after reply_text, so it becomes a later chunk', () => {
    expect(prompt.indexOf('"reply_text"')).toBeLessThan(
      prompt.indexOf('"follow_up_question"'),
    );
  });

  it('tells the model the order is required', () => {
    expect(prompt).toContain('in exactly this order');
  });
});
