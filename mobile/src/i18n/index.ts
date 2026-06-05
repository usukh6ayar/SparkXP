/**
 * Minimal i18n. Mongolian is primary (CLAUDE.md); English secondary.
 */
const mn = {
  appName: 'SparkXP',
  tagline: 'Суралц • Дадлага хий • Амжилтанд хүр',
  loading: 'Уншиж байна...',

  // Auth
  login: 'Нэвтрэх',
  register: 'Бүртгүүлэх',
  email: 'Имэйл',
  password: 'Нууц үг',
  fullName: 'Бүтэн нэр',
  province: 'Аймаг / Хот',
  district: 'Дүүрэг / Сум',
  logout: 'Гарах',
  noAccount: 'Шинэ хэрэглэгч үү?',
  haveAccount: 'Бүртгэлтэй юу?',
  selectProvince: 'Аймаг/хот сонгох',
  selectDistrict: 'Дүүрэг сонгох',
  optional: 'заавал биш',

  // Home
  home: 'Нүүр',
  greeting: 'Сайн уу',
  todayGoal: 'Өнөөдрийн зорилго',
  reviewWords: 'Үг давтах',
  startLearning: 'Суралцаж эхлэх',
  xp: 'XP',
  sparks: 'Очирхон',
  streak: 'Дараалал',

  // Review (spaced repetition)
  reviewTitle: 'Үг давтах',
  tapToFlip: 'Хариуг харах бол дар',
  example: 'Жишээ',
  again: 'Дахин',
  hard: 'Хэцүү',
  good: 'Сайн',
  easy: 'Амархан',
  noReviews: 'Одоогоор давтах үг алга 🎉',
  noReviewsHint: 'Шинэ үг сурахаар дараа дахин ороорой.',
  reviewDone: 'Бүгдийг давталаа!',
  reviewDoneHint: 'Маргааш дахин давтаарай 🦊',
  backHome: 'Нүүр рүү',

  // Common
  back: 'Буцах',
  continue: 'Үргэлжлүүлэх',
  errorGeneric: 'Алдаа гарлаа. Дахин оролдоно уу.',
  required: 'Заавал бөглөнө үү',
};

export type TranslationKey = keyof typeof mn;

const dictionaries = { mn };
let lang: keyof typeof dictionaries = 'mn';

export function setLanguage(next: keyof typeof dictionaries) {
  lang = next;
}

export function t(key: TranslationKey): string {
  return dictionaries[lang][key] ?? key;
}
