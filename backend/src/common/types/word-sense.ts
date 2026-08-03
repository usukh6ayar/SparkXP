/**
 * The dictionary "search" result shape: the 4-sense format the product spec
 * asks for. Deliberately has NO title, label or definition — just the word (or
 * phrase), one English example and its Mongolian translation.
 *
 * Lives in `common/` rather than `dictionary/` because the `DictionaryEntry`
 * entity types its `senses` jsonb column with it. Entities are the neutral
 * layer every feature depends on, so they must not import from a feature
 * folder — that would put `src/dictionary/` both upstream and downstream of
 * `src/entities/`. Feature code keeps importing it from `dictionary/senses.ts`,
 * which re-exports it.
 */
export interface WordSense {
  /** The word or phrase this sense belongs to, e.g. "run", "run out of". */
  word: string;
  /** A short English example sentence. */
  example: string;
  /** Mongolian translation of `example`. */
  translation: string;
}
