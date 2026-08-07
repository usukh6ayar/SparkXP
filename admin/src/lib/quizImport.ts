// Excel/CSV bulk import for everything stored as a Quiz (Дасгал · Quiz · IELTS).
// One parser so the three pages don't each hand-roll their own reader — the UI
// around it lives in `components/QuizImportModal.tsx`.
//
// Дүрэм: **зөвхөн CSV** (Excel-ээс "Save as → CSV"). Мөр бүр = 1 асуулт,
// `title` багана ижил байвал нэг багц (quiz) болно.

import type { Question, QuestionType } from '../components/QuizQuestionsEditor';

/** One quiz built from a group of CSV rows sharing the same `title`. */
export interface ParsedQuiz {
  title: string;
  level?: string;
  topic?: string;
  quizType?: string;
  questions: Question[];
}

export interface RowError {
  /** 1-based line number in the file (header = 1), so it matches Excel. */
  row: number;
  message: string;
}

export interface CsvParseResult {
  quizzes: ParsedQuiz[];
  errors: RowError[];
  /** Rows that had data (excludes the header + blank lines). */
  totalRows: number;
}

/** CSV баганын гарчиг — загвар татахад мөн энэ дараалал. */
export const CSV_COLUMNS = [
  'title', 'level', 'topic', 'type',
  'question', 'option1', 'option2', 'option3', 'option4',
  'correct', 'answer', 'points',
] as const;

// ── CSV reading ─────────────────────────────────────────────────────────────

/** Excel зарим локальд `;`-ээр экспортолдог — гарчгийн мөрөөс таана. */
function detectDelimiter(firstLine: string): string {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > commas && tabs > semis) return '\t';
  return semis > commas ? ';' : ',';
}

/**
 * RFC-4180 маягийн CSV задлагч: хашилтан доторх таслал, шинэ мөр, `""` бүгд
 * зөв уншигдана (Excel-ийн гаргалт яг ийм).
 */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, ''); // Excel BOM
  const delim = detectDelimiter(s.split(/\r?\n/, 1)[0] ?? '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  row.push(cell);
  rows.push(row);
  // Бүхэлдээ хоосон мөрийг хая (Excel ихэвчлэн сүүлд хоосон мөр үлдээдэг).
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// ── Rows → quizzes ──────────────────────────────────────────────────────────

const TYPES: QuestionType[] = ['multiple_choice', 'fill_blank', 'word_match', 'open_response'];

/** Builds one question from a row, or throws with a human-readable reason. */
function toQuestion(get: (col: string) => string, options: string[], type: QuestionType): Question {
  const points = Math.max(1, Number(get('points')) || 10);

  if (type === 'fill_blank') {
    const question = get('question');
    const answer = get('answer');
    if (!question) throw new Error('`question` (өгүүлбэр) хоосон');
    if (!answer) throw new Error('`answer` (зөв хариулт) хоосон');
    return { type, question, answer, points };
  }

  if (type === 'open_response') {
    const prompt = get('question');
    const modelAnswer = get('answer');
    if (!prompt) throw new Error('`question` (даалгавар) хоосон');
    if (!modelAnswer) throw new Error('`answer` (жишиг хариулт) хоосон');
    return { type, prompt, modelAnswer };
  }

  if (type === 'word_match') {
    // Хосууд option багануудад: `apple=алим`
    if (options.length < 2) throw new Error('дор хаяж 2 хос хэрэгтэй (option1=`apple=алим`)');
    const pairs = options.map((o) => {
      const [left, right] = o.split('=').map((x) => x.trim());
      if (!left || !right) throw new Error(`"${o}" — хос нь \`англи=монгол\` хэлбэртэй байх ёстой`);
      return { left, right };
    });
    return { type, pairs, points };
  }

  const question = get('question');
  if (!question) throw new Error('`question` (асуулт) хоосон');
  if (options.length < 2) throw new Error('дор хаяж 2 сонголт хэрэгтэй (option1, option2)');
  const correctNo = Number(get('correct'));
  if (!correctNo || correctNo < 1 || correctNo > options.length)
    throw new Error(`\`correct\` нь 1–${options.length} хооронд байх ёстой (одоо: "${get('correct') || 'хоосон'}")`);
  return { type: 'multiple_choice', question, options, correct: correctNo - 1, points };
}

/**
 * CSV текстийг багцууд болгож задална. `title` ижил (эсвэл хоосон = өмнөхийг
 * үргэлжлүүлнэ) дараалсан мөрүүд нэг багц болно.
 */
export function parseQuizCsv(text: string, defaultType: QuestionType): CsvParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { quizzes: [], errors: [{ row: 1, message: 'Файл хоосон байна' }], totalRows: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  if (!header.includes('title') || !header.includes('question')) {
    return {
      quizzes: [],
      errors: [{ row: 1, message: 'Гарчгийн мөр буруу — `title` ба `question` багана заавал байх ёстой. "Загвар татах" дарж жишээ авна уу.' }],
      totalRows: 0,
    };
  }

  // option1, option2, … (дугаараар эрэмбэлнэ — 4-өөс олон ч байж болно)
  const optionCols = header
    .map((h, i) => ({ h, i }))
    .filter((c) => /^option\d+$/.test(c.h))
    .sort((a, b) => Number(a.h.slice(6)) - Number(b.h.slice(6)))
    .map((c) => c.i);

  const quizzes: ParsedQuiz[] = [];
  const errors: RowError[] = [];
  /** Багц бүр `quizzes`-ийн сүүлчийнх — түүний нэрийг тусад нь хөтөлнө. */
  let currentTitle = '';
  let totalRows = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNo = r + 1; // Excel-ийн мөрийн дугаартай тааруулна
    const get = (col: string) => (cells[header.indexOf(col)] ?? '').trim();
    totalRows++;

    const title = get('title');
    if (!title && !currentTitle) {
      errors.push({ row: rowNo, message: 'Эхний мөрд `title` (багцын нэр) заавал хэрэгтэй' });
      continue;
    }

    const rawType = get('type').toLowerCase();
    if (rawType && !TYPES.includes(rawType as QuestionType)) {
      errors.push({ row: rowNo, message: `\`type\` танигдахгүй: "${rawType}" (${TYPES.join(' · ')})` });
      continue;
    }
    const type = (rawType || defaultType) as QuestionType;
    const options = optionCols.map((i) => (cells[i] ?? '').trim()).filter(Boolean);

    let question: Question;
    try {
      question = toQuestion(get, options, type);
    } catch (e) {
      errors.push({ row: rowNo, message: e instanceof Error ? e.message : 'Мөр буруу' });
      continue;
    }

    // Шинэ багц эхлэх үү, эсвэл өмнөхийг үргэлжлүүлэх үү?
    if (title && title !== currentTitle) {
      currentTitle = title;
      quizzes.push({ title, level: get('level') || undefined, topic: get('topic') || undefined, questions: [] });
    }
    quizzes[quizzes.length - 1].questions.push(question);
  }

  return { quizzes, errors, totalRows };
}

// ── Template ────────────────────────────────────────────────────────────────

/** Нэг мөрийг CSV болгож хашина (таслал/хашилт агуулбал). */
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const SAMPLE_ROWS: Record<QuestionType, string[][]> = {
  // title, level, topic, type, question, option1..4, correct, answer, points
  multiple_choice: [
    ['Сонсгол A1 — 1', 'a1', '', 'multiple_choice', 'What is the capital of Mongolia?', 'Ulaanbaatar', 'Darkhan', 'Erdenet', 'Choibalsan', '1', '', '10'],
    ['', '', '', '', 'How many days are in a week?', 'Five', 'Six', 'Seven', 'Eight', '3', '', '10'],
    ['Сонсгол A1 — 2', 'a1', '', 'multiple_choice', 'Which one is a fruit?', 'Apple', 'Chair', 'Table', 'Door', '1', '', '10'],
  ],
  fill_blank: [
    ['Нөхөх A1 — 1', 'a1', '', 'fill_blank', 'She ___ to school every day.', '', '', '', '', '', 'goes', '10'],
    ['', '', '', '', 'I ___ a student.', '', '', '', '', '', 'am', '10'],
  ],
  word_match: [
    ['Холбох A1 — 1', 'a1', '', 'word_match', '', 'apple=алим', 'book=ном', 'dog=нохой', 'cat=муур', '', '', '10'],
  ],
  open_response: [
    ['Writing Task 2 — 1', 'b2', '', 'open_response', 'Some people think exams are the best way to assess students. Discuss.', '', '', '', '', '', 'Жишиг хариулт энд...', ''],
  ],
};

/** Сонгосон төрөлд тохирсон, бөглөсөн жишээтэй CSV загвар. */
export function csvTemplate(type: QuestionType): string {
  const rows = [CSV_COLUMNS as readonly string[], ...SAMPLE_ROWS[type]];
  // Excel нь UTF-8 BOM-гүй бол кирилл үсгийг эвдэж уншдаг.
  return '\uFEFF' + rows.map((r) => r.map((c) => csvCell(String(c))).join(',')).join('\r\n') + '\r\n';
}

/** Тухайн төрөлд аль багана хэрэгтэйг тайлбарлана (модалын заавар). */
export const TYPE_HINTS: Record<QuestionType, string> = {
  multiple_choice: '`question` · `option1…4` · `correct` (хэддүгээр сонголт зөв, 1-ээс) · `points`',
  fill_blank: '`question` (___ хоосон зайтай) · `answer` · `points`',
  word_match: '`option1…` баганад `англи=монгол` хосууд · `points`',
  open_response: '`question` (даалгавар) · `answer` (жишиг хариулт)',
};
