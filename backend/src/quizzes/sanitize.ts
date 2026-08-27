/**
 * Хариултын түлхүүрийг сурагчийн хариунаас хасах.
 *
 * ⚠️ Яагаад хэрэгтэй вэ: `GET /quizzes` ба `GET /quizzes/:id` нь Quiz entity-г
 * **бүтнээр нь** буцаадаг байсан — өөрөөр хэлбэл `multiple_choice`-ийн
 * `correct` индекс, `fill_blank`-ийн `answer` мөр хоёулаа сүлжээний хариунд
 * ил явдаг байв. Аппын код тэдгээрийг ашигладаггүй ч энэ нь хамаагүй: DevTools,
 * proxy, эсвэл гар аргаар хийсэн хүсэлт бүр дасгалын бүх хариултыг харуулна.
 * Дасгал болгоныг 100% -иар «шийдэх» боломжтой байсан гэсэн үг.
 *
 * Хаана хэрэглэх вэ: сурагчид өгөх бүх зам. Админ/модератор бүтнээр нь авна —
 * контентоо засахын тулд хариулт нь хэрэгтэй.
 */

/** Аль дүр хариултаа харах эрхтэй вэ (контент засдаг хүмүүс). */
export const STAFF_ROLES = ['admin', 'super_admin', 'moderator'] as const;

export function canSeeAnswers(role?: string | null): boolean {
  return STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]);
}

/**
 * Аль дүр **даалгаврын санг** (`Quiz.assignOnly`) жагсаалтаас харах вэ.
 *
 * Багш нэмэгдсэн нь энэ сангаас даалгавар сонгодог хүн тэр — гэхдээ
 * `canSeeAnswers`-т ОРООГҮЙ хэвээр: багш асуултаа хараад сонгоно, зөв
 * хариултын түлхүүр хэрэггүй.
 *
 * ⚠️ Сурагч энэ жагсаалтад хэзээ ч орохгүй. Тэдний цорын ганц зам нь
 * өөрсдөд нь оногдсон `assignments` мөр (`GET /quizzes/:id?assignmentId=`).
 */
export function canSeeAssignmentBank(role?: string | null): boolean {
  return canSeeAnswers(role) || role === 'teacher';
}

/** Fisher–Yates — байрлалаараа түлхүүрээ задлахгүйн тулд. */
function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Нэг асуултаас түлхүүрийг нь хасна.
 *
 * Төрөл бүрд өөр зүйл хасагдана:
 * - `multiple_choice` — `correct` индекс. `options` үлдэнэ (сонгох зүйл).
 * - `fill_blank` — `answer`. `choices` үлдэнэ: тэдгээр нь аль хэдийн холигдсон
 *   4 хувилбар бөгөөд зөв нь дотор нь байх нь дасгалын мөн чанар.
 * - `word_match` — хосууд үлдэнэ, харин **баруун багана нь холигдоно**. Апп
 *   зүүн жагсаалт ба сонголтын жагсаалтыг үүнээс угсардаг тул хос нь
 *   эгнээгээрээ таарч байвал зөв хариулт нь шууд уншигдана. Холивол харагдах
 *   байдал ижил, түлхүүр нь алга. (Шалгалт нь сервер дээр (left,right)
 *   тэнцүүгээр хийгддэг тул дараалал нөлөөлөхгүй.)
 * - `open_response` — юу ч хасахгүй: `modelAnswer` нь ЗОРИУД харуулдаг зүйл
 *   (өөрөө үнэлэх даалгавар), сервер түүнийг хэзээ ч оноодоггүй.
 */
export function stripAnswer(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const q = raw as Record<string, unknown>;

  if (q.type === 'multiple_choice') {
    const { correct: _correct, ...rest } = q;
    return rest;
  }

  if (q.type === 'fill_blank') {
    const { answer: _answer, ...rest } = q;
    return rest;
  }

  if (q.type === 'word_match' && Array.isArray(q.pairs)) {
    const pairs = q.pairs as { left: string; right: string }[];
    const rights = shuffle(pairs.map((p) => p.right));
    return { ...q, pairs: pairs.map((p, i) => ({ ...p, right: rights[i] })) };
  }

  return q;
}

/** Дасгалын бүх асуултаас түлхүүрийг хасна. */
export function stripAnswers<T extends { questions?: unknown[] }>(quiz: T): T {
  if (!Array.isArray(quiz.questions)) return quiz;
  return { ...quiz, questions: quiz.questions.map(stripAnswer) };
}
