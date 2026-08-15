/**
 * IELTS shared constants + band scoring.
 *
 * Content model (Approach A): IELTS content is a normal Quiz tagged with one of
 * these categories. Objective modules (listening/reading) are auto-scored into
 * an approximate band; writing/speaking are self-study (no score).
 */
export const IELTS_CATEGORIES = {
  listening: 'ielts_listening',
  reading: 'ielts_reading',
  writing: 'ielts_writing',
  speaking: 'ielts_speaking',
} as const;

/**
 * Most parts a single practice set can be split into.
 *
 * Listening is the widest real module (4 sections); Academic Reading has 3
 * passages. Questions carry a `section` number in the `questions` jsonb — see
 * `BaseQuestionDto`.
 */
export const MAX_SECTIONS = 4;

/** Жинхэнэ IELTS шалгалтын асуултын тоо (Listening ба Reading хоёулаа). */
export const FULL_PAPER_QUESTIONS = 40;

/** Categories whose submissions get an auto band (objective answers). */
export const IELTS_OBJECTIVE_CATEGORIES: readonly string[] = [
  IELTS_CATEGORIES.listening,
  IELTS_CATEGORIES.reading,
];

/**
 * Түүхий оноо → band хүснэгт (40 асуулттай шалгалт).
 *
 * **Албан ёсны цэгүүд** (ielts.org → "IELTS scoring in detail", 2026-08-15-нд
 * шалгасан) — доорх хүснэгт эдгээртэй ЯГ таарна:
 *
 * | Band | Listening | Academic Reading |
 * | ---- | --------- | ---------------- |
 * | 5    | 16        | 15               |
 * | 6    | 23        | 23               |
 * | 7    | 30        | 30               |
 * | 8    | 35        | 35               |
 *
 * ⚠️ IELTS нь **зөвхөн эдгээр 4 цэгийг** нийтэлдэг бөгөөд «шалгалтын
 * хувилбар бүрд бага зэрэг өөр байж болно» гэж тусгайлан хэлсэн байдаг.
 * Хагас band-ууд (5.5 · 6.5 …) албан ёсоор нийтлэгддэггүй тул эдгээр нь
 * дадлагын хүснэгтүүдэд түгээмэл хэрэглэгддэг **интерполяци** — ойролцоо
 * гэдгийг аппад ч «Дасгалын урт богино тул ойролцоо band» гэж хэлдэг.
 *
 * `[хамгийн бага зөв, band]` — буурах эрэмбээр, хангасан хамгийн эхнийх нь ялна.
 */
const BAND_TABLE: Record<'listening' | 'reading', [number, number][]> = {
  listening: [
    [39, 9.0],
    [37, 8.5],
    [35, 8.0],
    [32, 7.5],
    [30, 7.0],
    [26, 6.5],
    [23, 6.0],
    [18, 5.5],
    [16, 5.0],
    [13, 4.5],
    [10, 4.0],
    [8, 3.5],
    [6, 3.0],
    [4, 2.5],
    [3, 2.0],
    [2, 1.5],
    [1, 1.0],
  ],
  reading: [
    [39, 9.0],
    [37, 8.5],
    [35, 8.0],
    [33, 7.5],
    [30, 7.0],
    [27, 6.5],
    [23, 6.0],
    [19, 5.5],
    [15, 5.0],
    [13, 4.5],
    [10, 4.0],
    [8, 3.5],
    [6, 3.0],
    [4, 2.5],
    [3, 2.0],
    [2, 1.5],
    [1, 1.0],
  ],
};

/** Аль хүснэгтээр тооцох вэ — ангиллаас. Reading биш бүхэн Listening-ийнх. */
function bandTableFor(category?: string | null): [number, number][] {
  return category === IELTS_CATEGORIES.reading
    ? BAND_TABLE.reading
    : BAND_TABLE.listening;
}

/**
 * IELTS band (0–9, хагас алхмаар) — **албан ёсны хүснэгтээр**.
 *
 * Жинхэнэ шалгалт 40 асуулттай. Манай дасгал түүнээс бага байвал түүхий оноог
 * нь 40-д **шилжүүлж** (`correct / total × 40`) хүснэгтээс уншина: 20
 * асуултын 15 нь 40-ийн 30-тай тэнцэнэ → Listening 7.0. Ингэснээр богино
 * дасгал ч жинхэнэ шалгалттай ижил хэмжүүртэй болно.
 *
 * ⚠️ 40 асуулттай бүтэн шалгалтад шилжүүлэлт нь ямар ч нөлөөгүй (×1) —
 * тэр үед хүснэгт нь шууд, яг албан ёсоор нь ажиллана.
 */
export function ieltsBand(
  correct: number,
  total: number,
  category?: string | null,
): number {
  if (total <= 0 || correct <= 0) return 0;
  const raw =
    total === FULL_PAPER_QUESTIONS
      ? correct
      : Math.round((correct / total) * FULL_PAPER_QUESTIONS);

  for (const [min, band] of bandTableFor(category)) {
    if (raw >= min) return band;
  }
  return 0;
}

/**
 * ⚠️ Энд өмнө нь `IELTS_BAND_TOPICS`, `parseBandTopic()`, `bandToLevel()`
 * байсныг 2026-08-14-нд УСТГАВ.
 *
 * Тэдгээр нь контент үүсгэхэд «зорилтот band»-ыг `topic` талбарт хадгалж,
 * сурагчид түүгээр нь ангилж харуулдаг байв. Band бол **дүн**: доорх
 * `ieltsBand(correct, total)` нь зөв хариултын тооноос гаргадаг, тэр л цорын
 * ганц эх сурвалж. Зорилтот band-ыг урьдчилж сонгуулах нь «Band 6.5 гэсэн
 * бүлгээс сонговол 6.5 авна» гэсэн худал ойлголт төрүүлдэг.
 *
 * Хүндрэл = `Quiz.level` (CEFR), сэдэв = `Quiz.topic` (жинхэнэ агуулгын салбар).
 */

/**
 * Хэсгүүдийн бичвэрийг нэг талбарт хадгалах тэмдэглэгээ.
 *
 * `Quiz.passageText` нь ганц багана тул бүтэн шалгалтын 4 сонсох яриа (эсвэл
 * 3 уншлагын эх) нэг мөрөнд багтах ёстой. Апп үүгээр таслаад тухайн хэсгийн
 * бичвэрийг л харуулна — жинхэнэ шалгалтын адил, 2-р хэсэг дээр 4-ийн эхийг
 * харуулахгүй. Админ гараар бичихэд ч ойлгомжтой байхаар сонгосон.
 */
export const SECTION_MARK = (n: number, label: string): string =>
  `--- ${label} ${n} ---`;

/** Нэг хэсгийн AI жор: хэдэн асуулт, ямар нөхцөл. */
export interface PaperSectionPlan {
  section: number;
  count: number;
  /** AI-д өгөх нөхцөлийн тайлбар (жинхэнэ шалгалтын бүтцээр). */
  brief: string;
  /** Задгай хариулттай хэсэг үү (Writing/Speaking) — өөрөө үнэлдэг. */
  openResponse?: boolean;
}

export type IeltsModuleKey = 'listening' | 'reading' | 'writing' | 'speaking';

/** Модуль бүрийн хэсгийн нэршил — гарчигт ч, аппын таб дээр ч энэ гарна. */
export const PART_LABEL: Record<IeltsModuleKey, string> = {
  listening: 'Section',
  reading: 'Passage',
  writing: 'Task',
  speaking: 'Part',
};

/**
 * Бүтэн шалгалтын жор — модуль бүрийн жинхэнэ бүтцээр.
 *
 * Listening 4 Section × 10 = 40, Reading 3 Passage (13+13+14) = 40 — хоёулаа
 * ielts.org дээрх албан ёсны бүтэц. Writing 2 Task, Speaking 3 Part нь **задгай хариулттай** — тэдгээрт
 * оноо байхгүй, жишиг хариулттай харьцуулж өөрөө үнэлдэг тул асуултын тоо ч
 * бага (Task 1 = нэг даалгавар).
 */
export function paperPlan(moduleKey: IeltsModuleKey): PaperSectionPlan[] {
  if (moduleKey === 'listening') {
    return [
      {
        section: 1,
        count: 10,
        brief:
          'Section 1: хоёр хүний ӨДӨР ТУТМЫН харилцан яриа (захиалга, бүртгэл, ' +
          'лавлагаа). Нэр, тоо, огноо, хаяг зэрэг тодорхой мэдээлэл агуулна.',
      },
      {
        section: 2,
        count: 10,
        brief:
          'Section 2: нэг хүний МОНОЛОГ өдөр тутмын сэдвээр (аялалын танилцуулга, ' +
          'байгууламжийн заавар, зар мэдээ).',
      },
      {
        section: 3,
        count: 10,
        brief:
          'Section 3: 2–3 оюутан/багшийн ЭРДЭМ ШИНЖИЛГЭЭНИЙ хэлэлцүүлэг ' +
          '(судалгааны төсөл, даалгавар, арга зүй).',
      },
      {
        section: 4,
        count: 10,
        brief:
          'Section 4: их сургуулийн ЛЕКЦ — нэг хүний эрдэм шинжилгээний монолог, ' +
          'хамгийн хийсвэр, хамгийн хүнд хэсэг.',
      },
    ];
  }

  if (moduleKey === 'reading') {
    // ielts.org: Academic Reading = **3 эх**, нийт 40 асуулт, 60 минут.
    return [
      {
        section: 1,
        count: 13,
        brief: 'Passage 1: ерөнхий сонирхлын, хамгийн хялбар эх.',
      },
      {
        section: 2,
        count: 13,
        brief: 'Passage 2: ажил/боловсролын сэдэвтэй, дунд зэргийн эх.',
      },
      {
        section: 3,
        count: 14,
        brief:
          'Passage 3: эрдэм шинжилгээний, хийсвэр маргаантай, хамгийн хүнд эх.',
      },
    ];
  }

  if (moduleKey === 'writing') {
    return [
      {
        section: 1,
        count: 1,
        openResponse: true,
        brief:
          'Writing Task 1: өгөгдсөн график/хүснэгт/диаграм/процессыг тайлбарлах ' +
          'даалгавар (150 үг). Даалгаврын бичвэрт юуг тайлбарлахыг тодорхой зааж, ' +
          'жишиг хариултыг нь бүтнээр бич.',
      },
      {
        section: 2,
        count: 1,
        openResponse: true,
        brief:
          'Writing Task 2: маргаантай сэдвээр эссэ (250 үг) — санал нийлэх эсэх, ' +
          'давуу/сул тал, эсвэл асуудал/шийдэл. Жишиг эссэг бүтнээр бич.',
      },
    ];
  }

  return [
    {
      section: 1,
      count: 4,
      openResponse: true,
      brief:
        'Speaking Part 1: танил сэдвээр (гэр бүл, ажил, хоол, чөлөөт цаг) богино ' +
        'асуултууд. Асуулт бүрд 2–3 өгүүлбэрийн жишиг хариулт бич.',
    },
    {
      section: 2,
      count: 1,
      openResponse: true,
      brief:
        'Speaking Part 2: cue card — «Describe a…» гэсэн даалгавар, дагалдах 3–4 ' +
        'цэгтэй. 1–2 минут ярих жишиг хариултыг бүтнээр бич.',
    },
    {
      section: 3,
      count: 4,
      openResponse: true,
      brief:
        'Speaking Part 3: Part 2-ын сэдвээс үргэлжилсэн ХИЙСВЭР хэлэлцүүлгийн ' +
        'асуултууд (нийгэм, хандлага, ирээдүй). Жишиг хариулт бүрд шалтгаан дурд.',
    },
  ];
}

/** Тухайн модулийн бүтэн шалгалтад хэдэн асуулт байх вэ. */
export function paperQuestionCount(moduleKey: IeltsModuleKey): number {
  return paperPlan(moduleKey).reduce((sum, p) => sum + p.count, 0);
}
