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

  // «Үг холбох» нь хос-хосоороо бүтэцтэй тул мөр болгон задарч чадахгүй.
  if (type === 'word_match') {
    throw new Error('Холбох төрөлд зөвхөн JSON массив дэмжинэ');
  }

  const packs = new Map<string, Question[]>();
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
