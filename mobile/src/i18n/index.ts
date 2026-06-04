/**
 * Minimal i18n. Mongolian is the primary language (CLAUDE.md); English is
 * secondary. For MVP we keep a flat dictionary and a tiny `t()` helper — swap
 * for a full i18n lib later if needed.
 */
const mn = {
  appName: 'EnglishXP',
  loading: 'Уншиж байна...',
  // Auth
  login: 'Нэвтрэх',
  register: 'Бүртгүүлэх',
  email: 'Имэйл',
  password: 'Нууц үг',
  fullName: 'Бүтэн нэр',
  logout: 'Гарах',
  noAccount: 'Бүртгэлгүй юу? Бүртгүүлэх',
  haveAccount: 'Бүртгэлтэй юу? Нэвтрэх',
  // Home
  home: 'Нүүр',
  xp: 'XP',
  sparks: 'Очирхон',
  welcome: 'Тавтай морил',
  // Errors
  errorGeneric: 'Алдаа гарлаа. Дахин оролдоно уу.',
  required: 'Заавал бөглөнө үү',
};

export type TranslationKey = keyof typeof mn;

const dictionaries = { mn };

/** Current language (MN for MVP; wire to a setting later). */
let lang: keyof typeof dictionaries = 'mn';

export function setLanguage(next: keyof typeof dictionaries) {
  lang = next;
}

/** Translate a key. Falls back to the key itself if missing. */
export function t(key: TranslationKey): string {
  return dictionaries[lang][key] ?? key;
}
