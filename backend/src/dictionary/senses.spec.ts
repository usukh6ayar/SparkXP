import { parseSenses, MAX_SENSES } from './senses';

/**
 * parseSenses is the only thing standing between Gemini's free-form output and
 * a row that lives in `dictionary_entries` forever. Everything it can't trust
 * gets dropped rather than stored.
 */
describe('parseSenses', () => {
  const sense = (n: number) => ({
    word: `w${n}`,
    example: `Example ${n}.`,
    translation: `Орчуулга ${n}.`,
  });

  it('parses a plain JSON array', () => {
    const raw = JSON.stringify([sense(1), sense(2)]);
    expect(parseSenses(raw)).toEqual([sense(1), sense(2)]);
  });

  it('strips ```json fences', () => {
    const raw = '```json\n' + JSON.stringify([sense(1)]) + '\n```';
    expect(parseSenses(raw)).toEqual([sense(1)]);
  });

  it('accepts a { senses: [...] } wrapper', () => {
    const raw = JSON.stringify({ senses: [sense(1)] });
    expect(parseSenses(raw)).toEqual([sense(1)]);
  });

  it('caps the list at MAX_SENSES', () => {
    const raw = JSON.stringify([1, 2, 3, 4, 5, 6].map(sense));
    expect(parseSenses(raw)).toHaveLength(MAX_SENSES);
    expect(parseSenses(raw)[3]).toEqual(sense(4));
  });

  it('drops entries with a missing or blank field', () => {
    const raw = JSON.stringify([
      sense(1),
      { word: 'w2', example: 'Example 2.' },
      { word: 'w3', example: '   ', translation: 'Орчуулга 3.' },
    ]);
    expect(parseSenses(raw)).toEqual([sense(1)]);
  });

  it('trims whitespace around every field', () => {
    const raw = JSON.stringify([
      { word: '  run  ', example: ' I run. ', translation: ' Би гүйдэг. ' },
    ]);
    expect(parseSenses(raw)).toEqual([
      { word: 'run', example: 'I run.', translation: 'Би гүйдэг.' },
    ]);
  });

  it('returns [] for invalid JSON', () => {
    expect(parseSenses('sorry, I cannot help with that')).toEqual([]);
  });

  it('returns [] for a non-array JSON value', () => {
    expect(parseSenses('{"word":"run"}')).toEqual([]);
  });

  it('returns [] for empty input', () => {
    expect(parseSenses('')).toEqual([]);
  });
});
