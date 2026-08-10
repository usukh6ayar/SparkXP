/**
 * "Бүх төрлөөр үүсгэх" — нэг товчоор бүхэл түвшний контент бэлдэх цөм.
 *
 * Ялгаа нь `ai-generate.ts`-ээс: тэр нь **нэг** дасгалыг админы бичсэн
 * агуулгаас үүсгэдэг; энэ нь **агуулга бичихгүйгээр** олон дасгалыг
 * (төрөл × N) төлөвлөж, давхардлаас хамгаална.
 *
 * Энд зөвхөн цэвэр функцууд (сүлжээ/DB хөндөхгүй) — `QuizzesService` эдгээрийг
 * ашиглаад Gemini рүү бодит дуудлагыг хийнэ.
 */

/** Нэг ажлын мөр: аль төрөлд, ямар сэдвээр, хэд дэх дасгал. */
export interface BulkStep {
  /** `Quiz.category` — ж: 'listening' · 'soril' · 'ielts_reading'. */
  category: string;
  /** Админд харагдах нэр — ж: "Сонсгол". Явцад ч, prompt-д ч ашиглана. */
  label: string;
  /** `Quiz.topic` — апп дасгалуудыг үүгээр бүлэглэдэг. `null` = сэдэвгүй. */
  topic: string | null;
  /** Тухайн сэдэв доторх дугаар (1-ээс) — AI-д "өөр өнцгөөр бич" гэж хэлнэ. */
  nth: number;
  questionType?: string;
  /** Сорилын тоглоомын төрөл — хадгалахад `Quiz.quizType` болно. */
  quizType?: string;
  contextNote?: string;
}

/** Админаас ирэх нэг төрөл (Сонсгол · Үг таах · IELTS Reading …). */
export interface BulkTarget {
  category: string;
  label: string;
  /** Тараах сэдвүүд. Хоосон бол сэдэвгүй дасгал болно. */
  topics?: string[];
  questionType?: string;
  quizType?: string;
  contextNote?: string;
}

export const MAX_PER_TARGET = 10;
export const MAX_TARGETS = 10;
/** Нэг ажилд үүсгэх дасгалын дээд тоо — AI зарцуулалтын хамгаалалт. */
export const MAX_TOTAL_STEPS = 100;

/**
 * Төрөл бүрт `perTarget` ширхэг дасгалыг **сэдвүүд рүү ээлжлүүлж** тараана.
 *
 * Яагаад ээлжлүүлэх вэ: апп дасгалуудыг `topic`-оор нь бүлэглэж харуулдаг
 * (`mobile/app/skill/[key].tsx`). Бүгдийг нэг сэдэвт хийвэл нэг бүлэг хавдаж,
 * бусад нь хоосон үлдэнэ. Ээлжлүүлснээр агуулга нь ч олон янз болно.
 */
export function planSteps(
  targets: BulkTarget[],
  perTarget: number,
): BulkStep[] {
  const steps: BulkStep[] = [];
  for (const t of targets) {
    const topics = (t.topics ?? []).map((s) => s.trim()).filter(Boolean);
    // Тухайн сэдвийг хэдэн удаа ашигласныг тоолно (prompt-д "n дэх" гэж явна).
    const used = new Map<string, number>();
    for (let i = 0; i < perTarget; i++) {
      const topic = topics.length ? topics[i % topics.length] : null;
      const key = topic ?? '';
      const nth = (used.get(key) ?? 0) + 1;
      used.set(key, nth);
      steps.push({
        category: t.category,
        label: t.label,
        topic,
        nth,
        // Ангиллын жор ялгааг нь мэднэ; админы заасан төрөл зөвхөн жоргүй
        // ангилалд (Сорилын тоглоом, IELTS) хүчинтэй. Форматыг AI-д чөлөөтэй
        // сонгуулах нь хариулах боломжгүй дасгал үүсгэдэг байсан.
        questionType: recipeFor(t.category, nth)?.questionType ?? t.questionType,
        quizType: t.quizType,
        contextNote: t.contextNote,
      });
    }
  }
  return steps;
}

/**
 * Давхардал шалгах түлхүүр — жижиг үсэг, цэг таслал, давхар зайг арилгана.
 * "She ___ to school." ба "she ___ to school" хоёрыг нэг гэж үзнэ.
 */
export function dedupKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prompt-д багтаах "битгий давт" гарчгийн дээд тоо (токен хэмнэнэ). */
const MAX_AVOID_TITLES = 25;

/**
 * Ангилал тус бүрийн "жор" — ямар форматтай байх, ямар дүрэм баримтлах.
 *
 * ⚠️ Энэ бол хамгийн чухал хэсэг. Форматыг AI-д чөлөөтэй сонгуулахад дүрмийн
 * дасгал нь `fill_blank` болж "She ___ to school every day." → `goes` гэсэн
 * **хариулах боломжгүй** асуулт үүсгэж байв: `walks` · `runs` · `drives` бүгд
 * зөв англи мөртлөө зөвхөн нэг нь тэнцдэг. Сурагч таамаглахаас өөр аргагүй.
 *
 * Тиймээс ангилал бүр өөрийн форматтай, өөрийн чанга дүрэмтэй:
 * зөв хариулт нь **цорын ганц** байхаар.
 */
interface CategoryRecipe {
  questionType: string;
  /** Prompt-д нэмэх дүрмүүд. */
  rules: string[];
}

/**
 * Сонсголын дасгалын **хэлбэрүүд**. Нэг л хэлбэр (сонсоод асуултанд хариулах)
 * байсан нь уйтгартай байсан тул дасгал бүр ээлжлэн өөр байна.
 *
 * ⚠️ Хоёулаа `passageText`-д богино ЯРИА бичүүлнэ: нэг өгүүлбэр сонсох нь
 * дасгал болохооргүй богино байсан. Апп тэр яриаг дуугаар уншиж, бичвэрийг
 * нь хариулах хүртэл нуудаг (`app/quiz/[id].tsx`).
 */
const LISTENING_VARIANTS: CategoryRecipe[] = [
  {
    // ① Ойлголт шалгах — яриа сонсоод хэн/хаана/хэзээ/юу гэдгийг хариулна.
    questionType: 'multiple_choice',
    rules: [
      'Энэ бол СОНСГОЛЫН дасгал. `passageText` талбарт 2 хүний хоорондох ' +
        '3–5 мөрт БОГИНО ЯРИА бич (ж: "A: Hi Tom, how are you?\nB: I am fine, thanks.").',
      'Сурагч энэ яриаг зөвхөн СОНСоно — уншихгүй (апп дуугаар уншина).',
      'Асуултууд нь тэр яриаг ойлгосон эсэхийг шалгана: хэн, хаана, хэзээ, юу хийсэн.',
      'Бичгээр л ялгагдах зүйл (зөв бичих дүрэм, цэг таслал) шалгаж БОЛОХГҮЙ — ' +
        'сонсоод ялгах боломжгүй.',
      'Яриа нь чангаар уншихад байгалийн сонсогдох, өдөр тутмын хэллэг байх.',
    ],
  },
  {
    // ② Сонсоод нөхөх — сонссон өгүүлбэрийн дутуу үгийг олно (диктант маягийн).
    questionType: 'fill_blank',
    rules: [
      'Энэ бол СОНСООД НӨХӨХ дасгал. `passageText` талбарт 3–5 мөрт БОГИНО ЯРИА бич.',
      'Сурагч яриаг СОНСоод, доорх өгүүлбэрүүдийн дутуу үгийг нөхнө.',
      '`question` бүр нь тэр яриан дотор БОДИТООР гарсан өгүүлбэр байх ба ' +
        'нэг үгийг нь `___` болгож нуусан байна.',
      '`answer` нь тэр нуусан үг; `choices`-д зөв хариулт + сонсоход ойролцоо ' +
        'сонсогдох 3 үг (ж: "fine" → ["fine", "find", "five", "fun"]).',
    ],
  },
];

const RECIPES: Record<string, CategoryRecipe> = {
  grammar: {
    // Дүрэм = аль хэлбэр нь зөв бэ. Сонголт өгвөл юуг шалгаж буй нь тодорхой.
    questionType: 'multiple_choice',
    rules: [
      'Энэ бол ДҮРМИЙН дасгал. Асуулт бүр ЯГ НЭГ дүрмийн зүйлийг шалгана.',
      'Дөрвөн сонголт нь НЭГ ЛҮ үгийн өөр хэлбэрүүд байна (ж: go / goes / going / went).',
      'Өөр өөр утгатай үг сонголт болгож БОЛОХГҮЙ — тэгвэл дүрэм биш, үгийн сан шалгасан болно.',
      'Өгүүлбэрийн үлдсэн хэсэг нь зөв хэлбэрийг ганцхан болгож тодорхойлох ёстой ' +
        '(ж: "every day" → энгийн одоо цаг, "yesterday" → өнгөрсөн цаг).',
    ],
  },
  fill: {
    questionType: 'fill_blank',
    rules: [
      'Цоорхойд орох хариулт нь ЦОРЫН ГАНЦ байх ёстой.',
      'Үүнийг хангахын тулд цоорхойн ард үндсэн хэлбэрийг хаалтанд бич: ' +
        '"She ___ (go) to school every day." → answer: "goes".',
      'Хаалтгүй орхивол өөр үг ч зөв болох тул сурагч таамаглана — тэгэж БОЛОХГҮЙ.',
    ],
  },
  writing: {
    // ⚠️ `open_response` БИШ: аппын дасгалын runner түүнийг харуулж чаддаггүй
    // (`app/quiz/[id].tsx`-д зөвхөн mc/fill_blank/word_match салбар бий).
    questionType: 'multiple_choice',
    rules: [
      'Энэ бол БИЧГИЙН дасгал: зөв бичсэн өгүүлбэрийг таниулах, алдааг олуулах.',
      'Дөрвөн сонголт нь ижил санааг илэрхийлсэн дөрвөн өгүүлбэр байх ба ' +
        'ЗӨВХӨН НЭГ нь дүрэм, үгийн дараалал, цэг таслалын хувьд зөв байна.',
      'Буруу гурав нь монгол сурагчийн бодит түгээмэл алдаан дээр суурилсан байх.',
    ],
  },
};

/**
 * Ангиллын жор. Танихгүй ангилалд (ж: Сорилын тоглоом, IELTS) `null` —
 * тэдгээр нь өөрсдийн `questionType`-ыг админаас дамжуулдаг.
 *
 * `nth` нь сонсголын хэлбэрийг ээлжлүүлнэ — 10 дасгал үүсгэхэд тал нь ойлголт
 * шалгах, тал нь сонсоод нөхөх болж, нэг хэвийн байдал арилна.
 */
export function recipeFor(category: string, nth = 1): CategoryRecipe | null {
  if (category === 'listening') {
    return LISTENING_VARIANTS[(nth - 1) % LISTENING_VARIANTS.length];
  }
  return RECIPES[category] ?? null;
}

/**
 * Агуулга бичихгүйгээр AI-д өгөх даалгавар.
 *
 * Гурван зүйлийг хэлж өгнө: (1) ямар ур чадвар/сэдэв, (2) хэддэх дасгал болох
 * (тул өөр өнцгөөс бич), (3) аль хэдийн байгаа гарчгууд — давхцуулахгүйн тулд.
 */
export function buildStepBrief(step: BulkStep, avoidTitles: string[]): string {
  const lines = [
    `"${step.label}" ур чадварын дасгал.`,
    step.topic
      ? `Сэдэв: "${step.topic}".`
      : 'Сэдвийг агуулгад тохируулан өөрөө сонго.',
  ];

  // Ангиллын чанга дүрмүүд. Эдгээргүйгээр AI хариулах боломжгүй дасгал
  // үүсгэдэг байсан — дэлгэрэнгүйг `RECIPES`-ийн тайлбараас үз.
  const recipe = recipeFor(step.category, step.nth);
  if (recipe) lines.push('', ...recipe.rules.map((r) => `- ${r}`), '');

  if (step.nth > 1) {
    lines.push(
      `Энэ бол энэ сэдвээрх ${step.nth} дэх дасгал — өмнөхөөсөө ӨӨР үгсийн сан, ` +
        'өөр нөхцөл байдал, өөр өнцгөөс бич. Ижил асуултыг өөр үгээр бичихгүй.',
    );
  }

  const avoid = avoidTitles.slice(0, MAX_AVOID_TITLES);
  if (avoid.length) {
    lines.push(
      '',
      'Аль хэдийн байгаа дасгалууд (агуулга нь ДАВХЦАХГҮЙ байх, гарчиг нь ч өөр байх):',
      ...avoid.map((t) => `- ${t}`),
    );
  }

  return lines.join('\n');
}

/**
 * Асуултаас давхардал шалгах текстийг гаргана. Хадгалагдсан мөр ба AI-гийн
 * шинэ ноорог хоёулаа ижил хэлбэртэй тул нэг функц хоёуланд нь тохирно.
 */
export function questionText(q: unknown): string {
  const o = (q ?? {}) as {
    type?: string;
    question?: string;
    prompt?: string;
    pairs?: { left?: string }[];
  };
  if (o.type === 'word_match') {
    return (o.pairs ?? []).map((p) => p?.left ?? '').join('|');
  }
  if (o.type === 'open_response') return o.prompt ?? '';
  return o.question ?? '';
}

/** Цоорхойн сонголтын тоо — сурагч 4 товчийн нэгийг дарна. */
export const FILL_CHOICE_COUNT = 4;

/**
 * Цоорхойн сонголтуудыг цэгцэлнэ: зөв хариулт заавал багтаж, давхардалгүй,
 * дөрөвөөр хязгаарлагдаж, холигдоно.
 *
 * Хамгийн чухал шалгуур нь **зөв хариулт дотор нь байх**: AI хэрэв түүнийг
 * орхивол сурагч дөрвөн буруу хувилбараас сонгох болно. Тийм тохиолдолд
 * хариултыг албаар оруулна (санамсаргүй байрлалд).
 *
 * Хоёроос цөөн бол `null` — нэг сонголт нь хариулт өөрөө болох тул утгагүй,
 * апп бичих талбар руугаа буцна.
 */
export function normalizeChoices(
  raw: unknown,
  answer: string,
): string[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter(Boolean);

  const target = answer.trim();
  // Жижиг/том үсгийн ялгаагаар давхардуулахгүй (шалгалт нь ч том/жижиг ялгадаггүй).
  const seen = new Map<string, string>();
  for (const c of [target, ...cleaned]) {
    if (!seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }

  const list = [...seen.values()].slice(0, FILL_CHOICE_COUNT);
  if (list.length < 2) return null;

  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * `fill_blank` дасгалын **үгийн сан** — тухайн дасгалын бүх хариултыг холиод
 * нэг жагсаалт болгоно.
 *
 * Яагаад хэрэгтэй вэ: цоорхойг гараар бичих нь сурагчид хэт хэцүү байв —
 * зөв санааг олсон ч үсэг алдвал буруу гэж тооцогдоно. Санг өгснөөр сурагч
 * **дарж сонгоно**: бичих ачаалал ч, таамаглал ч алга.
 *
 * Холисон нийт жагсаалт учир аль үг аль асуултынх болох нь ил болохгүй.
 * Хоёроос цөөн үгтэй бол сан утгагүй (ганц сонголт = хариулт) → `null`,
 * апп бичих талбар руугаа буцна.
 */
export function buildWordBank(questions: unknown[]): string[] | null {
  const answers = (questions ?? [])
    .map((q) => (q ?? {}) as { type?: string; answer?: unknown })
    .filter((q) => q.type === 'fill_blank' && typeof q.answer === 'string')
    .map((q) => (q.answer as string).trim())
    .filter(Boolean);

  const unique = [...new Set(answers)];
  if (unique.length < 2) return null;

  // Тогтмол биш дараалал: эх дараалал нь асуултын дарааллыг задлах байсан.
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique;
}

/** Нэг алхмыг тайлбарлах богино нэр — явц болон алдааны жагсаалтад харагдана. */
export function stepName(step: BulkStep): string {
  return step.topic
    ? `${step.label} · ${step.topic} #${step.nth}`
    : `${step.label} #${step.nth}`;
}

/** Background ажлын явц — админ 2.5 секунд тутам татаж харуулна. */
export interface BulkGenerateReport {
  /** Нийт үүсгэхээр төлөвлөсөн дасгал. */
  total: number;
  /** Оролдсон (амжилттай + бүтэлгүй). */
  processed: number;
  /** DB-д хадгалагдсан дасгал. */
  created: number;
  /** Үүсгэсэн боловч давхардлаас болж хаягдсан. */
  skipped: number;
  failed: { key: string; message: string }[];
  done: boolean;
  canceled?: boolean;
  /** Одоо юун дээр ажиллаж байна — админд "Сонсгол · Аялал #2" гэж харагдана. */
  current?: string;
}
