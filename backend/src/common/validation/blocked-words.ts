import { ValidateBy } from 'class-validator';

/**
 * Names and usernames are shown to other users on leaderboards, so App Store
 * guideline 1.2 wants objectionable ones filtered before they are saved.
 *
 * Deliberately short: only words that are offensive anywhere they appear as a
 * substring. Words that hide inside ordinary ones are left out on purpose —
 * e.g. "хуй" (хуй салхи = whirlwind), "sex" (Essex), "nazi" (Nazira). The
 * report button + admin «Гомдол» page catch what this misses.
 */
const BLOCKED = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'pussy',
  'porn',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'asshole',
  'penis',
  'vagina',
  'hitler',
  'пизд',
  'бляд',
  'ебан',
  'ёбан',
  'гичий',
];

/** Leetspeak a filter-dodger might use. */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '@': 'a',
  $: 's',
};

/** Lowercase, undo leetspeak, drop everything that isn't a letter (f_u.c k → fuck). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[01345@$]/g, (ch) => LEET[ch])
    .replace(/[^a-zа-яёөү]/g, '');
}

export function containsBlockedWord(text: string): boolean {
  const n = normalize(text);
  return BLOCKED.some((w) => n.includes(w));
}

/** `@NoBlockedWords()` — rejects names/usernames from the list above. */
export function NoBlockedWords(): PropertyDecorator {
  return ValidateBy({
    name: 'noBlockedWords',
    validator: {
      validate: (value: unknown) =>
        typeof value !== 'string' || !containsBlockedWord(value),
      defaultMessage: () => 'Энэ нэрийг ашиглах боломжгүй',
    },
  });
}
