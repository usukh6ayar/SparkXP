# EnglishXP (SparkXP) — Backend API

> Бүх endpoint-ийн лавлах. Хоёр dev (тус тусын Claude)-д зориулсан.
> Бааз хаяг: `http://localhost:3000/api` (`main.ts` → global prefix `api`).
> Роль/эрх: `ROLES.md` · Дүрэм: `CLAUDE.md`.

**Auth тэмдэглэгээ:** 🔓 нээлттэй · 🔑 нэвтэрсэн (JWT Bearer) · 🛡️ admin/super_admin
(`@Roles`) · 👩‍🏫 teacher/admin (Phase 2).

Бүх хамгаалагдсан хүсэлтэд header: `Authorization: Bearer <accessToken>`.

---

## 🔐 Auth — `/api/auth`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/auth/register` | 🔓 | Бүртгүүлэх. Body: `{ username, email, password, fullName, province?, district? }` → `{ pendingVerification, email }` (токен ӨГӨХГҮЙ — OTP баталгаажуулна) |
| POST | `/auth/verify-otp` | 🔓 | Body: `{ email, code }` → `{ accessToken, user }` (имэйл баталгаажуулж нэвтэрнэ) |
| POST | `/auth/resend-otp` | 🔓 | Body: `{ email }` → код дахин илгээх |
| POST | `/auth/login` | 🔓 | Нэвтрэх. Body: `{ identifier, password }` (**identifier = username ЭСВЭЛ email**) → `{ accessToken, user }` |
| POST | `/auth/forgot-password` | 🔓 | Body: `{ email }` → сэргээх код имэйлдэнэ |
| POST | `/auth/reset-password` | 🔓 | Body: `{ email, code, password }` → нууц үг солих |
| GET | `/auth/me` | 🔑 | Одоогийн хэрэглэгч |

> ⚠️ **Auth өөрчлөлт (2026-06):** бүртгэлд **username (заавал, давтагдашгүй)** + имэйл; нэвтрэлт **username-ээр** (admin/хуучин дансууд email-ээр хэвээр — `identifier` хоёуланг хүлээнэ). Имэйл OTP-оор баталгаажна, нууц үг имэйлээр сэргээнэ. **Email илгээлт одоо stub** (dev: код backend лог + Redis-д; жинхэнэ SMTP/Resend-г `MailService`-д залгана). Coordinate w/ Bishrelt.

## 👤 Users — `/api/users`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| PATCH | `/users/me` | 🔑 | Өөрийн профайл засах `{ fullName?, province?, district?, avatarUrl? }` (`avatarUrl` = зургийн URL эсвэл `default:avN`) |
| POST | `/users/me/avatar` | 🔑 | Avatar зураг upload (multipart `file`, jpg/png/webp ≤5MB) → шинэчилсэн user |
| GET | `/users/me/stats` | 🔑 | `{ xp, sparks }` |
| GET | `/users` | 🛡️ | Хэрэглэгчийн жагсаалт (`?page&limit`) — passwordHash хасагдсан |
| DELETE | `/users/:id` | 🛡️ | Хэрэглэгч устгах |

## 📖 Words (Үг) — `/api/words`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/words` | 🔑 | Жагсаалт (`?status&level&category&search&lessonId&page&limit`). **Default `status=published`** (student-д зөвхөн published; admin тодорхой `status` дамжуулна) |
| GET | `/words/quiz` | 🔑 | Vocabulary quiz үүсгэх (`?count=4..30`) — published үгээс multiple-choice (зөв хариулт client рүү явахгүй) |
| POST | `/words/quiz/submit` | 🔑 | `{ answers:[{wordId,choice}] }` → server-side grade, зөв бүрд XP+Sparks. Буцаалт `{ total, correct, xpAwarded, sparksAwarded }` |
| GET | `/words/:id` | 🔑 | Нэг үг |
| POST | `/words/ai-fill` | 🛡️ | `{ english }` → AI бүх талбарыг үүсгэнэ: `mongolian, englishDefinition, phonetic, partOfSpeech, category, level, exampleSentence, exampleTranslation, sparkTip, imageUrl`. Зөвхөн англи үгээ бичээд формоо урьдчилан бөглөнө |
| POST | `/words` | 🛡️ | Үг үүсгэх (`slug` авто үүснэ). `generateImage:true` бол AI Gateway-ээр зураг үүсгээд `imageUrl` хадгална |
| POST | `/words/bulk` | 🛡️ | JSON массив bulk import (давхардлыг english-ээр алгасна, шинэ үг → `needs_review`) |
| GET | `/words/stats` | 🛡️ | Контент эрүүл мэнд: `{ total, byStatus, missingImage, missingAudio, missingMnExample, duplicates }` |
| GET | `/words/analytics` | 🛡️ | Сурлагын аналитик: `{ topForgotten, topSaved, topKnown, hardest, avgSaveRate }` (WordReview-ээс) |
| PATCH | `/words/bulk` | 🛡️ | Олон үг нэг дор засах `{ ids, changes:{ status?, category?, level? } }` → `{ updated }` |
| POST | `/words/ai-bulk` | 🛡️ | `{ words: string[], generateImages? }` → зөвхөн англи үгсээс AI бүх талбарыг бөглөж нэмнэ. Cap: 75 (зураггүй) / 25 (зурагтай). Буцаалт `{ requested, inserted, skipped, failed:[{word,message}] }` |
| POST | `/words/:id/generate-image` | 🛡️ | Тухайн үгэнд AI зураг шинээр үүсгэж `imageUrl` шинэчилнэ |
| PATCH | `/words/:id` | 🛡️ | Засах (`status` солих → publish/approve). `generateImage:true` бол зураг шинээр үүсгэнэ |
| DELETE | `/words/:id` | 🛡️ | Устгах |

> **Word талбарууд (vocabulary system, 2026-06-22):** `english, mongolian,
> englishDefinition, phonetic, sparkTip, category, partOfSpeech,
> exampleSentence, exampleTranslation, audioUrl, imageUrl, level, slug,
> status`. **`status`
> (`WordStatus`):** `draft·needs_review·approved·rejected·published` —
> default `published`. App-д зөвхөн `published` гарна. `category` = нээлттэй
> string (`VOCAB_CATEGORY_SUGGESTIONS`). Дэлгэрэнгүй: `VOCABULARY_SYSTEM.md`.

## 📚 Lessons (Хичээл) — `/api/lessons`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/lessons` | 🔑 | Жагсаалт (`?type&level&isPublished&page&limit`) |
| GET | `/lessons/:id` | 🔑 | Нэг хичээл |
| POST | `/lessons` | 🛡️ | Үүсгэх (`content` jsonb, `priceSparks`) |
| PATCH | `/lessons/:id` | 🛡️ | Засах / publish |
| DELETE | `/lessons/:id` | 🛡️ | Устгах |
| POST | `/lessons/:id/unlock` | 🔑 | **Spark-аар нээх** (sparks module) |
| GET | `/lessons/:id/access` | 🔑 | Нээгдсэн эсэх `{ hasAccess }` |

> **`type` утгууд (`LessonType`):** `vocabulary` · `grammar` · `listening` ·
> `reading` · `writing` · `fill`. (Mobile Home grid: Сонсгол=`listening`,
> Унших=`reading`, Нөхөх=`fill`, Бичих=`writing`.) `reading`/`writing`/`fill`
> нь 2026-06-09-д нэмэгдсэн (`fill` = нөхөх даалгавар).

## ❓ Quizzes (Сорил) — `/api/quizzes`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/quizzes` | 🔑 | Жагсаалт (`?lessonId&level...`) |
| GET | `/quizzes/:id` | 🔑 | Нэг сорил |
| POST | `/quizzes` | 🛡️ | Үүсгэх (`questions` jsonb) |
| PATCH | `/quizzes/:id` | 🛡️ | Засах |
| DELETE | `/quizzes/:id` | 🛡️ | Устгах |
| POST | `/quizzes/:id/submit` | 🔑 | Хариу илгээх → оноо + XP |

## 🔁 Reviews (Үг давтах, SRS) — `/api/reviews`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/reviews/due` | 🔑 | Өнөөдөр давтах үгс (word-той) |
| POST | `/reviews/:wordId` | 🔑 | Хариу `{ quality: 0-5 }` → SM-2 reschedule + recall progress (correct/wrong/recallStatus) |
| GET | `/reviews/learn` | 🔑 | Swipe deck — зөвхөн `published`, мэдээгүй үгс. Карт бүр `saved` flag-тай |
| GET | `/reviews/stats` | 🔑 | `{ known, learning }` — "мэдэх үг" тоо |
| GET | `/reviews/saved` | 🔑 | ⭐ Хадгалсан үгсийн жагсаалт |
| POST | `/reviews/:wordId/save` | 🔑 | ⭐ saved toggle → `{ wordId, saved }` |

## 🔥 Gamification — `/api/gamification`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/gamification` | 🔑 | `{ xp, level, levelXp, levelTarget, xpToNext, progress, currentStreak, longestStreak, todayXp, dailyGoal, cefrLevel }`. Streak XP олох бүрт ахина (UB цагаар өдөр); level нь XP-ээс тооцоологдоно |

## 🤖 AI Gateway — `/api/ai`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/ai/chat` | 🔑 | AI Найз `{ message, conversationId? }` → `{ reply, conversationId }` |
| GET | `/ai/conversations/:conversationId` | 🔑 | Харилцааны түүх |
| PATCH | `/ai/limits` | 🛡️ | Plan limit тохируулах (Redis, app update-гүй) |

## 📚 Dictionary — `/api/dictionary`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/dictionary/:word` | 🔑 | Англи үгийн монгол тайлбар → `{ word, explanation, cached }`. Words DB-ээс эхэлж (cached=true), байхгүй бол AI (plan `dictionaryAiLimit`-тэй). Mobile: AI chat-д үг дээр дарахад. |

## 🏆 Leaderboard — `/api/leaderboard`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/leaderboard` | 🔑 | `?period=weekly|monthly|all_time&scope=global|province|district|class|organization|teacher&classId?` → топ N + миний байр. **`teacher` scope (2026-06):** багш→өөрийн бүх ангийн сурагчид; сурагч→элссэн ангийнхаа багшийн сурагчид |

---

## 🏫 Phase 2 — Organizations / Classes / Assignments / Payments

### Organizations — `/api/organizations`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/organizations` | 🛡️ | Байгууллага үүсгэх |
| GET | `/organizations` | 🔑 | Жагсаалт (багш класс үүсгэхэд сургуулиа сонгоход ашиглана) |
| GET | `/organizations/:id` | 🔑 | Нэг |
| PATCH | `/organizations/:id` | 🛡️ | Засах |
| DELETE | `/organizations/:id` | 🛡️ | Устгах |

### Classes — `/api/classes`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/classes` | 👩‍🏫 | Класс үүсгэх (`join_code` гарна) |
| POST | `/classes/join` | 🔑 | Оюутан `{ joinCode }`-оор **элсэх хүсэлт** илгээх → `{ status:'pending', className }` (багш зөвшөөрнө) |
| GET | `/classes` | 🔑 | Класс жагсаалт |
| GET | `/classes/:id` | 🔑 | Нэг класс (зөвшөөрөгдсөн roster) |
| GET | `/classes/:id/students` | 👩‍🏫 | Класс доторх оюутнууд |
| GET | `/classes/:id/requests` | 👩‍🏫 | **Хүлээгдэж буй элсэх хүсэлтүүд** |
| POST | `/classes/:id/requests/:studentId/approve` | 👩‍🏫 | Хүсэлт **зөвшөөрөх** (roster-т нэмнэ) |
| DELETE | `/classes/:id/requests/:studentId` | 👩‍🏫 | Хүсэлт **татгалзах** |

> ⚠️ **Өөрчлөлт (2026-06-16):** `/classes/join` нь шууд элсүүлэхээ больж, **багшийн
> зөвшөөрөл шаардсан pending хүсэлт** үүсгэдэг болсон (хэн ч кодоор шууд орохоос
> сэргийлэв). Шинэ entity: `class_join_requests`. Coordinate w/ Bishrelt.

### Assignments — `/api/assignments`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/assignments` | 👩‍🏫 | Даалгавар оноох (lesson/quiz, due date) |
| GET | `/assignments/mine` | 🔑 | Миний даалгаврууд |
| GET | `/assignments` | 👩‍🏫 | (класс/багшийн) даалгаврууд |
| DELETE | `/assignments/:id` | 👩‍🏫 | Устгах |

### Payments — `/api/payments`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/payments` | 🔑 | Төлбөр үүсгэх (premium / Spark топ-ап) |
| POST | `/payments/:id/confirm` | 🔑 | Төлбөр баталгаажуулах |
| GET | `/payments/my` | 🔑 | Миний төлбөрүүд |
| GET | `/payments` | 🛡️ | Бүх төлбөр (admin) |

## ❤️ Health — `/api/health`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/health` | 🔓 | `{ status, db, redis, timestamp }` — monitoring |

---

## 📦 Стандарт хариу / алдаа

- **Алдаа (global filter):** `{ statusCode, error, message, path, timestamp }`.
  Validation алдаа `message` нь массив (монгол текст).
- **Pagination:** `{ items, total, page, limit }` (эсвэл `{ items, total }`).
- **Status codes:** 200/201 OK · 204 (DELETE) · 400 validation · 401 токенгүй ·
  403 эрх хүрэхгүй · 404 олдсонгүй · 409 давхцал (давхар имэйл).

## 🔑 Жишээ дуудлага

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@englishxp.mn","password":"Admin1234!"}'

# Хамгаалагдсан endpoint
curl http://localhost:3000/api/leaderboard?period=weekly \
  -H "Authorization: Bearer <accessToken>"
```

> Postman collection: `backend/docs/EnglishXP.postman_collection.json` (auth хэсэг).
> Шинэ endpoint нэмбэл энэ файлыг шинэчилнэ үү.
