# SparkXP — Backend API Reference

Backend (NestJS) endpoint-үүдийн бүрэн лавлах. **Зам/метод англиар**, тайлбар монголоор.
Шинэчилсэн: 2026-07-01. Эх сурвалж: `backend/src/**/*.controller.ts` (20 controller).

> Mobile dev-үүд (Choi/Boju) `/backend`-ийг шууд заслахгүй — шинэ endpoint хэрэгтэй бол
> Өсөхбаяр-аас хүсэн авч, энэ файлыг шинэчилнэ. Дэлгэрэнгүй дүрэм: `CLAUDE.md`.

---

## Ерөнхий

- **Global prefix:** бүх зам `/api`-аар эхэлнэ (`main.ts`). Жишээ: `POST /api/auth/login`.
- **Prod base URL:** `https://sparkxp-production.up.railway.app/api` (Railway).
- **Auth header:** `Authorization: Bearer <JWT>`. Token нь `/auth/login` эсвэл `/auth/verify-otp`-оос ирнэ.
- **Auth баганын утга:**
  - **Public** — guard байхгүй (нэвтрэлгүй хандана).
  - **JWT** — `JwtAuthGuard`, зөвхөн нэвтэрсэн хэрэглэгч.
  - **Роль** — `JwtAuthGuard` + `@Roles(...)`. Роль: `student` / `teacher` / `admin` / `super_admin` / `moderator`.
  - Тэмдэглэл: "admin-баг" = `admin, super_admin, moderator`. Student-д зориулсан тусгай `@Roles` байхгүй — student-ийн endpoint зүгээр JWT шаардана.
- **Статик:** `/uploads/*` нь файл дамжуулалт (API биш).

### Base URL / token тохиргоо (frontend)

| Frontend | Env var | Fallback | Token хадгалалт |
| --- | --- | --- | --- |
| **Mobile** (Expo) | `EXPO_PUBLIC_API_URL` | `http://<expo-host>:3000/api` → `http://localhost:3000/api` | fn-д дамжина → `apiRequest`/`apiUpload` `Bearer` тавина (`mobile/src/api/client.ts`) |
| **Admin** (Vite) | `VITE_API_URL` | `http://localhost:3000/api` | `localStorage['admin_token']`; `apiFetch` автоматаар залгана (`admin/src/api/client.ts`) |

---

## 1. Auth — `/api/auth`

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/auth/register` | Public | Баталгаажаагүй бүртгэл үүсгэж, имэйлээр OTP илгээх (token өгөхгүй) | `RegisterDto` |
| POST `/auth/verify-otp` | Public | OTP-оор имэйл баталгаажуулж → token буцаана (нэвтэрнэ) | `{ email, code }` |
| POST `/auth/resend-otp` | Public | Баталгаажуулах OTP дахин илгээх | `{ email }` |
| POST `/auth/login` | Public | username/email + нууц үгээр нэвтрэх → token | `LoginDto` |
| POST `/auth/forgot-password` | Public | Нууц үг сэргээх код имэйлдэх | `{ email }` |
| POST `/auth/reset-password` | Public | Кодоор шинэ нууц үг тавих | `{ email, code, password }` |
| GET `/auth/me` | JWT | Одоогийн хэрэглэгчийн мэдээлэл | — |

## 2. Users — `/api/users`
Controller-level: бүгд JWT. Заримд нэмэлт роль.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| PATCH `/users/me` | JWT | Өөрийн профайл засах | `UpdateProfileDto` |
| GET `/users/me/stats` | JWT | Өөрийн XP + Sparks | — |
| GET `/users/me/plan` | JWT | Өөрийн багц + хэрэглээ | — |
| POST `/users/me/avatar` | JWT | Аватар зураг байршуулах (jpg/png/webp ≤5MB) | multipart `file` |
| GET `/users` | admin, super_admin | Бүх хэрэглэгч (хуудаслалттай) | `page`, `limit`, `search` |
| PATCH `/users/:id` | super_admin | Хэрэглэгчийн роль солих (өөрийгөө болихгүй) | `{ role }` |
| DELETE `/users/:id` | admin, super_admin | Хэрэглэгч устгах | path `id` |

## 3. Words — `/api/words`
Толь бичгийн үгс + AI үүсгэлт + bulk pipeline. GET уншилт public/JWT; бичилт admin-баг.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/words` | **Public** | Үг хайх/жагсаах | `QueryWordsDto` |
| GET `/words/:id` | **Public** | Нэг үг | path `id` |
| GET `/words/stats` | admin-баг | Контентын эрүүл мэндийн тоо | — |
| GET `/words/analytics` | admin-баг | Сурлагын аналитик (мартсан/хадгалсан/мэдэх/хэцүү) | — |
| GET `/words/quiz` | JWT | Нийтэлсэн үгсээс MCQ vocab quiz үүсгэх | `{ count }` |
| POST `/words/quiz/submit` | JWT | Quiz шалгаж, XP + Sparks олгох | `{ answers }` |
| POST `/words` | admin-баг | Үг үүсгэх | `CreateWordDto` |
| POST `/words/bulk` | admin-баг | JSON массиваас олноор → `{inserted, skipped}` | `CreateWordDto[]` |
| POST `/words/ai-fill` | admin-баг | Нэг үгийн бүх талбарыг AI-аар бөглөх | `{ english }` |
| POST `/words/ai-bulk` | admin-баг | Background AI bulk (Gemini + optional медиа) → `{jobId}` | `{ words[], generateImages?, generateAudios? }` |
| GET `/words/ai-bulk/:jobId` | admin-баг | AI-bulk / media job явц харах | path `jobId` |
| POST `/words/ai-bulk/:jobId/cancel` | admin-баг | Ажиллаж буй job зогсоох | path `jobId` |
| POST `/words/bulk-generate-media` | admin-баг | Одоо байгаа үгсэд зураг/аудио (background) → `{jobId}` | `{ wordIds[], image?, audio? }` |
| POST `/words/image-batch` | admin-баг | OpenAI Batch зураг → `{batchId}` | `{ wordIds[] }` |
| POST `/words/image-batch/enqueue` | admin-баг | Cron image batch-д дараалалд оруулах | `{ wordIds[] }` |
| GET `/words/image-batch-queue` | admin-баг | Серверийн image-batch дарааллын явц | — |
| POST `/words/image-batch-queue/stop` | admin-баг | Дараалал зогсоох + OpenAI batch цуцлах | — |
| GET `/words/image-batch/:batchId` | admin-баг | Batch зургийн job харах | path `batchId` |
| POST `/words/image-batch/:batchId/ingest` | admin-баг | Дууссан batch-ийн зургийг хадгалах | path `batchId` |
| POST `/words/import` | admin-баг | CSV импорт (шинэ → needs_review) | multipart `file` (.csv) |
| PATCH `/words/bulk` | admin-баг | Олноор засах (нийтлэх/зөвшөөрөх/ангилах) | `{ ids, changes }` |
| POST `/words/dedupe` | admin-баг | Давхардсан үг устгах | — |
| POST `/words/:id/generate-image` | admin-баг | Нэг үгэнд зураг үүсгэх | path `id` |
| POST `/words/:id/generate-audio` | admin-баг | Нэг үгэнд дуудлагын аудио үүсгэх | path `id` |
| PATCH `/words/:id` | admin-баг | Үг засах | `UpdateWordDto` |
| DELETE `/words/:id` | admin-баг | Үг устгах | path `id` |

## 4. Lessons — `/api/lessons`
GET уншилт public. (Sparks endpoint-ууд мөн энэ base дээр — §5.)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/lessons` | **Public** | Хичээлийн жагсаалт | `QueryLessonsDto` (isPublished, level, type) |
| GET `/lessons/:id` | **Public** | Нэг хичээл | path `id` |
| POST `/lessons` | admin-баг | Хичээл үүсгэх | `CreateLessonDto` |
| PATCH `/lessons/:id` | admin-баг | Хичээл засах | `UpdateLessonDto` |
| DELETE `/lessons/:id` | admin-баг | Хичээл устгах | path `id` |
| POST `/lessons/:id/complete` | JWT | Хичээл дуусгаж XP олгох (нэг удаа, idempotent) | path `id` |

## 5. Sparks — `/api/lessons` (SparksController)
Controller-level: JWT.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/lessons/:id/unlock` | JWT | Төлбөртэй хичээлийг Sparks-аар нээх | path `id` |
| GET `/lessons/:id/access` | JWT | Хандах эрхтэй эсэх → `{hasAccess}` | path `id` |

## 6. Quizzes — `/api/quizzes`
Controller-level: JWT. Бичилт admin-баг. (Хичээлийн тест ба бие даасан Дасгал хоёулаа.)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/quizzes` | JWT | Quiz жагсаах (шүүлттэй) | `QueryQuizzesDto` (lessonId, category, topic, standalone, isPublished) |
| GET `/quizzes/:id` | JWT | Нэг quiz (зөв хариу нуугдана) | path `id` |
| POST `/quizzes` | admin-баг | Quiz үүсгэх | `CreateQuizDto` |
| PATCH `/quizzes/:id` | admin-баг | Quiz засах | `UpdateQuizDto` |
| DELETE `/quizzes/:id` | admin-баг | Quiz устгах | path `id` |
| POST `/quizzes/:id/submit` | JWT | Хариу шалгаж XP олгох (≥1 зөв бол) | `SubmitQuizDto` |

## 7. Reading — `/api/reading`
Унших материал. GET уншилт JWT; бичилт/AI admin-баг.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/reading` | JWT | Материал жагсаах (student зөвхөн нийтэлсэн; `all=true` бол бүгд) | `QueryReadingDto` (cefr, category, all) |
| GET `/reading/:id` | JWT | Нэг материал | path `id` |
| POST `/reading` | admin-баг | Материал үүсгэх | `CreateReadingDto` |
| PATCH `/reading/:id` | admin-баг | Материал засах | `UpdateReadingDto` |
| DELETE `/reading/:id` | admin-баг | Материал устгах | path `id` |
| POST `/reading/guess-choices` | admin-баг | Гол үгсэд "утга таах" сонголт AI-аар | `{ words[], cefr? }` |
| POST `/reading/generate` | admin-баг | Текстээс гол үг + comprehension асуулт AI-аар (Gemini) | `{ text, cefr? }` |
| POST `/reading/:id/complete` | JWT | Унших дуусгаж XP олгох (нэг удаа) | path `id` |
| POST `/reading/:id/generate-audio` | admin-баг | Бүх өгүүлбэрт аудио (background) → `{jobId}` | path `id` |
| GET `/reading/audio-job/:jobId` | admin-баг | Аудио job-ийн явц | path `jobId` |
| POST `/reading/:id/sentences/:index/generate-audio` | admin-баг | Нэг өгүүлбэрийн аудио дахин үүсгэх | path `id`, `index` |

## 8. Idioms — `/api/idioms`
Хэлц үг. GET уншилт JWT; бичилт/AI admin-баг.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/idioms` | JWT | Хэлц жагсаах (student зөвхөн нийтэлсэн) | `QueryIdiomDto` (search, all, noImage) |
| GET `/idioms/:id` | JWT | Нэг хэлц | path `id` |
| POST `/idioms` | admin-баг | Хэлц үүсгэх | `CreateIdiomDto` |
| PATCH `/idioms/:id` | admin-баг | Хэлц засах | `UpdateIdiomDto` |
| DELETE `/idioms/:id` | admin-баг | Хэлц устгах | path `id` |
| POST `/idioms/ai-fill` | admin-баг | Хэллэгээс талбарууд AI-аар | `{ phrase }` |
| POST `/idioms/ai-bulk` | admin-баг | AI bulk импорт (background) → `{jobId}` | `{ phrases[], generateImages?, generateAudios? }` |
| GET `/idioms/ai-bulk/:jobId` | admin-баг | AI-bulk job явц | path `jobId` |
| POST `/idioms/ai-bulk/:jobId/cancel` | admin-баг | AI-bulk job цуцлах | path `jobId` |
| POST `/idioms/import` | admin-баг | CSV импорт (phrase, mongolian) | multipart `file` |
| PATCH `/idioms/bulk` | admin-баг | Сонгосон хэлцүүд олноор (нийтлэх) | `{ ids[], isPublished? }` |
| POST `/idioms/bulk-generate-images` | admin-баг | Сонгосонд OpenAI зураг (background) → `{jobId}` | `{ ids[] }` |
| GET `/idioms/image-job/:jobId` | admin-баг | Bulk зургийн job | path `jobId` |
| POST `/idioms/:id/generate-audio` | admin-баг | Дуудлагын аудио (ElevenLabs) | path `id` |
| POST `/idioms/:id/generate-image` | admin-баг | Жишээ зураг (OpenAI) | path `id` |

## 9. Leaderboard — `/api/leaderboard`
Controller-level: JWT.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/leaderboard` | JWT | XP-ээр эрэмбэ (period+scope) + өөрийн байр | `QueryLeaderboardDto` (period, scope, classId) |
| GET `/leaderboard/top` | admin-баг | Admin top-N (admin-ий байршлыг үл тооцно) | `scope`, `period`, `value?`, `limit` |

## 10. AI / Chat — `/api/ai`
Controller-level: JWT.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/ai/chat` | JWT | AI найзруу мессеж илгээх | `{ message, conversationId? }` |
| GET `/ai/conversations/:conversationId` | JWT | Яриа түүх | path `conversationId` |
| GET `/ai/buddies` | JWT | Идэвхтэй AI buddy жагсаалт (auto-seed) | — |
| POST `/ai/buddies` | admin, super_admin | Шинэ AI buddy үүсгэх | `CreateBuddyDto` |
| PATCH `/ai/buddies/:slug` | admin, super_admin | Buddy засах | path `slug` |
| DELETE `/ai/buddies/:slug` | admin, super_admin | Buddy устгах | path `slug` |
| GET `/ai/buddy-stats` | admin-баг | Buddy тус бүрийн хэрэглээ (мессеж/token/зардал) | — |
| GET `/ai/limits` | admin, super_admin | Runtime AI limit-ийг унших (Settings хуудас) | — |
| PATCH `/ai/limits` | admin, super_admin | Багцын limit-ийг runtime-д өөрчлөх | `UpdateLimitsDto` |

### 10a. AI Buddy (Voice) — `/api/ai/buddy`
Controller-level: JWT. Realtime speaking companion (STT→LLM→TTS→avatar). Бүх
дуут яриа AI Gateway-ээр дамжина; сарын voice/STT limit-ийг `plans`-аас enforce
хийнэ; TTS-г `buddy_voice_cache`-аар кэшлэнэ.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/ai/buddy/sessions` | JWT | Session эхлүүлэх | `{ buddySlug, mode?, topic? }` → `{ sessionId, buddy, usage }` |
| POST `/ai/buddy/sessions/:id/turn/audio` | JWT | Дуут turn (multipart `file`, ≤2MB) | full pipeline → turn response |
| POST `/ai/buddy/sessions/:id/turn/text` | JWT | Бичсэн turn (STT алгасна) | `{ text }` → turn response |
| GET `/ai/buddy/sessions/:id/messages` | JWT | Яриа түүх | path `id` |
| GET `/ai/buddy/usage` | JWT | Энэ сарын voice/STT хэрэглээ | — |
| GET `/ai/buddy/memory` | JWT | Buddy-гийн санах ой | — |
| DELETE `/ai/buddy/memory` | JWT | Санах ой цэвэрлэх | — |

Turn response: `{ session_id, message_id, user_transcript, reply_text,
correction, follow_up_question, audio_url, avatar_instruction{emotion,gesture,
duration_ms}, usage{voice_seconds_used_this_month, voice_seconds_limit_this_month,
warn_level} }`. Voice limit хэтэрвэл `403 { code: 'VOICE_LIMIT' }` (mobile текст
рүү шилжинэ).

## 11. Dictionary — `/api/dictionary`
Controller-level: JWT. (Reading-ийн tap-to-translate ашигладаг.)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/dictionary/:word` | JWT | Богино монгол утга (DB → cache → Gemini) | path `word` |
| GET `/dictionary/:word/audio` | JWT | Дуудлагын аудио URL (ElevenLabs, cached) | path `word` |
| POST `/dictionary/:word/save` | JWT | Үг + орчуулгыг хадгалсан үгэнд нэмэх | path `word` |

## 12. Reviews (SRS) — `/api/reviews`
Controller-level: JWT. Бүгд student-ийн өөрийн давталтын хуваарь.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/reviews/due` | JWT | Одоо давтах ёстой үгс | — |
| GET `/reviews/learn` | JWT | Сурах үгсийн багц (swipe) | — |
| GET `/reviews/saved` | JWT | Хадгалсан (⭐) үгс | — |
| GET `/reviews/stats` | JWT | Үгсийн статус `{known, learning}` | — |
| POST `/reviews/:wordId` | JWT | Санах оролдлого илгээж давталт дахин товлох (SM-2) | `{ quality }` |
| POST `/reviews/:wordId/save` | JWT | ⭐ хадгалах флаг toggle | path `wordId` |

## 13. Gamification — `/api/gamification` (XpController)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/gamification` | JWT | Streak, level, өнөөдрийн XP, зорилго | — |

## 14. Classes (багш) — `/api/classes`
Controller-level: JWT. Зарим бичилт роль шаардана; заримд эзэмшлийг service шалгана.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/classes` | teacher, admin, super_admin | Анги үүсгэх | `CreateClassDto` |
| GET `/classes` | JWT | Өөрийн ангиуд (заадаг + элссэн) | — |
| GET `/classes/all` | admin-баг | Бүх анги (багш + тоо) | — |
| GET `/classes/:id` | JWT (service шалгана) | Нэг анги + бүрэлдэхүүн | path `id` |
| GET `/classes/:id/students` | JWT (багш/admin) | Ангийн сурагчид | path `id` |
| POST `/classes/join` | JWT | Сурагч кодоор элсэх хүсэлт (баталгаа шаардна) | `{ joinCode }` |
| GET `/classes/:id/requests` | JWT (багш/admin) | Хүлээгдэж буй элсэх хүсэлтүүд | path `id` |
| POST `/classes/:id/requests/:studentId/approve` | JWT (багш/admin) | Хүсэлт батлаж элсүүлэх | path `id`, `studentId` |
| DELETE `/classes/:id/requests/:studentId` | JWT (багш/admin) | Хүсэлт татгалзах | path `id`, `studentId` |

## 15. Organizations — `/api/organizations`
Controller-level: JWT. Бичилт admin-only.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/organizations` | JWT | Байгууллага жагсаах | `QueryOrganizationsDto` |
| GET `/organizations/:id` | JWT | Нэг байгууллага | path `id` |
| POST `/organizations` | admin, super_admin | Байгууллага үүсгэх | `CreateOrganizationDto` |
| PATCH `/organizations/:id` | admin, super_admin | Засах | `UpdateOrganizationDto` |
| DELETE `/organizations/:id` | admin, super_admin | Устгах | path `id` |

## 16. Assignments — `/api/assignments`
Controller-level: JWT.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/assignments` | teacher, admin, super_admin | Хичээл/quiz-ийг ангид оноох | `CreateAssignmentDto` |
| GET `/assignments/mine` | JWT | Элссэн ангиудын даалгаврууд | — |
| GET `/assignments` | JWT (гишүүнчлэл шалгана) | Ангийн даалгаврууд | `classId` (required) |
| POST `/assignments/:id/complete` | JWT | Сурагч даалгавар дуусгах (idempotent) | path `id` |
| DELETE `/assignments/:id` | teacher, admin, super_admin | Даалгавар устгах | path `id` |

## 17. Payments — `/api/payments`
Guard per-method. (QPay QR stub — §PRODUCT: Update 1.)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/payments/plans` | **Public** | Идэвхтэй багцын жагсаалт | — |
| POST `/payments/plans` | admin, super_admin | Багц үүсгэх (давхардвал 409) | `CreatePlanDto` |
| POST `/payments` | JWT | Төлбөрийн intent үүсгэх (QPay QR stub) | `CreatePaymentDto` |
| POST `/payments/:id/confirm` | JWT | QPay callback дараа баталгаажуулах | `ConfirmPaymentDto` |
| GET `/payments/my` | JWT | Өөрийн төлбөрийн түүх | — |
| GET `/payments` | admin, super_admin | Бүх төлбөр (хэрэглэгчтэй) | — |

## 18. Upload — `/api/upload`
Controller-level: admin-баг.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/upload` | admin-баг | Зураг/аудио/видео → нийтийн URL (Cloudinary/local). Зураг ≤10MB, видео/аудио ≤200MB | multipart `file` |

## 19. Notifications — `/api/notifications`
Controller-level: admin, super_admin.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/notifications/broadcast` | admin, super_admin | Мэдэгдэл цацах | `BroadcastNotificationDto` |
| GET `/notifications` | admin, super_admin | Бүх мэдэгдэл | — |

## 20. Health — `/api/health`

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/health` | **Public** | Амьд эсэх: DB (SELECT 1) + Redis ping → `{status, db, redis, timestamp}` | — |

---

## Frontend → Backend зураглал

### Mobile (`mobile/src/api/*.ts`)
Функц бүр `token`-ыг аргумент болгож авдаг.

| Файл | Функц → Endpoint |
| --- | --- |
| `auth.ts` | `register`→POST `/auth/register` · `verifyOtp`→POST `/auth/verify-otp` · `resendOtp`→POST `/auth/resend-otp` · `login`→POST `/auth/login` · `forgotPassword`→POST `/auth/forgot-password` · `resetPassword`→POST `/auth/reset-password` · `getMe`→GET `/auth/me` |
| `users.ts` | `getStats`→GET `/users/me/stats` · `getMyPlan`→GET `/users/me/plan` · `updateProfile`→PATCH `/users/me` · `uploadAvatar`→POST `/users/me/avatar` |
| `gamification.ts` | `getGamification`→GET `/gamification` |
| `lessons.ts` | `getLessons`→GET `/lessons?isPublished=true` · `getLesson`→GET `/lessons/:id` · `checkAccess`→GET `/lessons/:id/access` · `unlockLesson`→POST `/lessons/:id/unlock` · `completeLesson`→POST `/lessons/:id/complete` |
| `quizzes.ts` | `getQuiz`→GET `/quizzes/:id` · `getQuizzes`→GET `/quizzes?isPublished=true[&lessonId=]` · `getExercises`→GET `/quizzes?standalone=true&isPublished=true&category=` · `submitQuiz`→POST `/quizzes/:id/submit` |
| `quiz.ts` (vocab) | `getQuiz`→GET `/words/quiz?count=` · `submitQuiz`→POST `/words/quiz/submit` |
| `reading.ts` | `getReadingList`→GET `/reading?limit=50` · `getReadingPassage`→GET `/reading/:id` · `completeReading`→POST `/reading/:id/complete` |
| `reviews.ts` | `getDue`→GET `/reviews/due` · `submitReview`→POST `/reviews/:wordId` · `getLearnQueue`→GET `/reviews/learn` · `toggleSave`→POST `/reviews/:wordId/save` · `getSaved`→GET `/reviews/saved` · `getReviewStats`→GET `/reviews/stats` |
| `words.ts` | `getWords`→GET `/words` |
| `dictionary.ts` | `lookupWord`→GET `/dictionary/:word` · `getWordAudio`→GET `/dictionary/:word/audio` · `saveWord`→POST `/dictionary/:word/save` |
| `idioms.ts` | `getIdiomList`→GET `/idioms?limit=100` · `getIdiom`→GET `/idioms/:id` |
| `leaderboard.ts` | `getLeaderboard`→GET `/leaderboard?period=&scope=` |
| `ai.ts` | `sendMessage`→POST `/ai/chat` · `getHistory`→GET `/ai/conversations/:id` · (AI Buddy voice) `getBuddies`→GET `/ai/buddies` · `startSession`→POST `/ai/buddy/sessions` · `sendBuddyTextTurn`→POST `/ai/buddy/sessions/:id/turn/text` · `sendBuddyAudioTurn`→POST `/ai/buddy/sessions/:id/turn/audio` · `getBuddyUsage`→GET `/ai/buddy/usage` · memory GET/DELETE `/ai/buddy/memory` (Boju хийнэ) |
| `classes.ts` | `getMyClasses`→GET `/classes` · `createClass`→POST `/classes` · `getClass`→GET `/classes/:id` · `getClassStudents`→GET `/classes/:id/students` · `requestJoinClass`→POST `/classes/join` · `getJoinRequests`→GET `/classes/:id/requests` · `approveRequest`→POST `/classes/:id/requests/:studentId/approve` · `rejectRequest`→DELETE `/classes/:id/requests/:studentId` |
| `assignments.ts` | `createAssignment`→POST `/assignments` · `getClassAssignments`→GET `/assignments?classId=` · `getMyAssignments`→GET `/assignments/mine` · `deleteAssignment`→DELETE `/assignments/:id` |
| `organizations.ts` | `getOrganizations`→GET `/organizations?limit=100` |

### Admin (`admin/src/pages/**`)
Token автоматаар залгагдана. Зураг байршуулалт: `components/*` → POST `/upload`.

| Хуудас | Endpoint-ууд |
| --- | --- |
| Login / AuthContext | POST `/auth/login` · GET `/auth/me` |
| Users | GET `/users` · PATCH `/users/:id` · DELETE `/users/:id` |
| Usage | GET `/users` |
| Lessons | GET/POST/PATCH/DELETE `/lessons` |
| Lesson Tests | GET `/quizzes?lessonId=&category=` · POST/PATCH/DELETE `/quizzes` |
| Quizzes | GET `/quizzes` · POST/PATCH/DELETE `/quizzes` |
| Exercises (бие даасан) | GET `/quizzes?standalone=true&category=` · POST/PATCH/DELETE `/quizzes` |
| Reading | GET `/reading?all=true` · GET `/reading/:id` · POST/PATCH/DELETE `/reading` · POST `/reading/:id/generate-audio` · GET `/reading/audio-job/:jobId` · POST `/reading/:id/sentences/:i/generate-audio` · POST `/reading/generate` · POST `/reading/guess-choices` |
| Words | GET `/words` · GET `/words/stats` · GET `/words/analytics` · GET `/words/image-batch-queue` · POST/PATCH/DELETE `/words` · PATCH `/words/bulk` · POST `/words/:id/generate-image\|generate-audio` · POST `/words/bulk-generate-media` · POST `/words/ai-bulk` (+poll/cancel) · POST `/words/import` |
| Idioms | GET `/idioms?all=true` · POST/PATCH/DELETE `/idioms` · PATCH `/idioms/bulk` · POST `/idioms/:id/generate-audio` · POST `/idioms/bulk-generate-images` (+`/image-job/:jobId`) · POST `/idioms/ai-bulk` (+poll/cancel) · POST `/idioms/import` |
| Classes | GET `/classes/all` · GET `/classes/:id/students` · GET `/lessons?limit=200` · GET `/quizzes?limit=200` · GET `/assignments?classId=` · POST `/classes` · POST `/assignments` · DELETE `/assignments/:id` |
| Organizations | GET/POST/PATCH/DELETE `/organizations` |
| Leaderboard | GET `/leaderboard/top` |
| AI Buddy | GET `/ai/buddies` · GET `/ai/buddy-stats` · POST/PATCH/DELETE `/ai/buddies` |
| Settings | GET/PATCH `/ai/limits` |
| Monitor | GET `/payments/plans` · GET `/payments` · POST `/payments/plans` |
| Notifications | GET `/notifications` |

---

## Cross-frontend тэмдэглэл

- **Дундын нөөц** (mobile = унших/submit, admin = CRUD/authoring): `/lessons`, `/quizzes`, `/reading`, `/idioms`, `/words`, `/organizations`, `/classes`, `/assignments`, `/ai/*`. Mobile `?isPublished=true`/`standalone=true` уншина; admin `?all=true` + PATCH-аар `isPublished` toggle.
- **Зөвхөн mobile:** `/auth/*`, `/users/me*`, `/gamification`, `/reviews/*`, `/dictionary/*`, `/words/quiz*`, `/leaderboard` (query), `/lessons/:id/access|unlock|complete`, `/reading/:id/complete`, `/quizzes/:id/submit`, `/classes/join`, `/assignments/mine`.
- **Зөвхөн admin:** `/upload`, `/users/:id` (засах/устгах), `/payments*`, `/notifications`, `/ai/limits`, `/ai/buddies` + `/ai/buddy-stats`, `/leaderboard/top`, бүх `*/generate-*`, `*/ai-bulk*`, `*/bulk*`, `*/import`, `*-job`/`*-queue` poll, `/classes/all`, `/words/stats|analytics`.
- **Нэрийн зөрүү (анхаар):**
  - Leaderboard: mobile `GET /leaderboard?period=&scope=` ↔ admin `GET /leaderboard/top`.
  - AI: mobile `/ai/chat` + `/ai/conversations/:id` (эцсийн хэрэглэгч) ↔ admin `/ai/buddies`, `/ai/buddy-stats`, `/ai/limits` (тохиргоо).
  - Mobile-д **2 quiz модуль**: `quizzes.ts`→`/quizzes` (зохиосон quiz) ба `quiz.ts`→`/words/quiz` (vocab үүсгэсэн quiz).
  - `/api/lessons` дээр **2 controller** (Lessons + Sparks); `xp` controller-ийн route base = `gamification`.

---

## Public (guard-гүй) endpoint-ууд — аюулгүй байдлын шалгах цэг
`POST /auth/register|verify-otp|resend-otp|login|forgot-password|reset-password` ·
`GET /words` · `GET /words/:id` · `GET /lessons` · `GET /lessons/:id` ·
`GET /payments/plans` · `GET /health`.
Бусад бүх endpoint JWT (эсвэл роль) шаардана.
