import { Ionicons } from '@expo/vector-icons';
import { skillGradients } from '../theme/theme';
import type { TranslationKey } from '../i18n';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The 4 IELTS modules. Content model (Approach A): an IELTS practice set is a
 * normal Quiz whose `category` is `ielts_<module>` — no separate entity, so the
 * quiz list/runner are reused as-is.
 *
 * `auto` = objective module: answers are graded and the server returns a band
 * (0–9). Writing/Speaking are self-study practice (model answer, no score) and
 * live in their own screen — owned by Boju (IELTS Plan 3b).
 */
export interface IeltsModule {
  key: 'listening' | 'reading' | 'writing' | 'speaking';
  category: string;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  icon: IconName;
  grad: readonly [string, string];
  auto: boolean;
  /** How many parts the real paper has — the exam player lays out this many. */
  parts: number;
  /** What a part is called here. Kept in English: IELTS names its own parts. */
  partLabel: string;
}

export const IELTS_MODULES: IeltsModule[] = [
  {
    key: 'listening',
    category: 'ielts_listening',
    labelKey: 'ieltsListening',
    hintKey: 'ieltsAutoBand',
    icon: 'headset',
    grad: skillGradients.listening,
    auto: true,
    parts: 4, // four recorded sections, 10 questions each
    partLabel: 'Section',
  },
  {
    key: 'reading',
    category: 'ielts_reading',
    labelKey: 'ieltsReading',
    hintKey: 'ieltsAutoBand',
    icon: 'book',
    grad: skillGradients.reading,
    auto: true,
    /**
     * **3 Passage** — ielts.org (2026-08-15): Academic Reading нь 3 эх, нийт
     * 40 асуулт, 60 минут.
     */
    parts: 3,
    partLabel: 'Passage',
  },
  {
    key: 'writing',
    category: 'ielts_writing',
    labelKey: 'ieltsWriting',
    hintKey: 'ieltsSelfStudy',
    icon: 'create',
    grad: skillGradients.writing,
    auto: false,
    parts: 2, // Task 1 (150 words) + Task 2 (250 words)
    partLabel: 'Task',
  },
  {
    key: 'speaking',
    category: 'ielts_speaking',
    labelKey: 'ieltsSpeaking',
    hintKey: 'ieltsSelfStudy',
    icon: 'mic',
    grad: skillGradients.speaking,
    auto: false,
    parts: 3, // intro · long turn · discussion
    partLabel: 'Part',
  },
];

/**
 * ⚠️ IELTS-д **CEFR түвшин байхгүй.**
 *
 * Жинхэнэ шалгалт бүх шалгуулагчид ижил — «B1-ийн Listening» гэж үгүй. Ялгаа нь
 * зөвхөн хэдийг зөв бөглөснөөс гарах band. Тиймээс IELTS жагсаалт `level`-ийг
 * бүлэг болгож ч, дэд бичвэрт ч харуулахгүй (`skill/[key].tsx`).
 */

/** Is this quiz category an IELTS one (drives passage/audio/band UI in the runner)? */
export function isIeltsCategory(category?: string | null): boolean {
  return !!category?.startsWith('ielts_');
}

/** Band is shown with one decimal (IELTS uses half-steps): 6 → "6.0". */
export function formatBand(band: number): string {
  return band.toFixed(1);
}

/*
 * ⚠️ `parseBandTopic()` энд байсныг устгав (2026-08-14).
 *
 * Контентыг «Band 6.5» гэсэн зорилтот band-аар нь ангилж, шалгалтын толгойд
 * тэмдэг болгон харуулдаг байв. Band бол ДҮН — сервер зөв хариултын тооноос
 * гаргаж `QuizResult.band`-аар буцаадаг, тэр л цорын ганц эх сурвалж
 * (`ExamResult`). Урьдчилж band амлах нь дасгалын хийж ч чадахгүй зүйл.
 */

/**
 * Is this label a leftover "target band" (`Band 6.5`)?
 *
 * Content authored before 2026-08-14 stored one in `topic`, and the app groups
 * lists by `topic` — so those rows would keep heading a practice list with a
 * band that has nothing to do with what the student will score. The migration
 * clears them server-side; this is the client half, so a phone that has not yet
 * met the migrated data (or an old row someone re-creates) never shows one.
 */
export function isBandLabel(label?: string | null): boolean {
  return /^band\s+[0-9](?:\.[05])?$/i.test((label ?? '').trim());
}

/** A сэдэв safe to show, or null when it is really a leftover band label. */
export function displayTopic(topic?: string | null): string | null {
  const value = topic?.trim();
  return value && !isBandLabel(value) ? value : null;
}

/** The module a practice set belongs to, from its category. */
export function ieltsModuleOf(category?: string | null): IeltsModule | undefined {
  return IELTS_MODULES.find((m) => m.category === category);
}

/**
 * Seconds the real exam allows per question, used for the (advisory) clock.
 *
 * The official papers are 40 questions in 30 minutes for Listening and 60 for
 * Academic Reading. Our practice sets are far smaller, so a flat 30/60-minute
 * limit would never be reached and the clock would say nothing. Scaling by
 * question count keeps the same pressure at any set size.
 */
const SECONDS_PER_QUESTION: Record<IeltsModule['key'], number> = {
  listening: 45, // 30 min / 40 questions
  reading: 90, // 60 min / 40 questions
  writing: 1200, // 20 min per task
  speaking: 120,
};

/** Advisory time budget for a set, in seconds. */
export function recommendedSeconds(
  moduleKey: IeltsModule['key'],
  questionCount: number,
): number {
  return Math.max(60, (SECONDS_PER_QUESTION[moduleKey] ?? 60) * questionCount);
}

/** One exam part: its questions plus the question numbers it spans. */
export interface ExamSection<Q> {
  /** Part number, 1-based. */
  number: number;
  /** Questions in this part, each with its index in the flat quiz array. */
  items: { question: Q; index: number }[];
  /** First and last question NUMBER (1-based) — "Questions 5–9". */
  from: number;
  to: number;
}

/**
 * Split a quiz's flat question list into exam parts.
 *
 * Questions authored before sections existed carry no `section`, so they all
 * fall into part 1 and the runner simply shows no part tabs — the same set
 * still works, it just isn't divided. Parts are keyed by the stored number
 * rather than by position, so a gap (admin used 1, 2 and 4) doesn't renumber
 * anything the student was told.
 */
export function groupSections<Q extends { section?: number }>(
  questions: Q[],
): ExamSection<Q>[] {
  const byNumber = new Map<number, { question: Q; index: number }[]>();
  questions.forEach((question, index) => {
    const n = question.section ?? 1;
    const bucket = byNumber.get(n);
    if (bucket) bucket.push({ question, index });
    else byNumber.set(n, [{ question, index }]);
  });

  return [...byNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, items]) => ({
      number,
      items,
      // Question numbers shown to the student are positions in the flat list,
      // so they stay continuous across parts exactly like a real answer sheet.
      from: Math.min(...items.map((i) => i.index)) + 1,
      to: Math.max(...items.map((i) => i.index)) + 1,
    }));
}

/**
 * Бүтэн шалгалтын нэг хэсгийн бичвэрийг салгаж авах.
 *
 * `Quiz.passageText` нь ганц талбар тул бүтэн шалгалтын 4 сонсох яриа (эсвэл
 * 3 уншлагын эх) `--- Section 2 ---` маягийн тэмдэглэгээгээр нэг мөрөнд
 * цуглардаг (backend `SECTION_MARK`). Апп тухайн хэсгийнхийг л харуулна —
 * жинхэнэ шалгалтын адил, 2-р хэсэг дээр 4-ийн ярианы бичвэр гарч ирэхгүй.
 *
 * Тэмдэглэгээгүй (нэг хэсэгтэй, эсвэл гараар бичсэн) бичвэрийг хөндөхгүй
 * бүтнээр нь буцаана.
 */
const SECTION_MARK_RE = /^\s*-{3}\s*(?:Section|Passage)\s*(\d+)\s*-{3}\s*$/gim;

export function sectionText(
  passageText: string | null | undefined,
  section: number,
): string {
  const text = passageText ?? '';
  if (!text.trim()) return '';

  const marks = [...text.matchAll(SECTION_MARK_RE)];
  if (!marks.length) return text; // тэмдэглэгээгүй — бүтнээрээ

  const at = marks.findIndex((m) => Number(m[1]) === section);
  if (at === -1) return text; // энэ хэсгийнх тэмдэглэгдээгүй бол бүтнээрээ

  const start = (marks[at].index ?? 0) + marks[at][0].length;
  const end = marks[at + 1]?.index ?? text.length;
  return text.slice(start, end).trim();
}
