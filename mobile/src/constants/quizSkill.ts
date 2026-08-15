/**
 * Дасгал ямар УР ЧАДВАРЫНХ вэ — нэг л газар шийддэг.
 *
 * ⚠️ Яагаад helper хэрэгтэй вэ: ур чадвар нь админд **хоёр өөр талбарт**
 * бичигддэг.
 *   · Дасгал хуудас  → `category: 'listening' | 'writing' | 'fill' | ...`
 *   · Сорил хуудас   → `category: 'soril'`, ур чадвар нь `quizType`-д
 *   · IELTS          → `category: 'ielts_listening' | 'ielts_reading' | ...`
 *
 * Ур чадварын дэлгэц (`app/skill/[key].tsx`) гурвуулангийнх нь контентыг НЭГ
 * жагсаалтад нийлүүлдэг. Гүйцэтгэгч дэлгэц (`app/quiz/[id].tsx`) гэтэл зөвхөн
 * `category === 'listening'`-ийг л сонсгол гэж үздэг байсан тул **Сорил
 * хуудсаар үүсгэсэн сонсголын дасгал уншлага мэт нээгддэг байв** (яриа нь
 * «Уншлагын эх» болж ил гарч, тоглуулагч огт гардаггүй) — Choi B2 контент дээр
 * олсон, 2026-08-14.
 *
 * **Дүрэм:** дасгалын ур чадвараар ялгаварлах бүрд `quizSkill()`-ийг ашигла,
 * `quiz.category`-г шууд бүү харьцуул. Шинэ эх сурвалж (шинэ хуудас, шинэ
 * `ielts_*` модуль) нэмэгдвэл зөвхөн энэ файл өөрчлөгдөнө.
 *
 * (Хичээлийн ур чадварын **шошго/дүрс** нь `skills.ts` — тэр нь өөр асуулт:
 * «яаж харагдах вэ», энэ нь «юу вэ».)
 */
import { SORIL_CATEGORY } from './soril';

/** Дасгалаас ур чадварыг нь гаргаж авна (`listening` · `writing` · …). */
export function quizSkill(quiz: {
  category?: string | null;
  quizType?: string | null;
}): string | null {
  const raw = quiz.category === SORIL_CATEGORY ? quiz.quizType : quiz.category ?? quiz.quizType;
  if (!raw) return null;
  // `ielts_listening` → `listening`: IELTS модуль нь ижил ур чадварын өөр нэг
  // хэлбэр, гүйцэтгэгчийн хувьд зан төлөв нь ижил.
  return raw.startsWith('ielts_') ? raw.slice('ielts_'.length) : raw;
}

/** Сонсголын дасгал уу (эх сурвалж нь ямар ч байсан). */
export const isListeningQuiz = (quiz: {
  category?: string | null;
  quizType?: string | null;
}): boolean => quizSkill(quiz) === 'listening';
