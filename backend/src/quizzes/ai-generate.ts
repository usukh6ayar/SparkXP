/**
 * AI дасгал/quiz/IELTS үүсгэгчийн цөм — prompt бэлдэх · Gemini schema ·
 * хариуг задлаад чанарыг нь шалгах.
 *
 * Яагаад нэг файл гурвуулангийнх вэ: Дасгал, хичээлийн Quiz, IELTS гурвуулаа
 * **нэг `Quiz` entity** (ялгаа нь зөвхөн `lessonId` + `category`). Тиймээс
 * үүсгэх логик ч нэг л удаа бичигдэнэ (CODING_RULES §0.2 DRY).
 *
 * Энд зөвхөн цэвэр функцууд байна (сүлжээ/DB хөндөхгүй) — үүнийг тусад нь
 * уншиж, тестлэж болно. Gemini рүү бодит дуудлагыг `QuizzesService` хийнэ.
 */

/** Асуултын формат — `QuizQuestionsEditor` (admin) -тэй яг ижил 4 төрөл. */
export type GenQuestionType =
  'multiple_choice' | 'fill_blank' | 'word_match' | 'open_response';

/** Үүсгэсэн контент хаашаа очих вэ. */
export type TargetKind = 'exercise' | 'lesson' | 'ielts';

/** Хадгалахад бэлэн асуултууд — `CreateQuizDto`-гийн хэлбэртэй тохирно. */
export type GeneratedQuestion =
  | {
      type: 'multiple_choice';
      question: string;
      options: string[];
      correct: number;
      points: number;
    }
  | { type: 'fill_blank'; question: string; answer: string; points: number }
  | {
      type: 'word_match';
      pairs: { left: string; right: string }[];
      points: number;
    }
  | {
      type: 'open_response';
      prompt: string;
      modelAnswer: string;
      bandNote?: string;
    };

export interface GenerateOptions {
  /** Админы бичсэн чөлөөт агуулга — "юу үүсгэхийг" тайлбарласан текст. */
  brief: string;
  kind: TargetKind;
  /** Quiz.category — ж: 'listening' · 'Дүрэм' · 'ielts_reading'. */
  category?: string;
  /** Quiz.topic (сэдэв) — хоосон бол AI өөрөө санал болгоно. */
  topic?: string;
  /** Хоосон бол AI өөрөө таамаглана. */
  level?: string;
  questionType?: GenQuestionType;
  count?: number;
  /** IELTS Reading — өгсөн эх бичвэр. Хоосон бол AI өөрөө зохионо. */
  passageText?: string;
  /**
   * Prompt-д нэмэх нэмэлт контекст — ж: хичээлийн тайлбар, сорилын тоглоомын
   * төрөл. Админы хуудас өөрт байгаа мэдээллээ эндүүр дамжуулна.
   */
  contextNote?: string;
}

/** AI-гаас гарч ирсэн, админ засахад бэлэн ноорог. */
export interface GeneratedDraft {
  title: string;
  level: string;
  questionType: GenQuestionType;
  topic: string | null;
  passageText: string | null;
  questions: GeneratedQuestion[];
  /** Чанарын шалгуурт илэрсэн анхааруулга (админд улаанаар харагдана). */
  warnings: string[];
}

export const MAX_QUESTION_COUNT = 20;
const DEFAULT_COUNT = 10;
const VALID_TYPES: GenQuestionType[] = [
  'multiple_choice',
  'fill_blank',
  'word_match',
  'open_response',
];
const VALID_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

// ─────────────────────────── Prompt ───────────────────────────

/** Асуултын төрөл бүрийн бичих дүрэм — prompt дотор шууд орно. */
const TYPE_RULES: Record<GenQuestionType, string> = {
  multiple_choice:
    '"multiple_choice": `question` (англи асуулт), `options` (ЯГ 4 ялгаатай хувилбар), ' +
    '`correct` (зөв хувилбарын 0-ээс эхэлсэн индекс). Буруу хувилбарууд нь итгэмээр байх ' +
    '(санамсаргүй биш, сурагчийн түгээмэл алдаан дээр суурилсан).',
  fill_blank:
    '"fill_blank": `question` дотор орхигдсон үгийн оронд ЗААВАЛ `___` (3 доогуур зураас) байна. ' +
    '`answer` нь тэр цоорхойд орох ЯГ нэг үг эсвэл богино хэллэг.',
  word_match:
    '"word_match": `pairs` массив — `left` = англи үг/хэллэг, `right` = монгол утга. 5–8 хос.',
  open_response:
    '"open_response": `prompt` (даалгаврын текст), `modelAnswer` (жишиг хариулт), ' +
    '`bandNote` (заавал биш — band/үнэлгээний тайлбар).',
};

/** Target kind тус бүрийн нэмэлт контекст. */
function kindContext(o: GenerateOptions): string {
  if (o.kind === 'ielts') {
    const module = (o.category ?? '').replace('ielts_', '') || 'reading';
    return (
      `Энэ бол IELTS-ийн ${module.toUpperCase()} модулийн бэлтгэл материал. ` +
      'Жинхэнэ IELTS шалгалтын хэв маяг, хэл найруулга, хүндрэлийн түвшинг баримтал.'
    );
  }
  if (o.kind === 'lesson') {
    return (
      'Энэ бол тодорхой хичээлийн дараах шалгах тест. Хичээлийн агуулгад ' +
      'шууд тулгуурласан асуулт бич.'
    );
  }
  const skill = o.category ?? '';
  return skill
    ? `Энэ бол бие даасан "${skill}" ур чадварын дасгал.`
    : 'Энэ бол бие даасан дасгал.';
}

/**
 * Gemini рүү явуулах prompt. Түвшин/төрөл/тоо өгөгдөөгүй бол AI өөрөө сонгоод
 * буцаана (админ дараа нь preview дээр засна) — энэ нь "агуулгаа бичихэд AI
 * өөрөө таних" урсгал.
 */
export function buildPrompt(o: GenerateOptions): string {
  const type = o.questionType;
  const rules = type
    ? TYPE_RULES[type]
    : VALID_TYPES.map((t) => TYPE_RULES[t]).join('\n  - ');

  const lines = [
    'Чи бол монгол сурагчдад англи хэл заадаг туршлагатай багш, шалгалтын материал зохиогч.',
    '',
    kindContext(o),
    ...(o.contextNote ? [`Нэмэлт контекст: ${o.contextNote.trim()}`] : []),
    '',
    `АДМИНЫ ХҮСЭЛТ (үүн дээр үндэслэ):\n"""\n${o.brief.trim()}\n"""`,
    '',
    'ДҮРЭМ:',
    '- Асуултын текст англи хэл дээр. Монгол хэлийг зөвхөн орчуулга шаардсан газар (word_match-ийн `right`) ашигла.',
    '- Асуулт бүр өөр өөр байх — утга давхардуулж болохгүй.',
    '- Дүрмийн болон утгын алдаагүй, байгалийн англи хэл бич.',
    // ⚠️ Урт хязгаарлалт: эдгээргүй бол загвар нэг асуултын оронд бүтэн
    // догол мөр бичиж, сурагчид уншихад хэцүү болгодог.
    '- Асуулт бүр ЯГ НЭГ өгүүлбэр, 120 тэмдэгтээс богино байна.',
    '- Сонголт бүр 40 тэмдэгтээс богино, ганц үг эсвэл богино хэллэг байна.',
    // ⚠️ Загвар бодлоо гаралт руугаа асгаж JSON-ыг эвддэг байсны эсрэг.
    '- Тайлбар, эргэцүүлэл, "би одоо ингэж бодож байна" гэх мэт зүйл БИЧИХГҮЙ.',
    '- Markdown, ``` хашилт БИЧИХГҮЙ. Зөвхөн цэвэр JSON объект буцаа.',
    `- Асуултын формат:\n  - ${rules}`,
  ];

  lines.push(
    type
      ? `- Бүх асуулт "${type}" төрлийн байх.`
      : '- Агуулгад хамгийн тохирох НЭГ төрлийг сонгоод бүх асуултыг тэр төрлөөр бич.',
  );
  lines.push(
    o.level
      ? `- CEFR түвшин: ${o.level.toUpperCase()}.`
      : '- Агуулгад тохирох CEFR түвшинг (a1–c2) өөрөө сонго.',
  );
  lines.push(
    `- Асуултын тоо: ${o.count ?? DEFAULT_COUNT}.`,
    o.topic
      ? `- Сэдэв: "${o.topic}".`
      : '- Тохирох богино сэдвийн нэрийг (`topic`) монголоор өөрөө санал болго.',
    '- `title` нь монголоор, богино, тодорхой байх.',
  );

  // IELTS Reading-д эх бичвэр заавал хэрэгтэй: өгсөн бол түүнийг ашиглана,
  // үгүй бол AI өөрөө зохионо (`passageText` талбарт буцаана).
  if (o.category === 'ielts_reading') {
    lines.push(
      o.passageText
        ? `- Асуултуудыг ЗӨВХӨН дараах эх бичвэр дээр үндэслэ:\n"""\n${o.passageText.trim()}\n"""`
        : '- 250–350 үгтэй IELTS Academic хэв маягийн эх бичвэр зохиогоод `passageText` талбарт буцаа. Асуултууд түүн дээр л тулгуурлана.',
    );
  }

  lines.push('', 'Хариултаа зөвхөн JSON хэлбэрээр буцаа.');
  return lines.join('\n');
}

/**
 * Асуултын нэг объектын талбарууд. `maxLength` нь **зөвхөн хэмжээ хязгаарлах
 * зорилготой биш** — загварт "энд зогс" гэсэн дохио өгдөг. Үүнгүйгээр
 * 2.5-flash нэг `question` string дотор давталтын гогцоонд орж 18,000+
 * тэмдэгт бичээд JSON-ыг эвдэж байсан.
 */
const QUESTION_FIELDS: Record<string, unknown> = {
  type: { type: 'STRING', enum: VALID_TYPES },
  question: { type: 'STRING', maxLength: 160 },
  options: {
    type: 'ARRAY',
    minItems: 4,
    maxItems: 4,
    items: { type: 'STRING', maxLength: 60 },
  },
  correct: { type: 'INTEGER' },
  answer: { type: 'STRING', maxLength: 60 },
  pairs: {
    type: 'ARRAY',
    minItems: 4,
    maxItems: 8,
    items: {
      type: 'OBJECT',
      properties: {
        left: { type: 'STRING', maxLength: 40 },
        right: { type: 'STRING', maxLength: 40 },
      },
      required: ['left', 'right'],
    },
  },
  prompt: { type: 'STRING', maxLength: 400 },
  modelAnswer: { type: 'STRING', maxLength: 1200 },
  bandNote: { type: 'STRING', maxLength: 300 },
};

/** Төрөл бүрт ЗААВАЛ байх талбарууд — "асуулт бүрэн боллоо" гэсэн дохио. */
const REQUIRED_BY_TYPE: Record<GenQuestionType, string[]> = {
  multiple_choice: ['type', 'question', 'options', 'correct'],
  fill_blank: ['type', 'question', 'answer'],
  word_match: ['type', 'pairs'],
  open_response: ['type', 'prompt', 'modelAnswer'],
};

/**
 * Gemini responseSchema. Асуултын 4 төрөл өөр өөр талбартай ч Gemini нь
 * union (`oneOf`)-г найдвартай дэмждэггүй. Тиймээс:
 *
 * - **Төрөл нь мэдэгдэж байвал** тухайн төрлийн талбаруудыг л үлдээж, бүгдийг
 *   `required` болгоно — хамгийн чанга, хамгийн найдвартай.
 * - **AI өөрөө сонгох үед** бүх талбар сонголттой хэвээр (аль нь хамаатайг
 *   задлагч `type`-аар нь шийднэ), гэхдээ `maxLength` бүгдэд хэвээр үлдэнэ.
 *
 * Schema-г API татгалзвал `gemini-text.ts` schema-гүйгээр дахин оролддог тул
 * хатуу schema нь онцлогийг унагах эрсдэлгүй.
 */
export function buildSchema(
  o: GenerateOptions,
  type: GenQuestionType,
): unknown {
  const count = o.count ?? DEFAULT_COUNT;
  const properties = Object.fromEntries(
    REQUIRED_BY_TYPE[type].map((f) => [f, QUESTION_FIELDS[f]]),
  );

  return {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING', maxLength: 80 },
      level: { type: 'STRING', enum: VALID_LEVELS },
      questionType: { type: 'STRING', enum: VALID_TYPES },
      topic: { type: 'STRING', maxLength: 60 },
      passageText: { type: 'STRING', maxLength: 3000 },
      questions: {
        type: 'ARRAY',
        minItems: count,
        maxItems: count,
        items: {
          type: 'OBJECT',
          properties,
          required: REQUIRED_BY_TYPE[type],
        },
      },
    },
    required: ['title', 'level', 'questionType', 'questions'],
  };
}

// ───────────────── Төрөл сонгох (auto горим) ─────────────────

/**
 * Админ асуултын төрөл заагаагүй үед эхлээд **аль формат тохирохыг л** асуух
 * жижиг дуудлага.
 *
 * Яагаад тусад нь вэ: төрөл мэдэгдэхгүй үед schema-г чангатгаж чадахгүй
 * (талбарууд бүгд сонголттой болно), тэгэхэд 2.5-flash нэг string дотор
 * давталтын гогцоонд орж 18,000+ тэмдэгт бичээд JSON-ыг эвдэж байсан. Эхлээд
 * төрлийг тодруулснаар үндсэн дуудлага үргэлж **чанга schema**-тай явна.
 * Энэ дуудлага маш богино (~50 токен) тул нийт хугацаанд бараг нөлөөлөхгүй.
 */
export const TYPE_PICK_SCHEMA = {
  type: 'OBJECT',
  properties: { questionType: { type: 'STRING', enum: VALID_TYPES } },
  required: ['questionType'],
};

export function buildTypePrompt(o: GenerateOptions): string {
  return [
    'Чи англи хэлний дасгал зохиогч. Доорх хүсэлтэд ХАМГИЙН тохирох асуултын форматыг сонго.',
    '',
    `ХҮСЭЛТ: """${o.brief.trim().slice(0, 1000)}"""`,
    o.category ? `АНГИЛАЛ: ${o.category}` : '',
    '',
    'Форматууд:',
    '- multiple_choice — 4 сонголтоос зөвийг нь сонгох (хамгийн түгээмэл)',
    '- fill_blank — өгүүлбэрийн цоорхойг нөхөх',
    '- word_match — англи үг ↔ монгол утга холбох (үгийн сан)',
    '- open_response — задгай бичих/ярих даалгавар (IELTS Writing/Speaking)',
    '',
    'Зөвхөн сонгосон форматын нэрийг JSON-оор буцаа.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Төрөл сонгох дуудлагын хариуг задлана. Танихгүй бол `null`. */
export function parseTypePick(text: string): GenQuestionType | null {
  try {
    const parsed = JSON.parse(text) as { questionType?: unknown };
    const t = str(parsed.questionType) as GenQuestionType;
    return VALID_TYPES.includes(t) ? t : null;
  } catch {
    return null;
  }
}

// ─────────────────────── Хариуг задлах + шалгах ───────────────────────

/** AI-гийн буцаасан түүхий асуулт (юу ч байж болно — бүгд сонголттой). */
interface RawQuestion {
  type?: unknown;
  question?: unknown;
  options?: unknown;
  correct?: unknown;
  answer?: unknown;
  pairs?: unknown;
  prompt?: unknown;
  modelAnswer?: unknown;
  bandNote?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

/**
 * Нэг асуултыг шалгаж, хадгалахад бэлэн хэлбэрт оруулна.
 * Засаж болохгүй бол `null` (тухайн асуулт хаягдана), сануулах зүйл гарвал
 * `warnings`-д нэмнэ. AI-д итгэхгүй байх нь хамгийн хямд даатгал.
 */
function normalizeQuestion(
  raw: RawQuestion,
  index: number,
  warnings: string[],
): GeneratedQuestion | null {
  const no = index + 1; // админд 1-ээс эхэлсэн дугаар харуулна
  const type = str(raw.type) as GenQuestionType;
  const warn = (m: string) => warnings.push(`${no}-р асуулт: ${m}`);
  const drop = (m: string) => {
    warn(`${m} — хасагдлаа`);
    return null;
  };

  if (type === 'multiple_choice') {
    const question = str(raw.question);
    if (!question) return drop('асуулт хоосон');

    const options = strList(raw.options);
    if (options.length < 2) return drop('сонголт 2-оос цөөн');
    if (options.length !== 4)
      warn(`${options.length} сонголттой байна (4 байх ёстой)`);
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
      warn('давхардсан сонголт байна');
    }

    let correct =
      typeof raw.correct === 'number' ? Math.trunc(raw.correct) : -1;
    if (correct < 0 || correct >= options.length) {
      warn('зөв хариултын индекс буруу — 1-р сонголтыг зөв гэж тавилаа');
      correct = 0;
    }
    return { type, question, options, correct, points: 10 };
  }

  if (type === 'fill_blank') {
    const question = str(raw.question);
    const answer = str(raw.answer);
    if (!question) return drop('асуулт хоосон');
    if (!answer) return drop('хариулт хоосон');
    if (!question.includes('___')) warn('өгүүлбэрт `___` цоорхой алга');
    return { type, question, answer, points: 10 };
  }

  if (type === 'word_match') {
    const rawPairs = Array.isArray(raw.pairs) ? raw.pairs : [];
    const pairs = rawPairs
      .map((p) => {
        const pair = (p ?? {}) as { left?: unknown; right?: unknown };
        return { left: str(pair.left), right: str(pair.right) };
      })
      .filter((p) => p.left && p.right);
    if (pairs.length < 2) return drop('бүрэн хос 2-оос цөөн');
    return { type, pairs, points: 10 };
  }

  if (type === 'open_response') {
    const prompt = str(raw.prompt) || str(raw.question);
    if (!prompt) return drop('даалгаврын текст хоосон');
    const bandNote = str(raw.bandNote);
    return {
      type,
      prompt,
      modelAnswer: str(raw.modelAnswer),
      ...(bandNote ? { bandNote } : {}),
    };
  }

  return drop(`танихгүй төрөл "${str(raw.type)}"`);
}

/** Асуултын текстээр давхардлыг олох түлхүүр. */
function questionKey(q: GeneratedQuestion): string {
  if (q.type === 'word_match') return q.pairs.map((p) => p.left).join('|');
  if (q.type === 'open_response') return q.prompt;
  return q.question;
}

/**
 * Gemini-гийн JSON хариуг найдвартай ноорог болгоно.
 *
 * Хэрэв schema-г API татгалзвал `gemini-text.ts` schema-гүйгээр дахин оролддог
 * тул хэлбэр нь бага зэрэг өөр ирж болно — задлагч нь тэр бүхнийг тэвчинэ.
 */
export function parseDraft(text: string, o: GenerateOptions): GeneratedDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI-гийн хариуг уншиж чадсангүй (JSON биш)');
  }

  // Schema-гүй горимд Gemini заримдаа шууд массив буцаадаг.
  const root = (
    Array.isArray(parsed) ? { questions: parsed } : (parsed ?? {})
  ) as {
    title?: unknown;
    level?: unknown;
    questionType?: unknown;
    topic?: unknown;
    passageText?: unknown;
    questions?: unknown;
  };

  const warnings: string[] = [];
  const rawQuestions = Array.isArray(root.questions) ? root.questions : [];
  if (rawQuestions.length === 0) {
    throw new Error(
      'AI нэг ч асуулт буцаасангүй — хүсэлтээ тодруулж дахин оролдоно уу',
    );
  }

  const questions: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of rawQuestions.entries()) {
    const q = normalizeQuestion((raw ?? {}) as RawQuestion, i, warnings);
    if (!q) continue;

    const key = questionKey(q).toLowerCase();
    if (seen.has(key)) {
      warnings.push(
        `${i + 1}-р асуулт: өмнөх асуулттай давхардсан — хасагдлаа`,
      );
      continue;
    }
    seen.add(key);
    questions.push(q);
  }

  if (questions.length === 0) {
    throw new Error(
      'Үүсгэсэн бүх асуулт шалгуурыг давсангүй — дахин оролдоно уу',
    );
  }

  // Хүссэнээс цөөн гарсныг админд мэдэгдэнэ (чимээгүй дутуу үлдэхээс сэргийлнэ).
  const wanted = o.count ?? DEFAULT_COUNT;
  if (questions.length < wanted) {
    warnings.push(`${wanted} асуулт хүссэнээс ${questions.length} нь үлдлээ`);
  }

  const level = str(root.level).toLowerCase();
  const aiType = str(root.questionType) as GenQuestionType;
  return {
    title: str(root.title) || o.brief.trim().slice(0, 60),
    level: VALID_LEVELS.includes(level) ? level : (o.level ?? 'a1'),
    // Бодит асуултууд нь эцсийн үнэн — AI-гийн хэлсэн төрөл зөрвөл эхнийхийг авна.
    questionType: VALID_TYPES.includes(aiType) ? aiType : questions[0].type,
    topic: str(root.topic) || o.topic || null,
    passageText: str(root.passageText) || o.passageText || null,
    questions,
    warnings,
  };
}

/** Хүсэлтийн тоог зөвшөөрөгдөх мужид оруулна. */
export function clampCount(count?: number): number {
  if (!count || count < 1) return DEFAULT_COUNT;
  return Math.min(Math.trunc(count), MAX_QUESTION_COUNT);
}

/**
 * Асуултын тоонд тохирсон гаралтын дээд хэмжээ.
 *
 * Нэг асуулт (сонголттойгоо) ойролцоогоор 120 токен; дээр нь гарчиг/сэдэв/эх
 * бичвэрт зориулж 1500 нөөцөлнө. Энэ нь загварыг хэт чалчихаас хамгаална —
 * бодит хэрэгцээнээс 3 дахин илүү тул хэвийн хариу таслагдахгүй.
 */
export function maxTokensFor(count: number): number {
  return 1500 + count * 360;
}
