import { capWords, parseBuddyTurn, MAX_REPLY_WORDS } from './buddy-contract';

/** A minimal valid turn; individual tests override the fields they care about. */
function turnJson(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    reply_text: 'Nice work!',
    correction: { has_correction: false, original: '', corrected: '', short_explanation: '' },
    follow_up_question: 'What did you do today?',
    mistake_tags: [],
    emotion: 'happy',
    gesture: 'nod',
    cefr_level_used: 'B1',
    memory_update: { should_save: false, memory_type: 'interest', value: '' },
    safety: { flagged: false, reason: null },
    ...over,
  });
}

describe('capWords', () => {
  it('leaves a short reply alone', () => {
    expect(capWords('Nice work today!', 20)).toBe('Nice work today!');
  });

  it('cuts at the word limit', () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
    expect(capWords(long, 20).split(' ')).toHaveLength(20);
  });

  it('prefers to end on a sentence boundary', () => {
    const text = 'Tell me more about your trip last summer. It sounds really fun to me';
    // The 12-word cut lands mid-clause ("It sounds really"), and a full sentence
    // ends late enough in it to be worth keeping on its own.
    expect(capWords(text, 12)).toBe('Tell me more about your trip last summer.');
  });

  it('does not throw away most of the text for a tiny leading sentence', () => {
    // "Ok." is a sentence, but keeping only it would lose almost everything —
    // so the plain word cut wins instead.
    const text = 'Ok. ' + Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
    expect(capWords(text, 20).split(' ').length).toBeGreaterThan(5);
  });

  it('collapses surrounding whitespace', () => {
    expect(capWords('  hello   there  ', 20)).toBe('hello   there');
  });
});

describe('parseBuddyTurn', () => {
  it('caps the reply at the default word limit', () => {
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    const turn = parseBuddyTurn(turnJson({ reply_text: long }));
    expect(turn!.reply_text.split(' ')).toHaveLength(MAX_REPLY_WORDS);
  });

  it('honours a runtime-tuned word limit', () => {
    // The whole point of the limit living in Redis: tightening it must take
    // effect without a deploy, and without an app update.
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    const turn = parseBuddyTurn(turnJson({ reply_text: long }), { maxWords: 8 });
    expect(turn!.reply_text.split(' ')).toHaveLength(8);
  });

  it('still applies the character cap', () => {
    const turn = parseBuddyTurn(turnJson({ reply_text: 'x'.repeat(500) }), {
      maxChars: 40,
    });
    expect(turn!.reply_text.length).toBeLessThanOrEqual(40);
  });

  it('rejects a reply that is not JSON', () => {
    expect(parseBuddyTurn('sorry, I cannot do that')).toBeNull();
  });

  it('rejects an empty reply_text', () => {
    expect(parseBuddyTurn(turnJson({ reply_text: '   ' }))).toBeNull();
  });

  it('falls back to safe values for an unknown emotion or gesture', () => {
    const turn = parseBuddyTurn(turnJson({ emotion: 'smug', gesture: 'backflip' }));
    expect(turn!.emotion).toBe('calm');
    expect(turn!.gesture).toBe('idle');
  });
});
