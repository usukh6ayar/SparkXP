// Shared option lists used across admin pages (kept here so CEFR levels aren't
// re-declared in every page that has a level <select>).

/** CEFR proficiency levels, low → high. */
export const CEFR_LEVELS: string[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

/** Level <select> options for forms (A1…C2). */
export const levelFormOptions = CEFR_LEVELS.map((v) => ({ value: v, label: v.toUpperCase() }));

/** Level <select> options for filters (adds an "all levels" entry). */
export const levelFilterOptions = [
  { value: '', label: 'Бүх түвшин' },
  ...levelFormOptions,
];

/**
 * Reading-passage topics (сэдэв). Free text on the backend — the stored value
 * IS the label, so admin + mobile show the same string. Keep in sync with the
 * backend `READING_CATEGORY_SUGGESTIONS` and the mobile list.
 */
export const READING_CATEGORIES: string[] = [
  'Өдөр тутам',
  'Шинжлэх ухаан',
  'Технологи',
  'Түүх',
  'Байгаль',
  'Спорт',
  'Соёл',
  'Аялал',
  'Бизнес',
  'Эрүүл мэнд',
];

/** Topic <select> options for the reading form (incl. an empty "no topic"). */
export const readingCategoryOptions = [
  { value: '', label: 'Сэдэвгүй' },
  ...READING_CATEGORIES.map((v) => ({ value: v, label: v })),
];

/**
 * Exercise sub-categories (сэдэв) per skill. Free text on the backend — the
 * stored value IS the label, so admin + mobile show the same string (mobile
 * groups a skill's exercises by it). Keep in sync with the mobile skill screen.
 */
export const EXERCISE_CATEGORIES: Record<string, string[]> = {
  listening: [
    'Өдөр тутмын яриа',
    'Дуудлага сонсох',
    'Дуу & дууны үг',
    'Кино клип',
    'Подкаст',
    'Мэдээ',
    'Аялал',
    'Сорил',
  ],
  writing: [
    'Өгүүлбэр зохиох',
    'Догол мөр',
    'Эссэ',
    'И-мэйл',
    'Өгүүллэг',
    'Дүрэм засах',
    'Сорил',
  ],
  speaking: [
    'Дуудлага',
    'Дагаж хэлэх',
    'Ярианы дадлага',
    'Дүрд тоглох',
    'Өөрийгөө танилцуулах',
    'Ярилцлага',
    'Аялал',
    'Сорил',
  ],
  fill: [
    'Цаг (tense)',
    'Угтвар үг',
    'Артикль',
    'Үйл үгийн хэлбэр',
    'Үг сонгох',
    'Сорил',
  ],
  grammar: [
    'Цаг (tense)',
    'Тооны ялгаа',
    'Угтвар үг',
    'Артикль',
    'Асуух өгүүлбэр',
    'Үгүйсгэл',
    'Сорил',
  ],
  // Reading uses ReadingPassage (its own сэдэв), but keep it here for symmetry.
  reading: [...READING_CATEGORIES],
};

/** Сэдэв <select> options for one skill's exercise form (incl. empty option). */
export function exerciseCategoryOptions(skill: string) {
  return [
    { value: '', label: 'Сэдэвгүй' },
    ...(EXERCISE_CATEGORIES[skill] ?? []).map((v) => ({ value: v, label: v })),
  ];
}

/**
 * IELTS modules → Quiz `category` value. Objective modules (listening/reading)
 * are auto-scored to a band; writing/speaking are self-study (open_response).
 */
export const IELTS_MODULES = [
  {
    key: 'listening',
    label: 'Listening',
    category: 'ielts_listening',
    objective: true,
    // A Listening paper is four recorded sections, 10 questions each.
    parts: 4,
    partLabel: 'Section',
  },
  {
    key: 'reading',
    label: 'Reading',
    category: 'ielts_reading',
    objective: true,
    /**
     * **3 Passage** — ielts.org-оос баталсан (2026-08-15): Academic Reading нь
     * 3 эх, нийт 40 асуулт, 60 минут. (Хэрэв 4 гэж санагдаж байвал General
     * Training-ийн Section 1 дотроо 2–3 богино эх агуулдагтай холбоотой.)
     */
    parts: 3,
    partLabel: 'Passage',
  },
  {
    key: 'writing',
    label: 'Writing',
    category: 'ielts_writing',
    objective: false,
    // Task 1 (150 words) + Task 2 (250 words).
    parts: 2,
    partLabel: 'Task',
  },
  {
    key: 'speaking',
    label: 'Speaking',
    category: 'ielts_speaking',
    objective: false,
    // Part 1 intro · Part 2 long turn · Part 3 discussion.
    parts: 3,
    partLabel: 'Part',
  },
] as const;

/**
 * IELTS-ийн **сэдэв** — жинхэнэ шалгалтын материал ямар сэдвээр байдаг вэ.
 *
 * ⚠️ Энэ талбар өмнө нь «Band 4.5 … Band 8.0» гэсэн **зорилтот band** байсныг
 * 2026-08-14-нд зассан. Band бол **дүн** — зөв хариултын тооноос сервер дээр
 * `ieltsBand(correct, total)`-оор гарна. Түүнийг контент үүсгэхдээ гараар
 * сонгож, сурагчид ангилал болгож харуулах нь буруу байв: «Band 6.5» гэсэн
 * бүлгээс дасгал сонгосон хүн юу ч хийсэн 6.5 авахгүй, харин ямар оноо авахаа
 * урьдчилж мэдсэн мэт ойлголт төрүүлдэг.
 *
 * ⚠️ IELTS-д **CEFR түвшин ч байхгүй** (2026-08-14). Жинхэнэ шалгалт бүх
 * шалгуулагчид ижил байдаг — «B1-ийн Listening» гэж үгүй. Ялгаа нь зөвхөн
 * хэдийг зөв бөглөснөөс гарах band. Сэдэв нь жинхэнэ шалгалтын адил агуулгын
 * салбар, түүнээс өөр ангилах тэнхлэг байхгүй.
 */
const IELTS_TOPICS: Record<string, string[]> = {
  // Listening: Section 1–2 нь өдөр тутмын нөхцөл, 3–4 нь боловсрол/лекц.
  listening: [
    'Housing & accommodation',
    'Travel & transport',
    'Education & campus life',
    'Work & employment',
    'Health & lifestyle',
    'Services & bookings',
    'Academic lecture',
  ],
  reading: [
    'Science & research',
    'History & archaeology',
    'Environment & climate',
    'Technology & innovation',
    'Society & culture',
    'Business & economics',
    'Health & medicine',
  ],
  writing: [
    'Task 1 — chart / graph',
    'Task 1 — process / map',
    'Task 2 — opinion',
    'Task 2 — discussion',
    'Task 2 — problem & solution',
  ],
  speaking: [
    'Part 1 — familiar topics',
    'Part 2 — long turn (cue card)',
    'Part 3 — discussion',
  ],
};

/** Сэдвийн <select> сонголтууд (хоосон сонголттой хамт). */
export function ieltsSubTopicOptions(moduleKey: string) {
  return [
    { value: '', label: 'Сэдэв сонгоогүй' },
    ...(IELTS_TOPICS[moduleKey] ?? []).map((v) => ({ value: v, label: v })),
  ];
}

/**
 * Бүтэн шалгалтад хэдэн асуулт үүсэх вэ — backend-ийн `paperPlan()`-тай ЯГ
 * таарна. Listening/Reading нь 4 хэсэг × 10 = 40; Writing/Speaking нь задгай
 * хариулттай тул цөөн даалгавартай.
 */
export const PAPER_QUESTION_COUNT: Record<string, number> = {
  listening: 40,
  reading: 40,
  writing: 2,
  speaking: 9,
};
