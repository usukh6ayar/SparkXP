/**
 * Дасгалын **чанарын шалгагч** — "сурагч үүнийг үнэхээр зөв хийж чадах уу?"
 *
 * Яагаад хэрэгтэй вэ: AI-гаар үүсгэсэн дасгалууд англи хэлний хувьд төгс
 * харагдаж байгаад **логикийн хувьд хариулах боломжгүй** байдаг. Бодит
 * жишээнүүд (бүгд аппад гарч байсан):
 *
 *  · Сонсголын дасгал сонсох яриагүй → «Сара хэдэд босдог вэ?» гэж асуухдаа
 *    Сарагийн тухай юу ч хэлээгүй.
 *  · `My ___ is a doctor. He helps sick people.` → түлхүүр `father`, гэтэл
 *    `brother` · `uncle` · `grandfather` бүгд адил зөв.
 *  · `I like ___ (swim)` маягийн gerund/infinitive дасгал → `swimming` ба
 *    `to swim` хоёул зөв мөртлөө нэг нь л тэнцдэг.
 *
 * Эдгээрийн нийтлэг шинж нь нэг: **зөв хийсэн сурагч буруу гэж тэмдэглэгдэнэ.**
 * Энд байгаа шалгалтууд яг тэр тохиолдлуудыг барина.
 *
 * Энд зөвхөн цэвэр функцууд (сүлжээ/DB хөндөхгүй) — үүсгэх үед ч, хадгалах
 * үед ч, байгаа контентыг тайлагнах үед ч ижил дүрэм ажиллана (DRY).
 */
import { isListeningQuiz, MIN_LISTENING_SCRIPT } from './ai-generate';

/**
 * `block` = хэзээ ч зөвшөөрөхгүй (объектив эвдрэл — хадгалалт татгалзана).
 * `warn`  = магадгүй эвдэрсэн (хүн шийднэ — админд жагсаана).
 */
export type IssueSeverity = 'block' | 'warn';

export interface QualityIssue {
  severity: IssueSeverity;
  /** Асуултын дугаар (1-ээс). Дасгал бүхэлдээ хамаарвал `null`. */
  questionNo: number | null;
  message: string;
}

/** Шалгахад хангалттай хэмжээний дасгал (entity ч, DTO ч, AI ноорог ч болно). */
export interface QuizLike {
  category?: string | null;
  /** Сорил хуудасны ур чадвар — `category: 'soril'` үед ЭНЭ нь шийднэ. */
  quizType?: string | null;
  passageText?: string | null;
  audioUrl?: string | null;
  questions?: unknown;
}

interface RawQ {
  type?: unknown;
  question?: unknown;
  prompt?: unknown;
  options?: unknown;
  correct?: unknown;
  answer?: unknown;
  choices?: unknown;
  pairs?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter(Boolean) : [];

/** Харьцуулахад: жижиг үсэг, цэг таслал, давхар зайг арилгана. */
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Цоорхойн ард үндсэн хэлбэр хаалтанд бий юу — ж: `She ___ (go) to school.`
 *
 * Энэ нь хоёрдмол утгыг арилгах гол хэрэгсэл: аль үгийг хувиргахыг заасан тул
 * зөв хариулт цорын ганц болно. Байвал "утгаараа сонгох" шалгалтуудыг алгасана.
 */
const hasBaseFormHint = (question: string): boolean =>
  /\([a-z][a-z\s]*\)/i.test(question);

/**
 * Хоёр үг нэг үгийн өөр хэлбэрүүд мөн үү (`play` · `plays` · `playing`).
 * Эхний 2 үсэг таарвал нэг гэр бүл гэж үзнэ — `go`/`goes`/`going` шиг богино
 * үгсийг ч барихын тулд босго нам байна.
 */
function sameWordFamily(a: string, b: string): boolean {
  const x = norm(a).replace(/^to\s+/, '');
  const y = norm(b).replace(/^to\s+/, '');
  if (!x || !y) return false;
  if (x === y) return true;
  const n = Math.min(x.length, y.length, 2);
  return x.slice(0, n) === y.slice(0, n);
}

/**
 * Сонголтууд **нэг үгийн хэлбэрүүд** мөн үү.
 *
 * Жор нь "сонголт бүр нэг үгийн өөр хэлбэр байх" гэж шаарддаг: тэгвэл асуулт
 * нь дүрэм шалгасан болж, зөв хариулт цорын ганц байна. Харин сонголтууд
 * огт өөр утгатай үгс бол (`cook` · `sing` · `eat` · `clean`) өгүүлбэрт
 * хэд хэдэн нь тохирч, сурагч таамаглана.
 */
function looksLikeWordForms(answer: string, choices: string[]): boolean {
  const related = choices.filter((c) => sameWordFamily(answer, c)).length;
  // 4 сонголтоос дор хаяж 3 нь нэг гэр бүлийнх байх ёстой (өөрөө нь орсон).
  return related * 4 >= choices.length * 3;
}

/**
 * Gerund ↔ infinitive хос байна уу — ж: `swimming` ба `to swim`.
 *
 * `like` · `love` · `start` · `prefer` зэрэг үйл үгийн ард **хоёулаа зөв**
 * байдаг тул ийм хос сонголтод орвол зөв хариулсан сурагч буруу гэж
 * тэмдэглэгдэнэ. Энэ нь бодит гомдол болж ирсэн тохиолдол.
 */
function hasGerundInfinitivePair(choices: string[]): boolean {
  const gerunds = choices.filter((c) => /\w+ing$/i.test(norm(c)));
  const infinitives = choices.filter((c) => /^to\s+\w+/i.test(norm(c)));
  return gerunds.some((g) =>
    infinitives.some((inf) => sameWordFamily(g.replace(/ing$/i, ''), inf)),
  );
}

/**
 * Эзэмшлийн `'s`-ийг эхлээд авна.
 *
 * ⚠️ Үүнгүйгээр `Tom's` → `Toms` болж, яриан дахь `Tom`-той таарахаа больж
 * "энэ нэр яриан дотор алга" гэсэн ХУДАЛ дуулга өгдөг байв.
 */
const dropPossessive = (s: string): string => s.replace(/['’]s\b/gi, '');

/**
 * Утга агуулаагүй үйлчилгээний үгс.
 *
 * Хариултыг яриатай тулгахад эдгээрийг тооцвол «By the library» гэсэн зөв
 * хариулт «beside the library» гэсэн яриатай тохирохгүй болно — учир нь `by`
 * нь дотор нь байхгүй. Утга нь `library` дээр байгаа, тэр л чухал.
 */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'for',
  'from',
  'with',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'he',
  'she',
  'it',
  'they',
  'we',
  'you',
  'his',
  'her',
  'its',
  'their',
  'this',
  'that',
  'these',
  'those',
  'there',
  'has',
  'have',
  'had',
  'will',
  'would',
  'can',
  'could',
  'not',
  'no',
  'yes',
  'do',
  'does',
  'did',
]);

/** Хариултын утга агуулсан үгс (үйлчилгээний үг ба богино үгийг хасна). */
function contentWords(text: string): string[] {
  return norm(dropPossessive(text))
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Утгын үг яриан дотор сонсогдсон уу — **үгийн хэлбэрийн өөрчлөлтийг тооцно.**
 *
 * `local` ↔ `locally`, `excite` ↔ `excited` зэрэг нь ижил утга боловч өөр үг
 * тул яг тулгавал таарахгүй. Эхний 4 үсгээр нь харьцуулснаар ийм хосууд
 * таарна. Энэ нь анхааруулгын түвшний эвристик — андуурвал зөвхөн нэг
 * анхааруулга дутна, контент хаагдахгүй.
 */
const STEM_MIN = 4;
function heardLike(heardWords: Set<string>, word: string): boolean {
  if (heardWords.has(word)) return true;
  if (word.length < STEM_MIN) return false;
  const stem = word.slice(0, STEM_MIN);
  for (const h of heardWords) {
    if (
      h.length >= STEM_MIN &&
      (h.startsWith(stem) || word.startsWith(h.slice(0, STEM_MIN)))
    ) {
      return true;
    }
  }
  return false;
}

/** Үг бүтнээрээ (дэд-мөр биш) текстэд байна уу. */
function containsWord(haystack: string, needle: string): boolean {
  const words = new Set(norm(dropPossessive(haystack)).split(' '));
  return norm(dropPossessive(needle))
    .split(' ')
    .every((w) => words.has(w));
}

/** Текстээс том үсгээр эхэлсэн нэрсийг түүнэ (өгүүлбэрийн эхнийхийг алгасна). */
/**
 * Том үсгээр бичигддэг ч **хүний нэр биш** үгс.
 *
 * ⚠️ Бодит алдаа (Choi, 2026-08-15): «Friday» гэдгийг нэр гэж үзээд
 * «сурагч тэр хүн хэн болохыг мэдэх аргагүй» гэж бүтэн Section-ыг БЛОКЛОСОН
 * тул 40 асуулттай шалгалт 30 болж дутуу үүссэн. Гараг, сар, хэл/улсын нэр
 * зэрэг нь асуултад байгаад ярианд байхгүй байх нь бүрэн хэвийн — тэдгээр нь
 * заавал сонсогдох ёстой ЭТГЭЭД биш, зүгээр л нэр томьёо.
 */
const NOT_PERSON_NAMES = new Set(
  [
    // Гараг · сар
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
    // Хэл · үндэстэн · нийтлэг том үсэгт нэр томьёо
    'English',
    'Mongolian',
    'Chinese',
    'Japanese',
    'Korean',
    'Spanish',
    'French',
    'German',
    'Russian',
    'Internet',
    'University',
    'College',
    'Library',
    'Reception',
    'Student',
    'Teacher',
    'Professor',
    'Doctor',
    'Manager',
  ].map((w) => w.toLowerCase()),
);

function properNouns(text: string): string[] {
  const words = text.split(/(?<=[.!?])\s+|\n+/).flatMap((sentence) =>
    dropPossessive(sentence)
      .trim()
      .split(/\s+/)
      // Өгүүлбэрийн ЭХНИЙ үг том үсэгтэй байх нь хэвийн — нэр гэж үзэхгүй.
      .slice(1)
      .filter((w) => /^[A-Z][a-z]{2,}$/.test(w.replace(/[^A-Za-z]/g, ''))),
  );
  return [...new Set(words.map((w) => w.replace(/[^A-Za-z]/g, '')))].filter(
    (w) => !NOT_PERSON_NAMES.has(w.toLowerCase()),
  );
}

/** Нэг асуултыг шалгана. `script` = сонсголын яриа (байвал). */
function checkQuestion(
  raw: RawQ,
  no: number,
  script: string,
  isListening: boolean,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const add = (severity: IssueSeverity, message: string) =>
    issues.push({ severity, questionNo: no, message });

  const type = str(raw.type);
  const question = str(raw.question) || str(raw.prompt);

  if (type !== 'word_match' && !question) {
    add('block', 'Асуултын текст хоосон.');
    return issues;
  }

  if (type === 'multiple_choice') {
    const options = strList(raw.options);
    const correct = typeof raw.correct === 'number' ? raw.correct : -1;

    if (options.length < 2) add('block', 'Сонголт 2-оос цөөн байна.');
    if (correct < 0 || correct >= options.length) {
      add('block', 'Зөв хариултын дугаар сонголтын тоонд багтахгүй байна.');
    }
    if (new Set(options.map(norm)).size !== options.length) {
      add('block', 'Сонголтууд давхардсан — хоёр ижил хариулт байна.');
    }
    // Хариулт нь асуултын дотор шууд бичээстэй бол дасгал утгагүй болно.
    // ⚠️ Үгийн заагаар л шалгана: дэд-мөрөөр шалгахад «hat» нь «What» дотроос
    // олдож, хэдэн арван ХУДАЛ дуулга өгдөг байв.
    const key = options[correct];
    if (key && norm(key).length > 2 && containsWord(question, key)) {
      add('warn', `Зөв хариулт «${key}» асуултын дотор шууд бичигдсэн байна.`);
    }
  }

  if (type === 'fill_blank') {
    const answer = str(raw.answer);
    const choices = strList(raw.choices);

    if (!answer) add('block', 'Зөв хариулт хоосон.');
    if (!question.includes('___')) {
      add(
        'block',
        'Өгүүлбэрт `___` цоорхой алга — юуг нөхөхийг мэдэх аргагүй.',
      );
    }
    if (choices.length > 0 && !choices.some((c) => norm(c) === norm(answer))) {
      add(
        'block',
        'Зөв хариулт сонголтуудын дунд алга — сурагч зөв хийж чадахгүй.',
      );
    }

    if (choices.length > 0 && hasGerundInfinitivePair(choices)) {
      add(
        'block',
        'Сонголтод gerund («swimming») ба infinitive («to swim») хоёулаа байна — ' +
          '`like` · `love` · `start` зэрэг үйл үгийн ард хоёулаа зөв тул зөв ' +
          'хариулсан сурагч буруу гэж тэмдэглэгдэнэ.',
      );
    }

    // ⚠️ Хамгийн түгээмэл алдаа: утгаараа сонгох цоорхой. Хаалтанд үндсэн
    // хэлбэр (`___ (go)`) байвал зөв хариулт цорын ганц болох тул алгасна.
    if (
      answer &&
      choices.length > 0 &&
      !hasBaseFormHint(question) &&
      !looksLikeWordForms(answer, choices)
    ) {
      add(
        'warn',
        'Сонголтууд нэг үгийн хэлбэрүүд биш, өөр өөр утгатай үгс байна — ' +
          'өгүүлбэрт хэд хэдэн нь тохирч болзошгүй. Цоорхойн ард үндсэн хэлбэрийг ' +
          'хаалтанд бич (ж: «She ___ (go) to school.»).',
      );
    }
  }

  if (type === 'word_match') {
    const pairs = Array.isArray(raw.pairs) ? raw.pairs : [];
    const lefts = pairs.map((p) => str((p as { left?: unknown })?.left));
    const rights = pairs.map((p) => str((p as { right?: unknown })?.right));
    if (pairs.length < 2) add('block', 'Холбох хос 2-оос цөөн байна.');
    if (lefts.some((l) => !l) || rights.some((r) => !r)) {
      add('block', 'Дутуу хос байна (нэг тал нь хоосон).');
    }
    if (new Set(rights.map(norm)).size !== rights.length) {
      add(
        'warn',
        'Хоёр өөр үг ижил орчуулгатай — аль нь алинтай холбогдох нь тодорхойгүй.',
      );
    }
  }

  // ── Сонсголын тусгай шалгалтууд ────────────────────────────────────────
  if (isListening && script) {
    const heard = norm(script);

    // Асуултад дурдсан хүний нэр яриан дотор сонсогдоогүй бол сурагч тэр хүн
    // хэн болохыг мэдэхгүй. Бодит алдаа: яриа нь "A:"/"B:" гэж явж байхад
    // асуулт нь "What time does Sarah start work?" гэж асууж байв.
    for (const name of properNouns(question)) {
      if (!containsWord(heard, name)) {
        add(
          'block',
          `«${name}» гэдэг нэр сонсох яриан дотор огт гардаггүй — сурагч тэр ` +
            'хүн хэн болохыг мэдэх аргагүй.',
        );
      }
    }

    // ⚠️ СОНСООД НӨХӨХ дасгалын цөм дүрэм: нөхөх ёстой үг нь яриан дотор
    // ЗААВАЛ сонсогдсон байх ёстой.
    //
    // Бодит алдаа: апп яриаг дуугаар уншихад цоорхойтой өгүүлбэр нь яриан
    // дотор огт байдаггүй тул сурагч нөхөх үгээ хэзээ ч сонсдоггүй байв.
    // «Ямар үг уншиж байгааг нь мэдэж байж л нөхөж чадна» — тиймээс энэ нь
    // анхааруулга биш, БЛОКЛОХ дүрэм.
    if (type === 'fill_blank') {
      const answer = str(raw.answer);
      if (answer && !containsWord(heard, answer)) {
        add(
          'block',
          `Нөхөх үг «${answer}» сонсох яриан дотор огт сонсогдохгүй байна — ` +
            'сурагч ямар үг байхыг сонсоогүй тул нөхөж чадахгүй.',
        );
      }
      // Цоорхойтой өгүүлбэр өөрөө ч яриан дотор гарсан байх ёстой. Эс бөгөөс
      // сурагч огт өөр яриа сонсоод, хамааралгүй өгүүлбэр нөхөх болно.
      const sentenceWords = norm(question.replace(/_+/g, ' '))
        .split(' ')
        .filter((w) => w.length > 2);
      const heardCount = sentenceWords.filter((w) =>
        containsWord(heard, w),
      ).length;
      if (sentenceWords.length >= 3 && heardCount * 2 < sentenceWords.length) {
        add(
          'block',
          'Цоорхойтой өгүүлбэр сонсох яриан дотор гардаггүй — сурагч ' +
            'сонсоогүй өгүүлбэрээ нөхөх боломжгүй.',
        );
      }
      return issues;
    }

    // Сонсголын асуултын хариулт нь яриан дотор сонсогдсон байх ёстой.
    // Тоо/цагийг («7:30» ↔ «half past seven») бичгээр тулгах боломжгүй тул
    // зөвхөн үгэн хариултыг шалгана. Энэ нь `warn` — сонголтот асуултын
    // хариулт нь яриаг ойлгосон эсэхийг шалгадаг, үг таних биш.
    const key = strList(raw.options)[
      typeof raw.correct === 'number' ? raw.correct : -1
    ];
    /*
     * ⚠️ Хариултыг **бүтэн хэллэгээр нь** тулгаж БОЛОХГҮЙ.
     *
     * Урьд нь `containsWord(heard, key)` нь хариултын үг БҮРИЙГ шаарддаг
     * байсан тул «By the library» гэсэн зөв хариулт «It's beside the library»
     * гэсэн яриатай тохирохгүй (`by` дотор нь алга) — 8 асуулттай эрүүл
     * дасгалын 4 нь анхааруулга авч, админ өөрийгөө буруу хийсэн гэж боддог
     * байв. Хагас нь дохио өгдөг анхааруулга бол дохио биш, шуугиан.
     *
     * Одоо **утгын үг**-ээр шалгана: ядаж нэг нь сонсогдож байвал хариулт нь
     * яриатай холбоотой — өөр үгээр илэрхийлэгдсэн байж болно, тэр нь
     * сонсголын шалгалтын хэвийн зүйл.
     */
    const keyWords = contentWords(key ?? '');
    const heardWords = new Set(norm(dropPossessive(heard)).split(' '));
    const answerHeard =
      !!key &&
      (keyWords.length === 0 || keyWords.some((w) => heardLike(heardWords, w)));
    if (
      key &&
      /^[\p{L}\s']+$/u.test(key) &&
      keyWords.length > 0 &&
      !answerHeard
    ) {
      add(
        'warn',
        `Зөв хариулт «${key}»-тай холбоотой үг сонсох яриан дотор олдсонгүй. ` +
          'Өөр үгээр илэрхийлсэн бол зүгээр — сурагч ярианаас дүгнэж чадаж ' +
          'байгаа эсэхийг л шалгаарай.',
      );
    }

    /*
     * ⚠️ Сонголтот асуулт нь яриатай ОГТ холбоогүй бол → БЛОКЛОНО.
     *
     * Яагаад «зөв хариулт яриан дотор байх ёстой» гэдгийг блок болгож
     * БОЛОХГҮЙ вэ (Choi асуусан, 2026-08-14): жинхэнэ сонсголын шалгалтын
     * хариулт ихэвчлэн **өөр үгээр илэрхийлэгддэг** — «I'll take the 8:15»
     * гэж сонсоод «Which train?» → «The earlier one». Тийм асуултыг хаавал
     * зөвхөн үг тааруулах гүехэн дасгал үлдэнэ, сонсоод ОЙЛГОХ чадвар
     * шалгагдахаа болино.
     *
     * Тиймээс блоклох шугамыг **бодит эвдрэл** дээр татав: асуулт нь ч,
     * хариулт нь ч яриатай холбоогүй = яриан дотор огт дурдагдаагүй зүйлийг
     * асуусан хэрэг. Аль нэг нь сонсогдож байвал (өөр үгээр илэрхийлсэн ч)
     * дасгал хүчинтэй хэвээр — зөвхөн анхааруулга.
     */
    /*
     * ⚠️ Энд ч мөн **утгын үг** — өмнө нь асуултын үгийн олонх нь яриан дотор
     * байхыг шаарддаг байсан тул «Where did the mayor speak?» гэсэн бүрэн
     * зөв асуулт ч блоклогдож, дасгал бүхэлдээ аппаас алга болох эрсдэлтэй
     * байв (`where`/`did`/`speak` нь ярианд байхгүй, `mayor` л байсан).
     * Одоо утгын үг НЭГ Ч сонсогдоогүй үед л блоклоно — тэр нь «яриан дотор
     * огт дурдагдаагүй зүйлийг асуусан» гэсэн жинхэнэ эвдрэл.
     */
    const askWords = contentWords(question);
    const askHeard = askWords.filter((w) => heardLike(heardWords, w)).length;
    if (askWords.length >= 3 && askHeard === 0 && !answerHeard) {
      add(
        'block',
        'Асуулт ч, зөв хариулт ч сонсох яриан дотор гардаггүй — сурагч ' +
          'сонсоогүй зүйлээ таамаглахаас өөр аргагүй болно.',
      );
    }
  }

  return issues;
}

/**
 * Дасгалыг бүхэлд нь шалгана.
 *
 * `block` төрлийн олдвор байвал дасгал **хадгалагдах ёсгүй**; `warn` нь
 * админд жагсаагдана.
 */
export function checkQuiz(quiz: QuizLike): QualityIssue[] {
  const issues: QualityIssue[] = [];
  // ⚠️ `category` дангаар нь БИШ: Сорил хуудасны сонсголын дасгалд ур чадвар нь
  // `quizType`-д байдаг тул урьд нь бүх сонсголын шалгалт алгасагдаж, сонсох
  // зүйлгүй «сонсголын» дасгал үүсэх боломжтой байв.
  const isListening = isListeningQuiz(quiz);
  const script = (quiz.passageText ?? '').trim();

  // Сонсголд сонсох зүйл заавал (бодит бичлэгтэй бол бичвэр шаардахгүй).
  if (
    isListening &&
    !quiz.audioUrl?.trim() &&
    script.length < MIN_LISTENING_SCRIPT
  ) {
    issues.push({
      severity: 'block',
      questionNo: null,
      message:
        'Сонсголын дасгалд сонсох яриа алга — асуултууд эх мэдээлэлгүй үлдэж, ' +
        'сурагч таамаглахаас өөр аргагүй болно.',
    });
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  if (questions.length === 0) {
    issues.push({
      severity: 'block',
      questionNo: null,
      message: 'Асуулт алга.',
    });
    return issues;
  }

  const seen = new Map<string, number>();
  questions.forEach((raw, i) => {
    const q = (raw ?? {}) as RawQ;
    issues.push(...checkQuestion(q, i + 1, script, isListening));

    // Нэг дасгал дотор давхардсан асуулт — сурагч ижил зүйлийг хоёр удаа хийнэ.
    const key = norm(str(q.question) || str(q.prompt));
    if (key) {
      const first = seen.get(key);
      if (first) {
        issues.push({
          severity: 'warn',
          questionNo: i + 1,
          message: `${first}-р асуулттай яг ижил байна.`,
        });
      } else seen.set(key, i + 1);
    }
  });

  return issues;
}

/** Хадгалахыг зогсоох ёстой олдворууд. */
export const blockingIssues = (issues: QualityIssue[]): QualityIssue[] =>
  issues.filter((i) => i.severity === 'block');

/** Олдворуудыг нэг мөр мессеж болгоно (админд шууд харуулах). */
export function describeIssues(issues: QualityIssue[]): string {
  return issues
    .map((i) =>
      i.questionNo ? `${i.questionNo}-р асуулт: ${i.message}` : i.message,
    )
    .join(' ');
}
