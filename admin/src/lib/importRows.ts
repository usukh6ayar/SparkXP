import type { Question, QuestionType } from '../components/QuizQuestionsEditor';

/**
 * **Файл/буулгасан текстээс дасгал үүсгэх задлагч.**
 *
 * Багш нэг даалгаварт 5 багц өгдөг ба багц бүр нь өөрийн 15 асуулттай
 * (`mobile/src/lib/assignmentGroups.ts`). Тэр 5 багц нь өгөгдлийн талаас
 * **5 тусдаа дасгал** тул нэг файлаас олныг үүсгэх ёстой — эс бөгөөс админ
 * нэг ижил цонхыг 5 удаа бөглөнө.
 *
 * Гурван эх сурвалжийг ижил кодоор уншина:
 *  - **Excel → «Save as CSV»** → таслалаар (хашилттай талбарыг зөв уншина),
 *  - **Excel-ээс шууд хуулж буулгах** → таб-аар,
 *  - **гараар бичсэн** → `|`-аар.
 * Тусгаарлагчийг мөр бүрээс өөрөө таана, тиймээс админ юу ч сонгох
 * шаардлагагүй.
 */

/** Нэг багц = нэг дасгал болно. */
export interface Pack {
  /** Багцын нэр (эхний багана). Хоосон бол «Багц N». */
  name: string;
  questions: Question[];
}

/**
 * Баримтаас **өөрөө уншсан** мета мэдээлэл — шалгалтын бичгийн толгой мөр:
 *
 *   `Level: A1  |  Lesson: Basic English sentence structure …  |  Test: 1`
 *
 * Админ эдгээрийг гараар хуулж бичих шаардлагагүй болгоно. Гараар бичсэн
 * утгыг ХЭЗЭЭ Ч дарж бичихгүй — зөвхөн хоосон талбарыг нөхнө.
 */
export interface ImportMeta {
  /** `Lesson:` → сэдэв (хавтасны нэр). */
  topic?: string;
  /** `Level:` → түвшин, жижиг үсгээр (`a1`). */
  level?: string;
}

/** Шалгалтын бичгийн толгой мөрөөс сэдэв ба түвшинг уншина. */
export function examMeta(text: string): ImportMeta {
  const meta: ImportMeta = {};
  // `|` эсвэл мөрийн төгсгөл хүртэл — толгой мөр нэг мөрөнд хэд хэдэн талбартай.
  const lesson = text.match(/\blesson\s*:\s*([^|\n\r]+)/i)?.[1]?.trim();
  if (lesson) meta.topic = lesson;
  const level = text.match(/\blevel\s*:\s*([a-c][12])\b/i)?.[1];
  if (level) meta.level = level.toLowerCase();
  return meta;
}

/**
 * Нэг мөрийг талбаруудад хуваана.
 *
 * Тусгаарлагчийн дараалал: `|` → таб → таслал. Excel-ийн CSV нь таслалтай
 * бөгөөд текст дотор таслал байвал `"…"` хашилтанд ордог тул хашилтыг
 * зохицуулна (давхар хашилт `""` = нэг хашилт).
 */
function splitLine(line: string): string[] {
  const delimiter = line.includes('|') ? '|' : line.includes('\t') ? '\t' : ',';
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } // "" → "
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { out.push(field.trim()); field = ''; }
    else field += ch;
  }
  out.push(field.trim());
  return out;
}

/**
 * Толгой мөр үү.
 *
 * Аль ч байрлалд шалгагдана (зөвхөн эхний мөрөнд биш): олон хуудастай Excel
 * нийлүүлэгдэхэд хуудас бүрийн толгой дунд орж ирдэг. Эдгээр үг асуулт болж
 * таарах магадлал бодитоор алга.
 *
 * `splitLine` нүд бүрийг `trim()` хийдэг ба JS-ийн `trim()` нь BOM-ыг
 * (U+FEFF) мөн арилгадаг тул Excel-ийн UTF-8 CSV-ийн эхний нүд ч таарна.
 */
const HEADER_WORDS = ['багц', 'pack', 'бүлэг', 'асуулт', 'question'];

function isHeader(cells: string[]): boolean {
  return HEADER_WORDS.includes(cells[0]?.toLowerCase() ?? '');
}

/** Нэг мөрөөс нэг асуулт. `cells` нь багцын баганагүй (аль хэдийн хасагдсан). */
function toQuestion(cells: string[], type: QuestionType): Question {
  if (type === 'fill_blank') {
    // асуулт | хариулт | оноо
    return {
      type: 'fill_blank',
      question: cells[0],
      answer: cells[1] ?? '',
      points: Number(cells[2] || 10),
    };
  }
  // асуулт | сонголт… | зөв(1-ээс) | оноо
  const points = Number(cells[cells.length - 1] || 10);
  const correctNo = Number(cells[cells.length - 2] || 1);
  return {
    type: 'multiple_choice',
    question: cells[0],
    options: cells.slice(1, cells.length - 2),
    correct: Math.max(0, correctNo - 1),
    points,
  };
}

/**
 * Текстийг багцуудад задална.
 *
 * @param multiPack Эхний багана нь **багцын нэр** үү. Унтраалттай үед бүх
 *   мөр нэг багц болно (хуучин зан төлөв — нэг дасгал).
 *
 * JSON массив өгвөл тэр нь бэлэн `Question[]` гэж үзэгдэж нэг багц болно.
 */
export function parsePacks(
  text: string,
  type: QuestionType,
  multiPack: boolean,
): Pack[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as Question[];
    if (!Array.isArray(arr)) throw new Error('JSON массив байх ёстой');
    return [{ name: '', questions: arr }];
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // **Шалгалтын бичиг** (Word/PDF-ээс гарсан) — мөр бүр = нэг асуулт БИШ, нэг
  // асуулт 5 мөрөнд тархсан байдаг. Хүн Word дээр тест ингэж бичдэг тул
  // энэ хэлбэрийг өөрөө таньж, өөр замаар задална.
  if (looksLikeExam(lines)) return parseExam(lines);

  // «Үг холбох» нь хос-хосоороо бүтэцтэй тул мөр болгон задарч чадахгүй.
  if (type === 'word_match') {
    throw new Error('Холбох төрөлд зөвхөн JSON массив дэмжинэ');
  }

  const packs = new Map<string, Question[]>();
  for (const line of lines) {
    const cells = splitLine(line);
    if (isHeader(cells)) continue;
    const name = multiPack ? cells[0] : '';
    const rest = multiPack ? cells.slice(1) : cells;
    if (!rest[0]) continue; // асуултгүй мөр (Excel-ийн хоосон сүүл)
    const list = packs.get(name);
    const question = toQuestion(rest, type);
    if (list) list.push(question);
    else packs.set(name, [question]);
  }

  return [...packs].map(([name, questions], i) => ({
    name: name || (packs.size > 1 ? `Багц ${i + 1}` : ''),
    questions,
  }));
}

/**
 * Excel нь UTF-8 CSV-г зөвхөн энэ тэмдэгтээр эхэлж байвал зөв уншина — үүнгүй
 * бол «Present Simple» нь «Ð¿Ñ€ÐµÑ…» болж нээгддэг.
 */
const BOM = '\uFEFF';

/**
 * Excel-д нээгээд бөглөх загвар (2 багц × 2 асуулт).
 */
export function templateCsv(type: QuestionType): string {
  const rows =
    type === 'fill_blank'
      ? [
          ['багц', 'асуулт', 'хариулт', 'оноо'],
          ['Present Simple 1', 'She ___ to school every day.', 'goes', '10'],
          ['Present Simple 1', 'They ___ football on Sunday.', 'play', '10'],
          ['Present Simple 2', 'He ___ not like coffee.', 'does', '10'],
        ]
      : [
          ['багц', 'асуулт', 'сонголт 1', 'сонголт 2', 'сонголт 3', 'сонголт 4', 'зөв (1-4)', 'оноо'],
          ['Present Simple 1', 'She ___ to school every day.', 'go', 'goes', 'going', 'went', '2', '10'],
          ['Present Simple 1', 'They ___ football on Sunday.', 'plays', 'played', 'play', 'playing', '3', '10'],
          ['Present Simple 2', 'He ___ not like coffee.', 'do', 'does', 'did', 'doing', '2', '10'],
        ];
  const escape = (v: string) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return BOM + rows.map((r) => r.map(escape).join(',')).join('\n');
}

/**
 * **Дурын файлыг текст болгож унших.**
 *
 * Excel (`.xlsx`) ба Word (`.docx`) нь ZIP архив тул номын сангаар задална —
 * гэхдээ үр дүнг нь **таб-аар тусгаарласан текст** болгож `parsePacks` руу
 * оруулна. Ингэснээр задлах логик ганц хэвээр үлдэнэ: CSV, буулгасан текст,
 * Excel, Word дөрвүүлээ **нэг замаар** уншигдана.
 *
 * Номын сангууд нь `import()`-оор ачаалагдана — импортын цонх нээхгүй хүн
 * тэдгээрийг татахгүй (админы үндсэн bundle-д нөлөөлөхгүй).
 */
type Cell = string | number | boolean | Date | null;

export async function readAnyFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    // ⚠️ `read-excel-file/browser` — үндсэн замаас нь оруулбал төрлүүд нь
    // олдохгүй (пакет нь зөвхөн дэд замуудаа `exports`-д зарласан).
    const readXlsx = (await import('read-excel-file/browser')).default;
    /*
     * ⚠️ Энэ сан нь **хуудсуудын жагсаалт** буцаадаг (`[{ sheet, data }]`),
     * шууд мөрүүд БИШ. Бүх хуудсыг нийлүүлнэ — админ 5 багцаа 5 хуудсанд
     * тарааж бичсэн байвал чимээгүй алдагдах ёсгүй. (Хуудас бүрийн толгой
     * мөрийг `parsePacks` өөрөө таньж алгасна.)
     */
    const sheets = (await readXlsx(file)) as unknown as { data: Cell[][] }[];
    const rows = sheets.flatMap((sheet) => sheet.data ?? []);
    // Нүд бүр текст болно (тоо, огноо ч мөн адил). Таб нь Excel-ийн нүд дотор
    // гарч чаддаггүй тул тусгаарлагч болгоход аюулгүй.
    return rows
      .map((row) => row.map((cell) => (cell == null ? '' : String(cell))).join('\t'))
      .join('\n');
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    // Word-ийн хүснэгтийн нүднүүд мөр мөрөөр гардаг тул хүснэгттэй бичиг
    // баримт зөв уншигдахгүй байж болно — тэр тохиолдолд админ бичвэрээ
    // хараад гараар засна (талбарт нь ирсэн хэвээр байна).
    const { value } = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return value;
  }

  if (name.endsWith('.doc')) {
    throw new Error('Хуучин `.doc` формат уншигдахгүй. Word дээрээ «Save As → .docx» болгоод дахин оруулна уу.');
  }

  return file.text();
}

// ── Шалгалтын бичиг (Word) ────────────────────────────────────────────────
/*
 * Word дээр бичсэн тест ингэж харагддаг:
 *
 *   Level: A1  |  Lesson: Basic sentence structure  |  Test: 1
 *   1. Which sentence has Subject + Verb + Object order?
 *   A. Reads Vincent emails.
 *   B. Vincent reads emails.
 *   …
 *   ANSWER KEY
 *   1
 *   B
 *   2
 *   D
 *
 * Өөрөөр хэлбэл нэг асуулт **таван мөрөнд** тархаж, зөв хариулт нь баримтын
 * төгсгөлд тусдаа хүснэгтэд байна. Мөр бүрийг нэг асуулт гэж үздэг задлагч
 * үүнийг хогоор дүүргэдэг тул хэлбэрийг нь таньж, тусад нь боловсруулна.
 */

/** `1.` / `1)` — асуултын эхлэл. */
const Q_LINE = /^(\d{1,3})\s*[.)]\s*(.+)$/;
/** `A.` / `A)` — сонголт. Кирилл А–Д-г мөн хүлээж авна. */
const OPT_LINE = /^([A-DА-Д])\s*[.)]\s*(.+)$/i;
/** Хариултын хүснэгтийн эхлэл. */
const KEY_HEAD = /^(answer\s*key|хариулт(ын)?\s*(түлхүүр)?)\s*:?$/i;
/** Файл салгагч — олон файл нэг талбарт нийлүүлэхэд ашиглана. */
export const FILE_MARK = /^-{5} FILE: (.+?) -{5}$/;

/** Толгойн мөр — асуулт ч биш, сонголт ч биш, зүгээр тайлбар. */
const SKIP_LINE = /^(level\s*:|lesson\s*:|test\s*:|choose |question$|correct answer$|sparkxp)/i;

/** Гаднаас шалгах — цонх «шалгалтын бичиг танигдлаа» гэж хэлэхэд ашиглана. */
export function isExamText(text: string): boolean {
  return looksLikeExam(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
}

function looksLikeExam(lines: string[]): boolean {
  // Дор хаяж 2 удаа «дугаарласан асуулт → шууд дараа нь A. сонголт» гарвал
  // энэ бол шалгалтын бичиг. Хоёр гэсэн нь санамсаргүй таарахаас хамгаална.
  let hits = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (Q_LINE.test(lines[i]) && OPT_LINE.test(lines[i + 1])) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/**
 * Нэг эсвэл олон шалгалтын бичгийг багц болгон задална.
 *
 * Багцын нэр: баримтын `Test: N` мөр → байхгүй бол файлын нэр → эцэст нь
 * «Багц N». Хариултын түлхүүргүй асуултыг **хаяхгүй**: зөв хариултыг нь `A`
 * гэж тавиад анхааруулга болгон үлдээвэл админ анзаарахгүй өнгөрөх эрсдэлтэй
 * тул тийм асуултыг алгасаад, тоо нь урьдчилан харах хэсэгт дутуу гарна.
 */
function parseExam(lines: string[]): Pack[] {
  const packs: Pack[] = [];
  let name = '';
  let fileName = '';
  let questions: { text: string; options: string[] }[] = [];
  let key = new Map<number, string>();
  let inKey = false;
  let pendingNo: number | null = null;

  const flush = () => {
    if (questions.length === 0) return;
    const built = questions
      .map((q, i) => {
        const letter = key.get(i + 1);
        const correct = letter ? 'ABCD'.indexOf(letter.toUpperCase().replace('А', 'A')) : -1;
        if (correct < 0 || correct >= q.options.length) return null;
        return {
          type: 'multiple_choice',
          question: q.text,
          options: q.options,
          correct,
          points: 10,
        } as Question;
      })
      .filter(Boolean) as Question[];
    if (built.length) packs.push({ name: name || fileName || `Багц ${packs.length + 1}`, questions: built });
    questions = [];
    key = new Map();
    inKey = false;
    name = '';
  };

  for (const line of lines) {
    const file = line.match(FILE_MARK);
    if (file) {
      flush();
      fileName = file[1].replace(/\.[a-z0-9]+$/i, '');
      continue;
    }

    const testNo = line.match(/^.*\btest\s*:\s*(\S+)/i);
    if (testNo && !inKey) name = `Test ${testNo[1]}`;

    if (KEY_HEAD.test(line)) { inKey = true; continue; }

    if (inKey) {
      // Хоёр хэлбэр: «1 B» нэг мөрөнд, эсвэл «1» / «B» ээлжлэн.
      const pair = line.match(/^(\d{1,3})\s*[.):-]?\s*([A-DА-Д])$/i);
      if (pair) { key.set(Number(pair[1]), pair[2]); pendingNo = null; continue; }
      if (/^\d{1,3}$/.test(line)) { pendingNo = Number(line); continue; }
      if (/^[A-DА-Д]$/i.test(line) && pendingNo != null) { key.set(pendingNo, line); pendingNo = null; }
      continue;
    }

    const opt = line.match(OPT_LINE);
    if (opt && questions.length) { questions[questions.length - 1].options.push(opt[2]); continue; }

    const q = line.match(Q_LINE);
    if (q) { questions.push({ text: q[2], options: [] }); continue; }

    if (SKIP_LINE.test(line)) continue;
    // Тайлбар/гарчгийн мөр — асуулт руу залгахгүй, зүгээр алгасна.
  }
  flush();
  return packs;
}
