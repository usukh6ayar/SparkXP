import { BadRequestException } from '@nestjs/common';

/**
 * Даалгаварт **сонгосон асуултууд** — багш нэг тестээс хэсгийг нь өгөх логик.
 *
 * Жишээ: даалгаврын сангийн «Present Simple тест» 15 асуулттай. Багш эхний
 * ангидаа 1–5, дараагийнхад 6–10-ыг өгнө. Тестийг 15 тусдаа мөр болгож
 * хуваахгүйгээр үүнийг хийх зам нь `assignments.question_indexes`.
 *
 * ⚠️ **Гол дүрэм:** сурагч руу явахдаа асуултууд шүүгдэж, 0..n-1 болж **дахин
 * дугаарлагдана**. Тиймээс сервер дээр оноо шалгах, нэг хариу шалгах бүх код
 * шүүгдсэн quiz дээр ажиллах ёстой — тэгвэл индекс өөрөө таарч, гар аргаар
 * буцаан хөрвүүлэх (алдаа гаргахад амархан) шаардлагагүй болно.
 */

/**
 * Багшийн илгээсэн индексүүдийг хадгалахад бэлдэнэ.
 *
 * @param indexes  Багшийн сонголт. Хоосон/өгөөгүй = **бүх асуулт**.
 * @param total    Тухайн quiz-ийн асуултын нийт тоо.
 * @returns Давхардалгүй, өсөхөөр эрэмбэлэгдсэн индексүүд, эсвэл `null`
 *          (= бүх асуулт — хадгалахдаа NULL бичнэ).
 */
export function normalizeIndexes(
  indexes: number[] | null | undefined,
  total: number,
): number[] | null {
  if (!indexes || indexes.length === 0) return null;

  const unique = [...new Set(indexes)].sort((a, b) => a - b);
  const bad = unique.find((i) => !Number.isInteger(i) || i < 0 || i >= total);
  if (bad !== undefined) {
    throw new BadRequestException(
      `Асуултын дугаар буруу байна (${bad + 1}). Энэ тест ${total} асуулттай.`,
    );
  }

  // Бүгдийг нь сонгосон бол дэд олонлог биш — NULL бичих нь илүү үнэн, мөн
  // дараа нь тестэд асуулт нэмэгдвэл даалгавар өөрөө шинэчлэгдэнэ.
  return unique.length === total ? null : unique;
}

/**
 * Quiz-ийн сурагч руу явах хувилбарыг гаргана: зөвхөн оноосон асуултууд.
 *
 * `indexes` нь `null` бол quiz өөрөө буцна (хуулбар үүсгэхгүй) — өөрөөр хэлбэл
 * даалгаваргүй ердийн урсгал ямар ч нэмэлт зардалгүй хэвээр.
 *
 * ⚠️ **Устсан асуултыг тэвчнэ.** Даалгавар өгсний дараа админ тестээ засаад
 * асуулт хасч болно. Ийм үед байхгүй индексүүдийг чимээгүй алгасна — сурагчийн
 * гэрийн даалгавар 500 алдаа өгөхөөс дээр. Хэрэв нэг ч үлдэхгүй бол **бүтэн
 * тестийг** буцаана: асуултгүй дасгал гүйцэтгэгч дэлгэцийг унагаах бөгөөд
 * сурагчид хийх зүйлгүй үлдэнэ.
 */
export function subsetQuiz<T extends { questions: unknown[] }>(
  quiz: T,
  indexes: number[] | null,
): T {
  if (!indexes || indexes.length === 0) return quiz;

  const picked = indexes
    .filter((i) => i >= 0 && i < quiz.questions.length)
    .map((i) => quiz.questions[i]);

  if (picked.length === 0) return quiz;
  return { ...quiz, questions: picked };
}
