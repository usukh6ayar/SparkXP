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

export function getQuiz(id: string, token: string): Promise<Quiz> {
  return apiRequest<Quiz>(`/quizzes/${id}`, { token });
}

/** GET /api/quizzes — optionally filtered by lesson (for the lesson's test).
 *  Only published quizzes are shown to students (admins can keep drafts hidden),
 *  matching how getLessons filters by isPublished. */
export function getQuizzes(
  token: string,
  params: { lessonId?: string } = {},
): Promise<{ items: Quiz[]; total: number }> {
  let q = '?isPublished=true';
  if (params.lessonId) q += `&lessonId=${params.lessonId}`;
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

export function submitQuiz(
  id: string,
  answers: AnswerItem[],
  token: string,
): Promise<QuizResult> {
  return apiRequest<QuizResult>(`/quizzes/${id}/submit`, {
    method: 'POST',
    body: { answers },
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
): Promise<CheckResult> {
  return apiRequest<CheckResult>(`/quizzes/${id}/check`, {
    method: 'POST',
    body: { questionIndex, answer },
    token,
  });
}
