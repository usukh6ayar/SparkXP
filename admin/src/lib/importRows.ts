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

/**
 * Шалгалтын бичгийн толгой мөрөөс сэдэв ба түвшинг уншина.
 *
 * Толгой мөрийг хүн бүр яг ижилхэн бичдэггүй тул хоёр хэлбэрийг хоёуланг нь
 * хүлээж авна:
 *
 *   `Level: A1 | Lesson: Be — am / is / are | Test: 1`   ← талбар бүр нэрлэгдсэн
 *   `A1 — Lesson 2 / Grammar lesson — TEST 1`             ← түвшин ганцаараа
 *   `Lesson content: Be — am / is / are`
 */
export function examMeta(text: string): ImportMeta {
  const meta: ImportMeta = {};
  // `|` эсвэл мөрийн төгсгөл хүртэл — толгой мөр нэг мөрөнд хэд хэдэн талбартай.
  const lesson = text
    .match(/\b(?:lesson(?:\s*content)?|topic|сэдэв|хичээл)\s*:\s*([^|\n\r]+)/i)?.[1]
    ?.trim();
  if (lesson) meta.topic = lesson;
  const level =
    text.match(/\blevel\s*:?\s*([a-c][12])\b/i)?.[1] ??
    // Нэрлэгдээгүй бол зөвхөн **толгой хэсгээс** хайна — асуултын текст дотор
    // санамсаргүй таарсан «B1» түвшин болж хувирах ёсгүй.
    examHead(text).match(/\b([a-c][12])\b/i)?.[1];
  if (level) meta.level = level.toLowerCase();
  return meta;
}

/** Эхний дугаарласан асуулт хүртэлх мөрүүд = баримтын толгой (дээд тал нь 10). */
function examHead(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const firstQuestion = lines.findIndex((l) => Q_LINE.test(l));
  const end = firstQuestion < 0 ? 10 : Math.min(firstQuestion, 10);
  return lines.slice(0, end).join('\n');
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
 *
 * ⚠️ **Гол дүрэм: агуулга нь ижил бол хэлбэр нь ялгаатай ч ажиллана.** Ижил
 * тестийг хүн болгон өөрөөр бичдэг — доорх хувилбар яг дээрхтэй ижил
 * үр дүн өгөх ёстой:
 *
 *   A1 — Lesson 2 / Grammar lesson — TEST 1     ← «Level:» гэж нэрлээгүй
 *   Lesson content: Be — am / is / are          ← «Lesson:» биш
 *   1. My sister ___ at home today.
 *   A. are
 *   …
 *   ANSWER KEY — TEST 1                         ← гарчгийн ард нэмэлт үг
 *   1. B                                        ← хүснэгт биш, нэг мөрөнд
 *   2. C
 *
 * Тиймээс шинэ дүрэм нэмэхдээ **хатуу тэнцүүлэхээс зайлсхий** (`=== 'ANSWER
 * KEY'` гэх мэт): бага зэрэг өөр бичигдсэн баримт «Асуулт олдсонгүй» гэж
 * унах нь админд ойлгомжгүй бөгөөд буруутай мэт мэдрэгддэг.
 */

/** `1.` / `1)` — асуултын эхлэл. */
const Q_LINE = /^(\d{1,3})\s*[.)]\s*(.+)$/;
/** `A.` / `A)` — сонголт. Кирилл А–Д-г мөн хүлээж авна. */
const OPT_LINE = /^([A-DА-Д])\s*[.)]\s*(.+)$/i;
/**
 * Хариултын хэсгийн эхлэл.
 *
 * Гарчгийн ард нэмэлт («ANSWER KEY — TEST 1», «Хариулт: Тест 2») байж болох ба
 * тэр нэмэлт нь **цэг тэмдгээр** эхэлсэн байх ёстой. Ингэснээр «Answer keys are
 * listed below» гэх мэт энгийн өгүүлбэр гарчиг гэж андуурагдахгүй.
 */
const KEY_HEAD = /^(answer\s*keys?|answers?|хариулт(ын)?(\s*түлхүүр)?)\s*([^\w\s].*)?$/i;
/**
 * `1. B` — хариултын нэг мөр. Агуулга нь ганц үсэг тул асуулт БИШ; `Q_LINE`-тай
 * давхцдаг учир үүнийг эхэлж шалгана.
 */
const ANS_LINE = /^(\d{1,3})\s*[.):-]?\s*([A-DА-Д])$/i;
/** `Test: 1` · `TEST 1` · `Test #2` — багцын нэр. Цэг заавал биш. */
const TEST_LINE = /\btest\s*[:#№-]?\s*(\d{1,3})\b/i;
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
 * Багцын нэр: баримтын `Test N` мөр → байхгүй бол файлын нэр → эцэст нь
 * «Багц N». Хариултын түлхүүргүй асуултыг **хаяхгүй**: зөв хариултыг нь `A`
 * гэж тавиад анхааруулга болгон үлдээвэл админ анзаарахгүй өнгөрөх эрсдэлтэй
 * тул тийм асуултыг алгасаад, тоо нь урьдчилан харах хэсэгт дутуу гарна.
 * Хэрэв **юу ч үлдэхгүй** бол чимээгүй хоосон буцаахын оронд алдаа шиднэ —
 * «Асуулт олдсонгүй» гэдэг нь яагаад гэдгийг хэлдэггүй.
 *
 * Нэг файлд олон тест дараалан байж болно: `Test N` толгой (эсвэл хариултын
 * хэсгийн дараа дахин эхэлсэн асуулт) гарвал өмнөх багцыг хаана.
 */
function parseExam(lines: string[]): Pack[] {
  const packs: Pack[] = [];
  let name = '';
  let fileName = '';
  let questions: { text: string; options: string[] }[] = [];
  let key = new Map<number, string>();
  let inKey = false;
  let pendingNo: number | null = null;
  /** Асуулт олдсон мөртөө түлхүүргүйн улмаас бүгд хаягдсан уу. */
  let droppedNoKey = false;

  const flush = () => {
    if (questions.length === 0) { inKey = false; pendingNo = null; name = ''; return; }
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
    else droppedNoKey = true;
    questions = [];
    key = new Map();
    inKey = false;
    pendingNo = null;
    name = '';
  };

  for (const line of lines) {
    const file = line.match(FILE_MARK);
    if (file) {
      flush();
      fileName = file[1].replace(/\.[a-z0-9]+$/i, '');
      continue;
    }

    if (KEY_HEAD.test(line)) { inKey = true; pendingNo = null; continue; }

    // Багцын нэр. Асуулт/сонголтын мөрийг хөндөхгүй — тэдгээрийн текст дотор
    // санамсаргүй «test 2» таарвал багц хуваагдах ёсгүй.
    if (!Q_LINE.test(line) && !OPT_LINE.test(line)) {
      const testNo = line.match(TEST_LINE);
      if (testNo) {
        // Хариултын хэсгийн дараа шинэ «Test N» гарвал өмнөх тест дууссан.
        if (inKey) flush();
        name = `Test ${testNo[1]}`;
      }
    }

    if (inKey) {
      // Гурван хэлбэр: «1 B» / «1. B» нэг мөрөнд, эсвэл хүснэгтийн улмаас
      // «1» / «B» гэж ээлжлэн.
      const pair = line.match(ANS_LINE);
      if (pair) { key.set(Number(pair[1]), pair[2]); pendingNo = null; continue; }
      if (/^\d{1,3}$/.test(line)) { pendingNo = Number(line); continue; }
      if (/^[A-DА-Д]$/i.test(line) && pendingNo != null) { key.set(pendingNo, line); pendingNo = null; continue; }
      // Жинхэнэ асуулт эргэж ирвэл энэ бол дараагийн тест — хаагаад цааш нь
      // энгийнээр уншина. Бусад мөр (хүснэгтийн «Question» толгой г.м) хог.
      if (!Q_LINE.test(line)) continue;
      flush();
    }

    const opt = line.match(OPT_LINE);
    if (opt && questions.length) { questions[questions.length - 1].options.push(opt[2]); continue; }

    // «1. B» — асуулт биш, хариулт. «ANSWER KEY» гарчиггүй бичигт хариултын
    // хэсэг ингэж эхэлдэг тул түүгээр нь таана.
    const ans = line.match(ANS_LINE);
    if (ans && questions.length >= Number(ans[1])) {
      inKey = true;
      key.set(Number(ans[1]), ans[2]);
      continue;
    }

    const q = line.match(Q_LINE);
    if (q) { questions.push({ text: q[2], options: [] }); continue; }

    if (SKIP_LINE.test(line)) continue;
    // Тайлбар/гарчгийн мөр — асуулт руу залгахгүй, зүгээр алгасна.
  }
  flush();

  if (!packs.length && droppedNoKey) {
    throw new Error(
      'Асуултууд олдсон ч зөв хариулт нь олдсонгүй. Баримтын төгсгөлд ' +
      '«ANSWER KEY» гэсэн мөр, доор нь «1. B» хэлбэрийн хариултууд байх ёстой.',
    );
  }
  return packs;
}
