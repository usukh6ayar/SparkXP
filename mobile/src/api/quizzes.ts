import { apiRequest } from './client';
import type { HeartsState } from './hearts';

export interface QuizQuestion {
  type: 'multiple_choice' | 'fill_blank' | 'word_match' | 'open_response';
  question?: string;
  options?: string[];   // multiple_choice only
  imageUrl?: string | null; // picture-guess multiple_choice / IELTS Writing chart
  pairs?: { left: string; right: string }[]; // word_match only
  // open_response (IELTS Writing/Speaking): self-study prompt, never auto-graded.
  prompt?: string;
  modelAnswer?: string;
  bandNote?: string;
  /**
   * `fill_blank` — дарж сонгох 4 хувилбар (зөв хариулт нь дотор нь, эрэмбэ нь
   * холигдсон). Цоорхойг гараар бичих нь сурагчид хэт хэцүү байсан: зөв санааг
   * олсон ч үсэг алдвал буруу гэж тооцогддог. Хуучин дасгалд байхгүй тул апп
   * тэр үед бичих талбар руугаа буцна.
   */
  choices?: string[];
  /**
   * IELTS exam part this question belongs to (1–4). Absent on everything
   * authored before parts existed — `groupSections()` reads that as "part 1",
   * so an old set still runs, just undivided.
   */
  section?: number;
  points: number;
  // correct & answer are NOT returned to the client (server-side only)
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  level: string;
  xpReward: number;
  isPublished: boolean;
  lessonId: string | null;
  category: string | null;
  /** Sub-category (сэдэв) within the skill — used to group exercises on mobile. */
  topic: string | null;
  /**
   * Сорилын тоглоомын төрөл — `word_guess` · `listening` · `grammar` ·
   * `speed` · `matching` · `fill` (админы Сорил хуудасны сонголт).
   *
   * Сорилын таб үүгээр бүлэглэдэг: тэр хуудас «Сэдэв» талбаргүй тул `topic`
   * үргэлж хоосон байдаг ба энэ л мөр бүрд бөглөгддөг цорын ганц ангилал.
   */
  quizType: string | null;
  /** Хэзээ нэмэгдсэн — «Шинэ» тэмдэг ба эрэмбэлэлтэд ашиглана. */
  createdAt: string;
  /**
   * **Даалгаврын сан** — зөвхөн багш даалгавар болгож өгсний дараа нээгдэнэ.
   *
   * Сурагчийн жагсаалтад ийм мөр огт ирдэггүй (сервер шүүнэ) тул зөвхөн
   * багшийн оноох дэлгэц дээр л утгатай.
   */
  assignOnly?: boolean;
  /** IELTS Reading: passage shown above the questions (null for other quizzes). */
  passageText: string | null;
  /** IELTS Listening: the section's recording (null for other quizzes). */
  audioUrl: string | null;
  /**
   * `fill_blank` дасгалын үгийн сан — тухайн дасгалын бүх хариултыг холисон
   * жагсаалт (сервер `GET /quizzes/:id`-д тооцоолж өгнө). Цоорхойг гараар
   * бичих нь хэт хэцүү байсан тул сурагч эндээс **дарж сонгоно**.
   * 2-оос цөөн үгтэй дасгалд ирэхгүй — тэгвэл сонголт нь хариулт өөрөө болно.
   */
  wordBank?: string[];
  questions: QuizQuestion[];
}

export interface AnswerItem {
  questionIndex: number;
  answer: number | string; // number = MC index, string = fill_blank
}

export interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  xpEarned: number;
  breakdown: { questionIndex: number; correct: boolean; points: number }[];
  /** Approximate IELTS band (0–9) — only for ielts_listening / ielts_reading. */
  band?: number;
  /** Lesson-linked tests only: the lesson's new star rating (0–3, best kept). */
  starsEarned?: number;
}

/**
 * GET /quizzes/:id
 *
 * `assignmentId` өгвөл сервер **зөвхөн тэр даалгаварт оногдсон асуултуудыг**
 * буцаана (багш 15-аас 5-ыг сонгосон бол 5). Даалгаврын сангийн дасгалыг
 * нээх цорын ганц зам ч мөн энэ — эс бөгөөс 403.
 */
export function getQuiz(
  id: string,
  token: string,
  assignmentId?: string,
): Promise<Quiz> {
  const q = assignmentId ? `?assignmentId=${assignmentId}` : '';
  return apiRequest<Quiz>(`/quizzes/${id}${q}`, { token });
}

/**
 * Багшийн **даалгаврын сан** — сурагчид нээлттэй биш, зөвхөн оноох дасгалууд.
 * Сурагчийн token-оор дуудвал хоосон ирнэ (сервер дүрээр нь шүүдэг).
 */
export function getAssignmentBank(
  token: string,
  params: { page?: number; limit?: number } = {},
): Promise<{ items: Quiz[]; total: number }> {
  let q = '/quizzes?assignOnly=true&isPublished=true';
  if (params.page) q += `&page=${params.page}`;
  q += `&limit=${params.limit ?? 100}`;
  return apiRequest<{ items: Quiz[]; total: number }>(q, { token });
}

/** GET /api/quizzes — optionally filtered by lesson (for the lesson's test).
 *  Only published quizzes are shown to students (admins can keep drafts hidden),
 *  matching how getLessons filters by isPublished. */
export function getQuizzes(
  token: string,
  params: { lessonId?: string; page?: number; limit?: number } = {},
): Promise<{ items: Quiz[]; total: number }> {
  let q = '?isPublished=true';
  if (params.lessonId) q += `&lessonId=${params.lessonId}`;
  // Серверийн анхдагч нь 20 — багшийн оноох дэлгэц бүх контентоо харах ёстой.
  if (params.page) q += `&page=${params.page}`;
  if (params.limit) q += `&limit=${params.limit}`;
  return apiRequest<{ items: Quiz[]; total: number }>(`/quizzes${q}`, { token });
}

/** GET standalone exercises (Дасгал) of a given category — not tied to a lesson.
 *  Students get published only. Used by the Home skill screens. */
export function getExercises(
  token: string,
  category: string,
): Promise<{ items: Quiz[]; total: number }> {
  return apiRequest<{ items: Quiz[]; total: number }>(
    `/quizzes?standalone=true&isPublished=true&category=${category}&limit=100`,
    { token },
  );
}

/**
 * POST /quizzes/:id/submit
 *
 * `assignmentId` нь хоёр зүйл хийнэ: багшийн самбарт гүйцэтгэлийг оноотой нь
 * бүртгэнэ, мөн оноог **сонгогдсон асуултуудаас** бодуулна (эс бөгөөс сурагч
 * 5 асуулт хараад 15-аас оноо авна).
 */
export function submitQuiz(
  id: string,
  answers: AnswerItem[],
  token: string,
  assignmentId?: string,
): Promise<QuizResult> {
  return apiRequest<QuizResult>(`/quizzes/${id}/submit`, {
    method: 'POST',
    body: { answers, assignmentId },
    token,
  });
}

/** Per-question instant feedback (C2). `correctAnswer` is returned only when the
 *  answer was wrong (mc → option index, fill_blank → string, word_match → pairs). */
export interface CheckResult {
  correct: boolean;
  correctAnswer?: number | string | { left: string; right: string }[];
  /**
   * Hearts remaining after this answer — a wrong one costs one, charged
   * server-side. Optional for two reasons: a JS-only OTA update can reach a
   * phone before the backend that returns it, and the backend omits it if
   * Redis is down. Either way the caller falls back to its last known state
   * or reconciles via `GET /hearts`.
   */
  hearts?: HeartsState;
}

/** POST /quizzes/:id/check — grade ONE answer without revealing the full key. */
export function checkAnswer(
  id: string,
  questionIndex: number,
  answer: number | string,
  token: string,
  assignmentId?: string,
): Promise<CheckResult> {
  return apiRequest<CheckResult>(`/quizzes/${id}/check`, {
    method: 'POST',
    // ⚠️ `assignmentId` заавал — эс бөгөөс сервер бүтэн тестийн индексээр
    // шалгаж, сурагчийн 3 дахь асуулт өөр асуулттай тулгагдана.
    body: { questionIndex, answer, assignmentId },
    token,
  });
}
