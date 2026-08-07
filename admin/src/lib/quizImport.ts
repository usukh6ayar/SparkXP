// Bulk-import parsing for everything that is stored as a Quiz (Дасгал · Quiz ·
// IELTS). One parser so the three pages don't each hand-roll their own CSV/JSON
// reader — the UI around it lives in `components/QuizImportModal.tsx`.

import type { Question, QuestionType } from '../components/QuizQuestionsEditor';

/** One quiz found in an import file: its own meta (optional) + its questions. */
export interface ParsedQuiz {
  title?: string;
  level?: string;
  topic?: string;
  quizType?: string;
  xpReward?: number;
  passageText?: string;
  audioUrl?: string;
  questions: Question[];
}

/** Splits a `|` row and trims each cell. */
function cells(line: string): string[] {
  return line.split('|').map((s) => s.trim());
}

function isNum(s: string | undefined): boolean {
  return !!s && s !== '' && !Number.isNaN(Number(s));
}

/**
 * One CSV line → one question. Trailing numbers are optional everywhere, so a
 * row can be as short as `question | answer`.
 */
function parseLine(line: string, format: QuestionType): Question {
  const p = cells(line);

  if (format === 'fill_blank') {
    return { type: 'fill_blank', question: p[0], answer: p[1] ?? '', points: Number(p[2] || 10) };
  }

  if (format === 'open_response') {
    return { type: 'open_response', prompt: p[0], modelAnswer: p[1] ?? '', bandNote: p[2] || undefined };
  }

  if (format === 'word_match') {
    // apple=алим | book=ном | 10   (the trailing number is the point value)
    const points = isNum(p[p.length - 1]) ? Number(p[p.length - 1]) : 10;
    const pairCells = isNum(p[p.length - 1]) ? p.slice(0, -1) : p;
    const pairs = pairCells
      .filter(Boolean)
      .map((c) => {
        const [left, right] = c.split('=').map((s) => s.trim());
        return { left: left ?? '', right: right ?? '' };
      });
    return { type: 'word_match', pairs, points };
  }

  // multiple_choice: асуулт | сонголт… | зөв№(1-ээс) | оноо(заавал биш)
  const last = p[p.length - 1];
  const beforeLast = p[p.length - 2];
  const hasPoints = p.length >= 4 && isNum(last) && isNum(beforeLast);
  const points = hasPoints ? Number(last) : 10;
  const correctNo = hasPoints ? Number(beforeLast) : isNum(last) ? Number(last) : 1;
  const options = p.slice(1, hasPoints ? -2 : isNum(last) ? -1 : undefined);
  return { type: 'multiple_choice', question: p[0], options, correct: Math.max(0, correctNo - 1), points };
}

/** JSON body → quizzes. Accepts a quiz list, a single quiz, or a question list. */
function parseJson(text: string): ParsedQuiz[] {
  const data: unknown = JSON.parse(text);
  const rows = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
  if (rows.length === 0) throw new Error('Хоосон массив');
  if (rows.some((r) => !r || typeof r !== 'object')) throw new Error('JSON бүтэц буруу');

  // A row that carries its own `questions` is a whole quiz; otherwise the array
  // is just the question list of a single quiz.
  if (rows.every((r) => Array.isArray(r.questions))) return rows as unknown as ParsedQuiz[];
  if (rows.some((r) => !('type' in r)))
    throw new Error('JSON бүтэц буруу: асуулт бүрд "type", эсвэл багц бүрд "questions" талбар байх ёстой');
  return [{ questions: rows as unknown as Question[] }];
}

/**
 * Parse a pasted/uploaded import into one or more quizzes.
 * - JSON (`[` / `{`) → олон багц эсвэл нэг багц (auto-detect).
 * - Бусад тохиолдолд `|`-аар тусгаарласан CSV → нэг багцын асуултууд.
 */
export function parseQuizImport(text: string, format: QuestionType): ParsedQuiz[] {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Өгөгдөл хоосон байна');
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseJson(trimmed);
  const questions = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseLine(l, format));
  return [{ questions }];
}

/** Human-readable problem with a question, or null when it looks importable. */
export function validateQuestion(q: Question): string | null {
  if (!q || typeof q !== 'object' || !('type' in q)) return 'төрөл (type) алга';
  if (q.type === 'multiple_choice') {
    if (!q.question?.trim()) return 'асуулт хоосон';
    if (!q.options?.length || q.options.some((o) => !o?.trim())) return 'сонголт дутуу';
    if (q.correct < 0 || q.correct >= q.options.length) return 'зөв хариултын дугаар буруу';
  } else if (q.type === 'fill_blank') {
    if (!q.question?.trim()) return 'өгүүлбэр хоосон';
    if (!q.answer?.trim()) return 'хариулт хоосон';
  } else if (q.type === 'word_match') {
    if (!q.pairs?.length) return 'хос алга';
    if (q.pairs.some((p) => !p.left?.trim() || !p.right?.trim())) return 'хос дутуу (apple=алим)';
  } else if (q.type === 'open_response') {
    if (!q.prompt?.trim()) return 'даалгавар хоосон';
    if (!q.modelAnswer?.trim()) return 'жишиг хариулт хоосон';
  } else {
    return 'танигдахгүй төрөл';
  }
  return null;
}

/** CSV format hint shown above the textarea. */
export const FORMAT_HELP: Record<QuestionType, { sample: string; fields: string }> = {
  multiple_choice: {
    sample: 'Нийслэл? | Улаанбаатар | Дархан | Эрдэнэт | 1 | 10',
    fields: 'асуулт | сонголт1 | сонголт2 | … | зөв№(1-ээс) | оноо',
  },
  fill_blank: {
    sample: 'She ___ to school. | goes | 10',
    fields: 'өгүүлбэр | зөв хариулт | оноо',
  },
  word_match: {
    sample: 'apple=алим | book=ном | dog=нохой | 10',
    fields: 'англи=монгол | англи=монгол | … | оноо',
  },
  open_response: {
    sample: 'Describe a book you love. | Жишиг хариулт... | Band 7 тэмдэглэл',
    fields: 'даалгавар | жишиг хариулт | band тэмдэглэл (заавал биш)',
  },
};

/** Sample text for the "Жишээ буулгах" button — 2 багц JSON + CSV мөрүүд. */
export function sampleImport(format: QuestionType, title = 'Багц'): string {
  const two = [1, 2].map((n) => ({
    title: `${title} ${n}`,
    questions: [parseLine(FORMAT_HELP[format].sample, format)],
  }));
  return JSON.stringify(two, null, 2);
}
