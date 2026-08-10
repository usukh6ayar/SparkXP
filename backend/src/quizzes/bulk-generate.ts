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
        questionType: t.questionType,
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
