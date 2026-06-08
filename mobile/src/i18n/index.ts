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

  // Сорил (quiz)
  quiz: 'Сорил',
  question: 'Асуулт',
  submit: 'Дүгнэх',
  next: 'Дараагийнх →',
  result: 'Үр дүн',
  passed: 'Тэнцлээ! 🎉',
  failed: 'Дахин оролдоорой 😅',
  xpEarned: 'XP авлаа',
  yourAnswer: 'Хариултаа бичнэ үү...',

  // AI Chat
  aiChat: 'AI Туслах',
  aiBuddy: 'Англи хэлний AI найз',
  newChat: '+ Шинэ',
  typeMessage: 'Мессеж бичнэ үү...',
  aiTyping: 'AI бичиж байна...',

  // Profile
  profile: 'Профайл',
  editProfile: 'Профайл засах',
  save: 'Хадгалах',
  saving: 'Хадгалж байна...',

  // Lessons / Sparks
  lessons: 'Хичээлүүд',
  unlock: 'Нээх',
  locked: 'Түгжигдсэн 🔒',
  free: 'Үнэгүй',
  myBalance: 'Таны үлдэгдэл',

  // Common
  back: 'Буцах',
  continue: 'Үргэлжлүүлэх',
  errorGeneric: 'Алдаа гарлаа. Дахин оролдоно уу.',
  required: 'Заавал бөглөнө үү',
  comingSoon: 'Тун удахгүй',
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
