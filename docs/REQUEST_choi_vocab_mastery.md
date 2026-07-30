# BE хүсэлт (Choi → Өсөхбаяр): үг тус бүрийн mastery + унших материалын ахиц

**Огноо:** 2026-07-30 · **Файлууд:** `backend/src/reviews/reviews.service.ts` ·
`backend/src/reading/reading.service.ts`

ROADMAP §4 → **Update 3 (Reading & Content 2.0)**-ын Choi-гийн 2 мөрийг хийж
эхлэхэд гарсан хоёр цоорхой. Хоёулаа **байгаа өгөгдлийг харуулах** асуудал —
шинэ логик биш.

---

## 1. `GET /reviews/saved` (ба `/reviews/learn`) үгийн SRS төлвийг буцаадаггүй

**Одоогийн байдал.** `GET /reviews/stats` нь `{ known, learning }` гэсэн
**нийлбэр** тоог зөв буцаадаг — үүнийг ашиглаж `mobile/src/components/VocabStats.tsx`
дээр "Миний үгсийн сан" карт (нийт тоо + эзэмшилтийн хувь) хийлээ.

Гэвч `LearnWord` (жагсаалтын нэг мөр) нь SM-2 төлөвгүй:

```ts
// mobile/src/api/reviews.ts — LearnWord
id, english, mongolian, englishDefinition, phonetic, category,
partOfSpeech, exampleSentence, exampleTranslation, audioUrl, imageUrl,
level, saved
```

Тиймээс **үг тус бүрийн хажууд "шинэ / сурч байгаа / эзэмшсэн" гэсэн заалт
харуулах боломжгүй.** Одоогийн хувилбар зөвхөн нийлбэрийг үзүүлж байна.

**Хүсэлт.** `WordReview`-оос дараах 2–3 талбарыг `LearnWord`-д нэмэх
(`/reviews/saved` + `/reviews/learn` хоёуланд):

```ts
/** SM-2 давталтын тоо — 0 = шинэ. */
repetitions: number;
/** Дараагийн давталт хэзээ болох (ISO). null = хараахан эхлээгүй. */
dueAt: string | null;
/** Сүүлийн interval хоногоор — mastery-г шууд эндээс тооцно. */
intervalDays: number;
```

Mobile тал `intervalDays >= 21` (эсвэл та тохирох босго сонгоно уу) →
"эзэмшсэн", `repetitions === 0` → "шинэ", бусад нь "сурч байгаа" гэж
харуулна. Босгыг **BE-ээс** ирүүлбэл бүр сайн (апп шинэчлэлгүй тааруулах —
CLAUDE.md-ийн дүрэм).

---

## 2. Унших материалын ахиц хадгалагддаггүй (зөвхөн "дуусгасан эсэх")

**Одоогийн байдал.** `POST /reading/:id/complete` нь **дуусгасан/дуусгаагүй**
гэсэн 2 л төлөв мэддэг. Сурагч материалын дунд гарвал буцаж ороход **эхнээсээ**
эхэлнэ. Ахиц одоогоор зөвхөн утсан дээр (`mobile/src/lib/readingProgress.ts`)
хадгалагддаг тул **өөр төхөөрөмж дээр орвол алга болно**.

**Хүсэлт.** Ахицыг хадгалах жижиг endpoint:

```
PUT  /reading/:id/progress   { sentenceIndex: number }   → 204
GET  /reading/progress                                    → [{ passageId, sentenceIndex, completedAt }]
```

`sentenceIndex` = хамгийн сүүлд уншсан өгүүлбэрийн дугаар (`sentences[]`-ийн
индекс). Ингэснээр "Үргэлжлүүлэх" товч + номын сангийн "Уншиж байгаа" тавиур
хийх боломжтой болно (Update 3-ын "Ахиц хадгалах, номын сан" мөр).

Хэрэв тусдаа хүснэгт нэмэхийг хүсэхгүй бол `reading_passages`-д биш,
`user_id + passage_id` түлхүүртэй жижиг `reading_progress` хүснэгт байхад
хангалттай.

---

## Mobile талд аль хэдийн хийчихсэн зүйл (BE хүлээхгүйгээр)

- **Аудио дагаж унших** ✅ — `sentences[].audioUrl` аль хэдийн байсан тул
  `mobile/src/lib/useReadAlong.ts` + reader дээрх тоглуулагч хийгдсэн.
  **BE-ээс юу ч хэрэггүй.**
- **Үгсийн сангийн нийлбэр статистик** ✅ — `GET /reviews/stats`-аар.
- Дээрх 2 хүсэлт ирвэл: үг бүрийн mastery заалт + "Үргэлжлүүлэн унших" нэмнэ.
