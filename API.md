# SparkXP — Backend API Reference

Backend (NestJS) endpoint-үүдийн бүрэн лавлах. **Зам/метод англиар**, тайлбар монголоор.
Шинэчилсэн: 2026-07-28. Эх сурвалж: `backend/src/**/*.controller.ts` (25 controller).

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
| POST `/auth/register` | Public | Баталгаажаагүй бүртгэл үүсгэж, имэйлээр OTP илгээх (token өгөхгүй). Optional `referralCode` — verify хийхэд хэрэглэгдэнэ. Optional **`tasteCompleted`** (C4) — үнэн бол verify хийх үед **нэг удаагийн +10 XP** (onboarding) олгоно | `RegisterDto` |
| POST `/auth/verify-otp` | Public | OTP-оор имэйл баталгаажуулж → token буцаана (нэвтэрнэ) | `{ email, code }` |
| POST `/auth/resend-otp` | Public | Баталгаажуулах OTP дахин илгээх | `{ email }` |
| POST `/auth/login` | Public | username/email + нууц үгээр нэвтрэх → token. ⚠️ Имэйл баталгаажаагүй бол **403 + `code: 'EMAIL_NOT_VERIFIED'` + `email`** (401 БИШ — апп үүнийг таньж OTP дэлгэц рүү аваачдаг). Google/Apple-ээр үүссэн данс нууц үггүй тул энд хэзээ ч нэвтрэхгүй | `LoginDto` |
| GET `/auth/social/providers` | Public | Ямар provider тохируулагдсаныг мэдэх → `{ google, apple }`. Аппын товч үүгээр шийдэгдэнэ (апп шинэчлэхгүйгээр асаах боломжтой) | — |
| POST `/auth/social` | Public | Google/Apple **identity token**-оор нэвтрэх. Хариу нь 2 хэлбэрийн нэг: session (`{ needsUsername: false, accessToken, user }`) **эсвэл** шинэ хүн бол `{ needsUsername: true, ticket, email, suggestedUsername, fullName }` | `{ provider, idToken }` |
| POST `/auth/social/complete` | Public | Түр зогссон бүртгэлийг сонгосон username-ээр дуусгах → token | `{ ticket, username, fullName? }` |
| POST `/auth/forgot-password` | Public | Нууц үг сэргээх код имэйлдэх | `{ email }` |
| POST `/auth/reset-password` | Public | Кодоор шинэ нууц үг тавих | `{ email, code, password }` |
| GET `/auth/me` | JWT | Одоогийн хэрэглэгчийн мэдээлэл | — |

> ### 🔐 Google / Apple нэвтрэлт
>
> **Тохиргоо:** `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS` (таслалаар тусгаарласан
> client id-ууд). Хоосон бол тэр provider **унтраалттай** — `GET
> /auth/social/providers` `false` буцааж, апп товчийг нь огт харуулахгүй.
> Тиймээс асаахад **апп шинэчлэх шаардлагагүй**.
>
> **Аюулгүй байдал:** аппаас ирсэн токеныг `SocialTokenService` нь provider-ийн
> JWKS-ээр гарын үсгийг шалгаж, `iss`/`aud`/`exp`-ийг тулгана. `aud` нь заавал
> **бидний** client id байх ёстой — өөр аппд зориулсан токен энд ажиллахгүй.
> Зөвхөн `RS256`; `alg: none` татгалзана. (9 тест: `social-token.service.spec.ts`.)
>
> **Данс:** түлхүүр нь `(provider, sub)` — **имэйл БИШ**. `sub` өөрчлөгддөггүй,
> харин имэйл дахин олгогдож болно, Apple relay хаяг апп тутам өөр. Ижил
> **баталгаажсан** имэйлтэй данс байвал түүн рүү холбоно (давхар данс үүсгэхгүй).
>
> **Username:** шинэ хүн бол сервер данс үүсгэхээ түр зогсоож `ticket` (15 мин)
> буцаана. Username нь чансаанд ил харагддаг тул имэйлээс гаргаж авахгүй —
> хэрэглэгч өөрөө сонгоно (`/(auth)/choose-username`).
>
> **Нууц үг:** ийм данс `password_hash = NULL`. Тиймээс нууц үгээр нэвтрэхгүй,
> мөн **аккаунт устгахад нууц үг шаардахгүй** (App Store 5.1.1(v) — данс бүр
> өөрийгөө устгах чадвартай байх ёстой).
>
> ⚠️ **Native build шаардана** — Expo Go дээр SDK ажиллахгүй. iOS-д
> `usesAppleSignIn: true` (entitlement).

## 2. Users — `/api/users`
Controller-level: бүгд JWT. Заримд нэмэлт роль.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| PATCH `/users/me` | JWT | Өөрийн профайл засах (`username` солиход давхардвал **409**) | `UpdateProfileDto` |
| GET `/users/me/stats` | JWT | Өөрийн XP + Sparks | — |
| GET `/users/me/plan` | JWT | Өөрийн багц + хэрэглээ | — |
| POST `/users/me/avatar` | JWT | Аватар зураг байршуулах (jpg/png/webp ≤5MB) | multipart `file` |
| GET `/users` | admin, super_admin | Бүх хэрэглэгч (хуудаслалттай) | `page`, `limit`, `search` |
| PATCH `/users/:id` | super_admin | Хэрэглэгчийн роль солих (өөрийгөө болихгүй) | `{ role }` |
| DELETE `/users/:id` | admin, super_admin | Хэрэглэгч устгах | path `id` |

**`UpdateProfileDto` талбарууд:** `fullName` · **`username`** · `province` ·
`district` · `avatarUrl` · `level`. Бүгд optional — илгээсэн
талбарууд нь л шинэчлэгдэнэ (global `ValidationPipe({ whitelist: true })` тул
DTO-д байхгүй талбарыг чимээгүй арчина).

> ⚠️ **`englishName` устгагдсан (2026-07-31).** Register/update-profile DTO,
> auth хариунаас хассан. `users.english_name` багана нь
> **`DropUserEnglishName1786200000000` migration-оор устгагдана** — prod дээр
> `DB_MIGRATIONS_RUN=true` тул дараагийн deploy-д автоматаар ажиллана.
> **Хадгалагдсан бүх англи нэр бүрмөсөн алдагдана** (`down()` нь баганыг л
> сэргээнэ, өгөгдлийг биш). Хуучин client `englishName` илгээвэл
> `whitelist: true` чимээгүй арчина (400 биш).

**`username` (нэвтрэх нэр):** 3–30 тэмдэгт, зөвхөн `a-zA-Z0-9_` (дүрэм нэг газар:
`src/common/validation/username.ts` → `@IsUsername()`, `RegisterDto` мөн үүнийг
хэрэглэнэ; mobile тал `src/lib/username.ts`).
- буруу хэлбэр → **400**
- өөр хүн эзэмшсэн → **409** `Энэ username аль хэдийн бүртгэлтэй байна`
- Шалгалт **том/жижиг үсэг ялгахгүй** (`Bataa` = `bataa`) — нэвтрэхэд яг таарч
  тулгардаг тул хоёулаа орших нь нэг хүн мэт харагдах эрсдэлтэй. Мөн энэ дүрэм
  `POST /auth/register`-т ижилхэн үйлчилнэ.
- Өөрийнхөө одоогийн нэрийг дахин илгээх нь зөрчил **биш** (200).

## 3. Words — `/api/words`
Толь бичгийн үгс + AI үүсгэлт + bulk pipeline. GET уншилт public/JWT; бичилт admin-баг.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/words` | **Public** | Үг хайх/жагсаах | `QueryWordsDto` |
| GET `/words/:id` | **Public** | Нэг үг | path `id` |
| GET `/words/stats` | admin-баг | Контентын эрүүл мэндийн тоо | — |
| GET `/words/analytics` | admin-баг | Сурлагын аналитик (мартсан/хадгалсан/мэдэх/хэцүү) | — |
| GET `/words/quiz` | JWT | Нийтэлсэн үгсээс MCQ vocab quiz үүсгэх (question бүр `imageUrl` + `audioUrl`-тэй; Listen тоглоом аудиогүй үед TTS-ээр дуудна) | `{ count }` |
| GET `/words/sample` | **Public** | Бүртгэлийн өмнөх taste-task (C4) — цөөн MCQ (**зөв хариу орсон**, апп локал шалгана). Auth шаардахгүй | `?count` (1–5, default 3) |
| GET `/words/match` | JWT | "Холбож ял" тоглоомд үг↔утга хос буцаах (grading нь `quiz/submit`-ээр) | `{ count }` |
| POST `/words/quiz/submit` | JWT | Quiz шалгаж, XP + Sparks олгох (Match тоглоом ч үүгээр). Хариу: `{ total, correct, xpAwarded, sparksAwarded, results: [{ wordId, correct, correctAnswer }] }` | `{ answers }` |
| POST `/words` | admin-баг | Үг үүсгэх | `CreateWordDto` |
| POST `/words/bulk` | admin-баг | JSON массиваас олноор → `{inserted, skipped}` | `CreateWordDto[]` |
| POST `/words/ai-fill` | admin-баг | Нэг үгийн бүх талбарыг AI-аар бөглөх | `{ english }` |
| POST `/words/ai-bulk` | admin-баг | Background AI bulk (Gemini + optional медиа) → `{jobId}` | `{ words[], generateImages?, generateAudios? }` |
| GET `/words/ai-bulk/:jobId` | admin-баг | AI-bulk / media job явц харах | path `jobId` |
| POST `/words/ai-bulk/:jobId/cancel` | admin-баг | Ажиллаж буй job зогсоох | path `jobId` |
| POST `/words/bulk-generate-media` | admin-баг | Одоо байгаа үгсэд зураг/аудио (background) → `{jobId}` | `{ wordIds[], image?, audio? }` |
| POST `/words/image-batch` | admin-баг | OpenAI Batch зураг → `{batchId}` | `{ wordIds[] }` |
| POST `/words/image-batch/enqueue` | admin-баг | Cron image batch-д дараалалд оруулах | `{ wordIds[] }` |
| POST `/words/image-batch/enqueue-all-missing` | admin-баг | Зураггүй БҮХ үгийг нэг товчоор дараалалд оруулах (UI-ийн 5000 хязгааргүй; queue-д байгааг алгасна) | — |
| GET `/words/image-batch-queue` | admin-баг | Серверийн image-batch дарааллын явц | — |
| POST `/words/image-batch-queue/stop` | admin-баг | Дараалал зогсоох + OpenAI batch цуцлах | — |
| GET `/words/image-batch/:batchId` | admin-баг | Batch зургийн job харах | path `batchId` |
| POST `/words/image-batch/:batchId/ingest` | admin-баг | Дууссан batch-ийн зургийг хадгалах | path `batchId` |
| POST `/words/import` | admin-баг | CSV импорт (шинэ → needs_review) | multipart `file` (.csv) |
| PATCH `/words/bulk` | admin-баг | Олноор засах (нийтлэх/зөвшөөрөх/ангилах/**хичээлд хавсаргах**) | `{ ids, changes }` — `changes.lessonId` = хичээлд хавсаргах, `null` = салгах |
| POST `/words/dedupe` | admin-баг | Давхардсан үг устгах | — |
| POST `/words/:id/generate-image` | admin-баг | Нэг үгэнд зураг үүсгэх | path `id` |
| POST `/words/:id/generate-audio` | admin-баг | Нэг үгэнд дуудлагын аудио үүсгэх | path `id` |
| PATCH `/words/:id` | admin-баг | Үг засах | `UpdateWordDto` |
| DELETE `/words/:id` | admin-баг | Үг устгах | path `id` |

## 4. Lessons — `/api/lessons`
GET уншилт public. (Sparks endpoint-ууд мөн энэ base дээр — §5.)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/lessons` | **Public** | Хичээлийн жагсаалт. Анхдагч эрэмбэ: `level ASC, position ASC, createdAt ASC` (`getContinue`-тэй ижил); `sort=newest` = шинэ нь эхэнд (админы жагсаалт) | `QueryLessonsDto` (isPublished, level, type, parentId, **sort**) |
| GET `/lessons/continue` | JWT | "Continue learning" (C1) — дараагийн дуусгаагүй top-level хичээл + тухайн level-ийн бодит ахиц → `{ lesson\|null, level, levelDone, levelTotal, allCompleted }` | — |
| GET `/lessons/completed` | JWT | Тухайн сурагчийн дуусгасан хичээлийн id-ууд → `{ ids: string[] }`. Түвшний зам ✓-г **id-гаар** тэмдэглэдэг (өмнө нь "эхний N" гэж тоолоод буруу хичээл дээр буудаг байсан) | — |
| GET `/lessons/:id` | **Public** | Нэг хичээл | path `id` |
| POST `/lessons` | admin-баг | Хичээл үүсгэх. `position` дамжуулаагүй бол тухайн түвшний **хамгийн ард** нэмэгдэнэ (1-ээс эхэлдэг; 0 = эрэмбэлээгүй) | `CreateLessonDto` |
| PATCH `/lessons/:id` | admin-баг | Хичээл засах | `UpdateLessonDto` |
| DELETE `/lessons/:id` | admin-баг | Хичээл устгах | path `id` |
| POST `/lessons/:id/complete` | JWT | Хичээл дуусгаж XP олгох (нэг удаа, idempotent) | path `id` |
| POST `/lessons/:id/transcribe` | admin-баг | Хичээлийн видеог ElevenLabs Scribe-аар бичвэр болгоно (`content.videoUrl` заавал). Синхрон, ~30–60 сек. Зардал `ai_usages`-д `purpose: lesson_transcript`-ээр бүртгэгдэнэ | path `id` |
| GET `/lessons/:id/transcript` | admin-баг | Хадгалагдсан бичвэр. `GET /lessons` ба `GET /lessons/:id` дээрээс бичвэр **хасагддаг** тул тусдаа | path `id` |
| PATCH `/lessons/:id/transcript` | admin-баг | Гараар засварласан бичвэр | `UpdateTranscriptDto` (`{ text }`) |

⚠️ `content.transcript` нь **серверийн эзэмшилтэй**: `PATCH /lessons/:id` түүнийг
бичиж ч, устгаж ч чадахгүй (хадгалагдсан утгыг сэргээж бичдэг). Шалтгаан: админы
хичээл засах форм `content`-оо жагсаалтын хариунаас угсардаг бөгөөд тэнд бичвэр
байхгүй тул хамгаалахгүй бол хадгалах бүрд устана.

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
| GET `/quizzes` | JWT | Quiz жагсаах (шүүлттэй) | `QueryQuizzesDto` (lessonId, category, topic, standalone, isPublished, **includeUnanswerable**) |
| GET `/quizzes/:id` | JWT | Нэг quiz (зөв хариу нуугдана) | path `id` |
| POST `/quizzes` | admin-баг | Quiz үүсгэх | `CreateQuizDto` |
| PATCH `/quizzes/:id` | admin-баг | Quiz засах | `UpdateQuizDto` |
| DELETE `/quizzes/:id` | admin-баг | Quiz устгах | path `id` |
| POST `/quizzes/:id/submit` | JWT | Хариу шалгаж XP олгох (≥1 зөв бол). XP нь **quiz тус бүрт нэг удаа** (`awardOnce`, farming-аас сэргийлнэ); дахин илгээвэл `xpEarned: 0`. Бүр submit `quiz_attempt` (skill+score) хадгална; `assignmentId` өгвөл даалгаврын submission-ыг оноотой бүртгэнэ | `SubmitQuizDto` (`answers`, `assignmentId?`) |
| POST `/quizzes/:id/check` | JWT | **Нэг** хариу шалгах — C2 шуурхай feedback (XP олгохгүй, бүх түлхүүр задлахгүй). Буруу бол тухайн асуултын зөв хариу буцна. **Буруу хариулт 1 зүрх авна** (§6a; багшийн даалгавар **үл хамаарна**) → `{ correct, correctAnswer?, hearts }` (`correctAnswer`: mc→index · fill_blank→string · word_match→pairs; `hearts` = `HeartsState`) | `AnswerItemDto` (`questionIndex`, `answer`) |
| POST `/quizzes/ai-generate` | admin-баг | **Бичсэн агуулгаас AI-аар асуултын ноорог үүсгэх** (Дасгал · Сорил · IELTS гурвуулаа). **DB рүү юу ч бичихгүй** — буцаасан ноорогийг админ preview дээр засаад `POST /quizzes`-ээр өөрөө хадгална | `AiGenerateQuizDto` |
| POST `/quizzes/bulk-generate` | admin-баг | **Агуулга бичихгүйгээр бүхэл түвшний контент үүсгэх** — төрөл тус бүрт N дасгал, байгаа контенттой давхцуулахгүйгээр. ⚠️ `ai-generate`-ээс ялгаатай нь **шууд хадгална** (нийтэлсэн төлөвтэй). Background → `{ started, background, jobId, total }` | `BulkGenerateQuizDto` |
| GET `/quizzes/bulk-generate/:jobId` | admin-баг | Явц татах (админ 2.5с тутам). Танихгүй/хугацаа нь дууссан id → `{ done: true, expired: true }` | path `jobId` |
| POST `/quizzes/bulk-generate/:jobId/cancel` | admin-баг | "Зогсоох" — эхэлсэн дуудлагууд дуусаад шинэ нь эхлэхгүй | path `jobId` |

**`POST /quizzes/ai-generate`** — `AiGenerateQuizDto`:
`brief` (заавал, чөлөөт текст) · `kind` (`exercise`\|`lesson`\|`ielts`) ·
`category?` · `topic?` · `level?` · `questionType?` · `count?` (1–20) ·
`passageText?` (IELTS Reading) · `contextNote?` (prompt-д нэмэх контекст) ·
`lessonSource?` (хичээлийн видеоны бичвэр, `kind: 'lesson'` үед; хамгийн ихдээ
12,000 тэмдэгт хүртэл prompt-д тусдаа блокоор орно).
`level` / `questionType` / `count` -г **орхивол AI өөрөө таамаглаж**, юу сонгосноо
хариунд буцаана.

Хариу: `{ title, level, questionType, topic, passageText, questions[], warnings[] }`.
`warnings` = чанарын шалгуурын үр дүн (индекс мужаас гарсан зөв хариу, давхардсан
сонголт, `___` цоорхойгүй fill_blank, давхардсан асуулт г.м.) — засаж болохгүй
асуулт нь **хасагдаад** тайлбар нь `warnings`-д бичигдэнэ.

> ⚠️ `GEMINI_API_KEY` (билинг идэвхтэй) шаардана — эс бөгөөс 500 буцна.

**`POST /quizzes/bulk-generate`** — `BulkGenerateQuizDto`:
`kind` · `level` (**заавал** — энэ онцлогийн гол цэг) · `perTarget` (1–10) ·
`questionCount` (1–20) · `xpReward?` · `targets[]`.

`targets[]` мөр бүр: `category` (`Quiz.category`) · `label` (AI-д контекст) ·
`topics?` (`Quiz.topic` — эдгээр рүү **ээлжлүүлж тараана**) · `questionType?` ·
`quizType?` (Сорилын тоглоом) · `contextNote?`.

> **Яагаад ангиллын хүснэгтийг frontend илгээдэг вэ:** Дасгал/Сорил/IELTS-ийн
> төрөл ба сэдвийн жагсаалт админд (`admin/src/lib/options.ts`) байдаг. Тэднийг
> backend-д хуулбарлавал хоёр газар зөрөх эрсдэлтэй болно.

Явцын хариу: `{ total, processed, created, skipped, failed[], done, canceled?, current? }`
(`skipped` = давхардлаас болж хаягдсан дасгал · `current` = "Сонсгол · Аялал #2").

**Давхардлаас хамгаалах 2 давхарга:** (1) тухайн `category`-гийн одоо байгаа
гарчгуудыг prompt-д "битгий давт" гэж өгнө; (2) буцаж ирсэн асуулт бүрийг DB дэх
бүх асуултын нормчилсон түлхүүртэй (`dedupKey` — жижиг үсэг, цэг таслалгүй)
харьцуулж, давхардсаныг **хасна**. Хассаны дараа 3-аас цөөн асуулт үлдвэл тухайн
дасгал бүхэлдээ хаягдаж `skipped` болно.

⚠️ **Ажил санах ойд** (`bulkJobs` Map, нэг instance) — Үгс/Хэлцийн загвартай ижил.
Сервер дахин ачаалагдвал явц алдагдана (үүссэн дасгал DB-д үлдэнэ). Дууссан
ажил 5 минутын дараа цэвэрлэгдэнэ. Зэрэг 3 AI дуудлага явна.

> **IELTS (Approach A):** IELTS content = quizzes with `category` in
> `ielts_listening` / `ielts_reading` / `ielts_writing` / `ielts_speaking`.
> Reading uses `passage_text`, Listening uses `audio_url`. Writing/Speaking use
> the `open_response` question type (`prompt` + `modelAnswer` + optional
> `imageUrl`/`bandNote`, `points:0`, self-study — no submit). Listening/Reading
> `POST /quizzes/:id/submit` responses include an approximate **`band`** (0–9)
> from the count of correct questions.

> ⚠️ **Чанарын шалгуур — хариулах боломжгүй дасгал үүсэхгүй** (2026-08-11).
> Бүх дүрэм нэг файлд: `backend/src/quizzes/quality.ts` (`checkQuiz`). Шинэ
> дүрэм нэмэхдээ **зөвхөн тэнд** нэм — үүсгэх · хадгалах · тайлагнах гурвуулан
> түүнийг ашигладаг (админд өөр, аппад өөр дүрэм үүсгэж БОЛОХГҮЙ).
>
> `block` = хадгалалт **400**-аар татгалзана, аппаас нуугдана:
> · сонсголын дасгал сонсох яриагүй (`passageText` < 40 тэмдэгт, `audioUrl`-гүй)
> · сонсголын асуултад дурдсан нэр яриан дотор огт сонсогдоогүй
> · `fill_blank` сонголтод gerund («swimming») ба infinitive («to swim») хоёулаа
> · зөв хариулт сонголтуудын дунд алга · `___` цоорхойгүй · сонголт давхардсан
> · зөв хариултын индекс мужаас гарсан · асуулт/хариулт хоосон
>
> `warn` = **блоклохгүй**, зөвхөн админд жагсаана (хүн шийднэ):
> · сонголтууд нэг үгийн хэлбэрүүд биш (утгаараа сонгох цоорхой)
> · зөв хариулт асуултын дотор шууд бичигдсэн · хоёр үг ижил орчуулгатай
> · сонсголын хариулт яриан дотор сонсогдохгүй · давхардсан асуулт
>
> **`GET /quizzes` нь `block`-той мөрүүдийг анхдагчаар НУУНА** — сонсголынхыг
> SQL-ээр, үлдсэнийг JS-ээр. Апп ямар ч туггүй дуудах тул **шинэчлэл хүлээхгүй**
> шууд цэвэр контент авна. Админ **`includeUnanswerable=true`**-ээр бүгдийг харна.
> ⚠️ IELTS Listening (`ielts_listening`) энэ дүрэмд **орохгүй** — бодит бичлэгтэй.

| GET `/quizzes/quality-report` | admin | Эвдэрсэн/эргэлзээтэй бүх дасгалыг шалтгаантай нь жагсаана | `?category=` (заавал биш) |

> ⚠️ **`category` = аппын дэлгэц.** Bие даасан (standalone) quiz-ийг апп ЗӨВХӨН
> `category`-гаар нь татдаг тул `category`-гүй quiz хаана ч харагдахгүй. Одоо
> ашиглагдаж буй утгууд ба тэдгээрийг уншдаг дэлгэц:
>
> | `category` | Админ | Апп дэлгэц |
> | --- | --- | --- |
> | `listening` · `writing` · `fill` · `grammar` | Дасгал | `/skill/<category>` |
> | `reading` | Дасгал → ReadingPassage (тусдаа сан) | `/reading` |
> | `speaking` | — (тун удахгүй) | `/skill/speaking` |
> | `soril` | Сорил | Сорил таб → "Шинэ сорилууд" → `/quiz/:id` |
> | `ielts_*` | IELTS | `/ielts` hub → `/skill/ielts_*` эсвэл `/ielts/practice/*` |
>
> Шинэ `category` нэмэхдээ **аппын уншигч талыг нь мөн нэм** — эс бөгөөс контент
> DB-д үүсээд хэн ч хардаггүй болно.

## 6a. Hearts (зүрх / амь) — `/api/hearts`
Duolingo-маягийн "амь". Бүгд JWT.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/hearts` | JWT | Одоогийн зүрхний төлөв (сэргэлтийг тооцсон) | — |
| POST `/hearts/refill` | JWT | Sparks зарцуулж дүүргэх. Дүүрэн эсвэл Sparks хүрэхгүй бол **400** | — |

**`HeartsState` (хоёулаа энэ хэлбэрийг буцаана, `/quizzes/:id/check` мөн):**

```jsonc
{
  "hearts": 4,          // одоо байгаа тоо (сэргэлт нэмэгдсэн)
  "max": 5,             // тухайн багцын дээд хязгаар
  "unlimited": false,   // premium бол true — хэзээ ч хасагдахгүй
  "nextHeartAt": "…",   // дараагийн зүрх сэргэх цаг (дүүрэн/unlimited бол null)
  "fullAt": "…",        // бүрэн дүүрэх цаг (дүүрэн/unlimited бол null)
  "refillCost": 50      // одоо дүүргэхэд шаардах Sparks (дүүрэн бол null)
}
```

**Гол дүрэм — заавал ойлгох:**
- **Зүрх зөвхөн `POST /quizzes/:id/check` дотор хасагдана.** `POST /hearts/lose`
  гэсэн endpoint **зориудаар байхгүй** — client-ээс дуудаж болдог бол client-ээс
  алгасаж бас болно. Зөв/буруугийн шийдвэрийг server гаргадаг цорын ганц цэг нь
  `/check` тул хасалт тэнд явна.
- **🆕 Багшийн даалгавар зүрх авахгүй (2026-07-31).** Оноогдсон сорил дээр буруу
  хариулсан ч зүрх **хасагдахгүй**, XP ч **олгогдохгүй** — даалгавар бол
  гамификацийн гадна, энгийн сургуулийн даалгавар. Дунд нь зүрх дуусвал багшийн
  шаардсан ажлаа дуусгаж чадахгүй болно. Шийдвэрийг **server гаргана**
  (`AssignmentsService.isAssignedWork(userId, quizId)` — анги + `student_ids`-ээр),
  client-ийн илгээсэн `assignmentId`-д **найдахгүй**: тэгвэл хуурамч утга илгээж
  үнэгүй зүрх авах боломжтой болно. Гүйцэтгэл нь `assignment_completions`-д
  хэвээр бичигдэж багшийн самбарт харагдана.
- **Дахин илгээлтийн хамгаалалт:** ижил (хэрэглэгч, quiz, асуулт, хариу)-г 90
  секундэд дахин илгээвэл **дахин хасахгүй** (Redis `SET NX`). Хоёр дарсан/сүлжээ
  тасарч retry хийсэн нь 2 зүрх авахгүй. Харин **өөр** буруу хариулт (жишээ нь
  дахин эргэж ирсэн асуултад) шинэ алдаа тул дахин хасна.
- **Redis унасан үед fail-open** — хасахгүй өнгөрнө. Авах ёстой зүрхээ авахгүй нь
  2 удаа авахаас дээр.
- **Сэргэлт нь lazy** — cron байхгүй. `users.hearts` нь `hearts_updated_at`-ын
  хувьд л зөв; уншихад л тооцоолно. Тиймээс DB-ээс `hearts`-ыг **шууд уншиж
  болохгүй**, `HeartsService` дундуур ор.
- **Багцаас хамаарна** (`plans` хүснэгт, admin-аас тохируулна, app шинэчлэлгүй):
  `unlimited_hearts` · `max_hearts` · `heart_regen_minutes` · `heart_refill_sparks`.
  NULL = үнэгүй багцын анхдагч (**5 зүрх · 30 мин/зүрх · 50 Sparks**).
  ⚠️ Сэргэх хугацаа **240 → 30 мин болов (2026-07-31)** — 4 цаг нь сургуулийн
  аппад хэт хатуу байсан (хичээлийн дараа дуусгасан сурагч тэр оройдоо дахин
  дасгал хийж чадахгүй). Бүрэн дүүрэхэд 2.5 цаг. Redis-ээр deploy-гүйгээр
  тохируулна: `redis-cli set hearts:defaults '{"regenMinutes":30}'`.
  Хугацаа нь дууссан багц = багцгүйтэй адил.

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
| GET `/leaderboard/preview` | JWT | **Home preview** — top N (default 3) weekly/global, `me`-гүй хөнгөн жагсаалт | `limit?` (1–10) |
| GET `/leaderboard/top` | admin-баг | Admin top-N (admin-ий байршлыг үл тооцно) | `scope`, `period`, `value?`, `limit` |

> Entry бүр: `rank, userId, fullName, username, avatarUrl, province, district, xp, classId`.
> `classId` зөвхөн `scope=teacher` үед бөглөгдөнө (сурагчийн харьяалагдах анги, олон бол хамгийн сүүлд үүсгэсэн) —
> багшийн панель мөрөөс тухайн сурагчийн ahits руу deep-link хийхэд ашиглагдана. Бусад scope-д `null`.

## 9a. Events — `/api/events` (EventsController · 2026-08-06)
Home эвэнтүүд (Daily · Weekly challenge · Double XP). Controller-level: JWT.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/events/active` | JWT | Одоо идэвхтэй эвэнтүүд (`isActive` ба `starts_at ≤ now ≤ ends_at`), дуусахаар нь эрэмбэлсэн | — |
| GET `/events` | admin-баг | Бүх эвэнт (шинэ эхэнд) | — |
| POST `/events` | admin-баг | Эвэнт үүсгэх | `CreateEventDto` (type, title, description?, startsAt, endsAt, rewardXp?, xpMultiplier?, isActive?) |
| PATCH `/events/:id` | admin-баг | Засах | `UpdateEventDto` (бүх талбар optional) |
| DELETE `/events/:id` | admin-баг | Устгах | — |

> Entry: `id, type, title, description, startsAt, endsAt, rewardXp, xpMultiplier, isActive`.
> `type`: `daily · weekly_challenge · double_xp`. `double_xp` эвэнт идэвхтэй үед бүх
> XP олголт `xp_multiplier`-аар үржинэ (§13-ыг үз).

## 10. AI / Chat — `/api/ai`
Controller-level: JWT.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| ⛔ POST `/ai/chat` | JWT + `AI_BUDDY_ENABLED` | AI найзруу мессеж илгээх (хуучин, Buddy-ээс өмнөх route). Anthropic-т төлдөг тул buddy turn-уудтай хамт хаагдсан — §10a-ийн анхааруулга. Аппын аль ч дэлгэц үүнийг дууддаггүй (buddy таб `/ai/buddy/**` явдаг) | `{ message, conversationId? }` |
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

> ⛔ **`AI_BUDDY_ENABLED` — анхдагчаар ХААЛТТАЙ (2026-08-08, эзний launch шийдвэр).**
> Turn нь ElevenLabs (STT+TTS) ба Anthropic (LLM)-д дуудалт тутам төлдөг, гэтэл
> `PAYMENTS_ENABLED` хаалттай тул хэн ч төлж чадахгүй → үнэгүй данс бүр бодит
> мөнгө зарцуулна. **Хоёуланг хамт асаана, эсвэл хоёуланг хаалттай байлга.**
> Хаалттай үед доор ⛔ гэсэн route-ууд **503** + монгол мессеж буцаана
> (`src/ai-gateway/guards/ai-buddy-enabled.guard.ts`).
> Уншилтын route-ууд (`usage`, `statistics`, `memory`, `text-sessions`) **санаатай
> нээлттэй** — "Миний багц" дэлгэц тэднийг уншдаг тул 503 болговол хамааралгүй
> дэлгэц эвдэрнэ. `admin/test-voice` мөн нээлттэй (эзэн TTS-ээ шалгах хэрэгтэй).
> **AI толь бичиг (`/dictionary/*`) хөндөгдөөгүй** — Gemini хямд, үг бүр үүрд
> cache-лэгддэг тул давтагдсан хайлт төлбөргүй.
> Асаахад **апп шинэчлэх шаардлагагүй**: апп `GET /ai/buddy/availability`-г
> уншиж, дараагийн нээлтэд "Тун удахгүй" дэлгэцээ жинхэнэ табаар сольдог.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/ai/buddy/availability` | JWT | **Buddy одоо нээлттэй эсэх** → `{ enabled: boolean }`. Flag-аас үл хамааран үргэлж хариулна (аппын "Тун удахгүй" дэлгэцийн шийдэгч) | — |
| POST `/ai/buddy/sessions` | JWT | Session эхлүүлэх (зөвхөн DB, AI дуудалтгүй) | `{ buddySlug, mode?, topic? }` → `{ sessionId, buddy, usage }` |
| ⛔ POST `/ai/buddy/sessions/:id/turn/audio` | JWT + flag | Дуут turn (multipart `file`, ≤2MB) | full pipeline → turn response |
| ⛔ POST `/ai/buddy/sessions/:id/turn/text` | JWT + flag | Бичсэн turn (STT алгасна) | `{ text }` → turn response |
| GET `/ai/buddy/sessions/:id/messages` | JWT | Яриа түүх | path `id` |
| POST `/ai/buddy/text-session` | JWT | Бичгийн чат thread нээх + түүх (ChatGPT маягийн, апп дахин нээхэд хадгалагдана; voice-оос тусдаа). Body-оор thread сонгоно: `sessionId` (тодорхой хуучин thread), `new:true` (шинэ chat), эсвэл default (хамгийн сүүлийн) | `{ buddySlug, sessionId?, new? }` → `{ sessionId, messages: [{ id, role, content, correction, followUp, audioUrl }] }` |
| GET `/ai/buddy/text-sessions` | JWT | Тухайн buddy-тэй хийсэн бичгийн чатны түүх (thread жагсаалт, ChatGPT-style history panel) | query `buddySlug` → `[{ sessionId, title, messageCount, updatedAt }]` |
| DELETE `/ai/buddy/text-session/:id` | JWT | Бичгийн чат thread-ийг түүхээс устгах (өөрийн TEXT session, мессежийн хамт). History panel 🗑 | path `id` → `{ ok: true }` |
| GET `/ai/buddy/usage` | JWT | Энэ сарын voice/STT хэрэглээ | — |
| POST `/ai/buddy/sessions/:id/end` | JWT | Session дуусгах (idempotent) → `{ sessionId, durationSeconds, endedAt }` | path `id` |
| GET `/ai/buddy/statistics` | JWT | Buddy практик статистик → `{ totalSessions, totalMinutes, todaySessions, todayMinutes, longestSessionMinutes }` | — |

#### AI Buddy Background Shop — `/api/buddy/backgrounds` (2026-08-06)
Buddy-ийн ард харагдах дэвсгэрийг Sparks-аар авч тохируулна (XP БИШ — leaderboard хамгаална).

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/buddy/backgrounds` | JWT | Дэлгүүрийн каталог + өөрийн төлөв (`owned`/`equipped`/`purchasable`/`premiumLocked`) | — |
| GET `/buddy/backgrounds/equipped` | JWT | Тохируулсан дэвсгэр (эсвэл null) — buddy-ийн ард харуулна | — |
| POST `/buddy/backgrounds/:id/buy` | JWT | Sparks-аар авах (баланс/эзэмшил/premium/улирал шалгана) | path `id` |
| POST `/buddy/backgrounds/:id/equip` | JWT | Эзэмшсэн дэвсгэрийг тохируулах (бусдыг unequip) | path `id` |
| GET `/buddy/backgrounds/manage` | admin-баг | Бүх дэвсгэр (raw) | — |
| POST `/buddy/backgrounds` | admin-баг | Үүсгэх | `CreateBackgroundDto` (name, imageUrl, priceSparks?, isPremium?, seasonalStart?, seasonalEnd?, isActive?, sortOrder?) |
| PATCH `/buddy/backgrounds/:id` | admin-баг | Засах | `UpdateBackgroundDto` |
| DELETE `/buddy/backgrounds/:id` | admin-баг | Устгах | — |
| GET `/ai/buddy/memory` | JWT | Buddy-гийн санах ой | — |
| DELETE `/ai/buddy/memory` | JWT | Санах ой цэвэрлэх | — |
| POST `/ai/buddy/feedback` | JWT | Buddy хариултад 👍/👎 өгөх (мессежийн metadata-д хадгална) | `FeedbackDto` `{ messageId, rating:'up'\|'down', reason? }` → `{ ok }` |
| GET `/ai/buddy/admin/feedback` | admin, super_admin | Хэрэглэгчийн 👍/👎 санал (хуудаслалттай, message metadata-аас) | `page?` |
| POST `/ai/buddy/admin/test-voice` | admin, super_admin | Buddy-гийн дуу хоолойг жишээ текстээр сонсох (preview) | `TestVoiceDto` `{ buddySlug, text }` |
| GET `/ai/buddy/admin/safety-events` | admin, super_admin | Аюулгүй байдлын үйл явдлын audit log (хуудаслалттай) | `page?` |

Turn response: `{ session_id, message_id, user_transcript, reply_text,
correction, follow_up_question, mistake_tags[], xp_reward, audio_url,
avatar_instruction{emotion,gesture,duration_ms}, usage{voice_seconds_used_this_month,
voice_seconds_limit_this_month, warn_level} }`. `xp_reward` = энэ turn-д өгсөн XP
(session-д 1 удаа, дараа нь 0). `mistake_tags` = грамматик/vocab таг (жишээ
`["past_simple"]`). Voice limit хэтэрвэл `403 { code: 'VOICE_LIMIT' }` (mobile
текст рүү шилжинэ).

#### Realtime Buddy (streaming) — `/api/ai/buddy/rt` (2026-08-06)

Одоо байгаа turn pipeline-ыг **орлохгүй**, дээр нь SSE streaming давхарга нэмсэн.
Turn бүр яг л хуучин pipeline-аар (STT → LLM JSON contract → **safety gate** →
TTS → XP → memory) `buddy.textTurn`/`audioTurn`-аар боловсрогдоно; SSE нь зөвхөн
**үр дүнг дэвшилттэй хүргэнэ** (transcript → reply өгүүлбэрээр → audio → бүтэн
turn) + **interrupt**. Reply нь баталгаажсан JSON contract тул түүхий token
stream хийхгүй (safety-г бүхэлд нь дамжуулна). Транспорт нь **native SSE**
(шинэ dependency алга). Streaming чадахгүй клиент **хуучин REST turn руу автомат
буцна**.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/ai/buddy/rt/capabilities` | JWT | Streaming дэмжлэг шалгах → `{ enabled, transport:'sse', streamingText, streamingTts:'progressive', partialTranscript:false, interrupt:true, fallback:'request-response' }` | — |
| ⛔ POST `/ai/buddy/rt/turn/text` | JWT + flag | Streamed текст turn эхлүүлэх → `{ streamId }` | `{ sessionId, text }` |
| ⛔ POST `/ai/buddy/rt/turn/audio/:sessionId` | JWT + flag | Streamed voice turn (multipart `file`) → `{ streamId }` | path `sessionId` · file |
| GET (SSE) `/ai/buddy/rt/stream/:streamId` | JWT | Turn-ийн үйл явдлын урсгал (эзэмшил шалгана) | SSE events: `status`·`transcript`·`chunk`·`audio`·`done`·`error`·`interrupted` |
| POST `/ai/buddy/rt/interrupt/:streamId` | JWT | Явагдаж буй turn-ийг таслах → `{ ok }` | path `streamId` |

SSE event бүр `data: { type, ... }`: `transcript{text,final}` · `chunk{text}`
(reply-ийн нэг өгүүлбэр) · `audio{url}` · `done{turn}` (бүтэн `TurnResponse`) ·
`error{message}` (→ клиент REST руу буц). Env `BUDDY_REALTIME_ENABLED=0` бол
бүхэлд нь унтарч, `capabilities.enabled=false` → клиент fallback.
**Хязгаарлалт:** live-mic partial transcript (streaming STT) одоогийн provider/
Expo Go-д боломжгүй тул `partialTranscript:false`; mobile flag
(`BUDDY_REALTIME_ENABLED`) анхдагчаар **OFF** — дэлгэрэнгүй
`docs/AI_BUDDY_REALTIME.md`.

## 11. Dictionary — `/api/dictionary`
Controller-level: JWT. (Reading-ийн tap-to-translate ашигладаг.)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/dictionary/search/:word` | JWT | **Толь:** `{ word, translation, senses[], cached }` — `translation` нь **үгийн өөрийнх нь** монгол утга ("гүйх; ажиллуулах; урсах", утга олдоогүй бол `null`), `senses` нь хамгийн ихдээ 4 утга (үг · англи жишээ · тэр өгүүлбэрийн орчуулга) хэрэглээний давтамжаар. `dictionary_entries` cache → Gemini (нэг дуудлагаар хоёулаа) | path `word` |
| GET `/dictionary/saves` | JWT | Хэрэглэгчийн ⭐ тольны үгс | — |
| POST `/dictionary/saves/:word` | JWT | ⭐ toggle. `words` банкинд мөр үүсгэхгүй | path `word` |
| GET `/dictionary/admin/entries` | admin/super_admin/moderator | Толины жагсаалт (хуудаслалт) | query `search`, `page`, `limit`, `sort=searches\|recent` |
| PATCH `/dictionary/admin/entries/:id` | admin/super_admin/moderator | Утгуудыг гараар засах (`edited=true`) | body `{ senses: [{word, example, translation}] }` (1–4) |
| DELETE `/dictionary/admin/entries/:id` | admin/super_admin/moderator | Толины бичлэг устгах (дараагийн хайлтад AI дахин үүсгэнэ) | path `id` |
| GET `/dictionary/:word` | JWT | Богино монгол утга (DB → cache → Gemini) — унших дэлгэцийн давхар дарах. Word bank hit дээр жишээ өгүүлбэр байвал `meanings: [{ word, example, translation }]` мөн ирнэ | path `word` |
| POST `/dictionary/translate` | JWT | Өгүүлбэрийн бүтэн монгол орчуулга (cache → Gemini) | body `{ text }` |
| GET `/dictionary/:word/audio` | JWT | Дуудлагын аудио URL (ElevenLabs, cached) | path `word` |

> ⚠️ **`POST /dictionary/:word/save` устсан (2026-08-03).** Тэр нь `words` банкинд
> `needs_review` мөр үүсгэдэг байсан. Оронд нь `POST /dictionary/saves/:word`
> (toggle) — `user_dictionary_saves` хүснэгтэд бичнэ.
>
> ⚠️ **Route дараалал:** `@Get(':word')` нь нэг сегменттэй бүх GET-ийг залгидаг тул
> `/saves`, `/search/:word`, `/admin/*` нь controller дотор түүнээс дээр байрлана.

## 12. Reviews (SRS) — `/api/reviews`
Controller-level: JWT. Бүгд student-ийн өөрийн давталтын хуваарь.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/reviews/due` | JWT | Одоо давтах ёстой үгс | — |
| GET `/reviews/learn` | JWT | Сурах үгсийн багц (swipe) | — |
| GET `/reviews/saved` | JWT | Хадгалсан (⭐) үгс | — |
| GET `/reviews/stats` | JWT | Үгсийн SRS статус: `{ known, new, learning, young, mature, dueNow, masteryThresholdDays }` (`known` = `young + mature`, хуучин клиентэд үлдээсэн) | — |
| POST `/reviews/:wordId` | JWT | Санах оролдлого илгээж давталт дахин товлох (SM-2) | `{ quality }` |
| POST `/reviews/:wordId/save` | JWT | ⭐ хадгалах флаг toggle | path `wordId` |

## 13. Gamification — `/api/gamification` (XpController)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/gamification` | JWT | Streak, level, өнөөдрийн XP, зорилго + `progressByLevel` (CEFR island бүрийн `done/total`), `streakFreezeCost/maxStreakFreezes/streakFreezesUsed`, `todayExercises/dailyExerciseGoal` + **`levelUnlocks`** (island бүрийн `{ starsEarned, starsRequired, unlocked }` — star-gated castle unlock) | — |
| GET `/gamification/stars` | JWT | Тухайн хэрэглэгчийн хичээл бүрийн од → `{ "<lessonId>": 0..3 }` (зөвхөн ≥1 од авсан хичээл) | — |

### 🆕 Од / Castle unlock / Double-XP (Task 1 — 2026-08-06)

- **Хичээлийн од (0–3):** хичээлд холбогдсон тест (`quiz.lessonId`)-ийн
  `POST /quizzes/:id/submit` дотор оноогоор нь тооцож `user_lesson_stars`-д
  **байнга (best)** хадгална. Threshold: ≥50% → 1, ≥70% → 2, ≥90% → 3. Хариунд
  **`starsEarned`** нэмэгдэв.
- **Castle unlock:** `getGamification.levelUnlocks` — island бүр нээгдэхэд
  шаардах нийт од `level_requirements` (admin-tunable) хүснэгтэд. Default:
  a1=0·a2=3·b1=9·b2=18·c1=30·c2=45.
- **Double XP:** идэвхтэй `double_xp` эвэнтийн үед `XpService.award` бүх XP-г
  `xp_multiplier`-аар үржүүлнэ (ledger + `User.xp` cache хоёулаа).


### 🆕 XP шагналын хүснэгт — `xp/xp-rewards.ts` (2026-07-31)

Тогтмол XP-ууд 6 модульд тарсан байсныг (`LESSON_XP`, `READING_XP`, `BUDDY_XP`,
`ONBOARDING_XP`, `REFERRAL.SIGNUP_XP_*`) **нэг хүснэгтэд** цуглуулав. Redis
`xp:rewards` түлхүүрээр **deploy-гүйгээр** тохируулна (`hearts:defaults`-тай яг
ижил загвар — CLAUDE.md-ийн үндсэн дүрэм):

    redis-cli set xp:rewards '{"lesson":25,"reading":20}'

Хэсэгчилсэн object болно — дурдаагүй нь код доторх анхдагчаараа үлдэнэ.

| Түлхүүр | Анхдагч | Хэзээ |
| --- | --- | --- |
| `lesson` | 15 | Хичээл анх дуусгах |
| `reading` | 15 | Уншлага анх дуусгах |
| `buddy` | 10 | AI найзтай ярианы **session тутам нэг** удаа |
| `onboarding` | 10 | Бүртгэлийн өмнөх taste-task (verify хийхэд) |
| `referralInviter` / `referralInvitee` | 50 / 50 | Урисан найз verify хийхэд |
| `streakBase` · `streakMax` | 5 · 50 | Дарааллын бонус — доор үзнэ үү |

**Энд ОРООГҮЙ:** сорилын XP. Тэр нь `quiz.xpReward` — admin панелиас сорил
тутамд тохируулагддаг DB багана, контентоос хамаарсан шагналын зөв загвар.

### 🆕 Дарааллын XP (`XpSource.STREAK`) — 2026-07-31

Урьд нь enum-д байсан ч **хаана ч олгогддоггүй** байсан. Одоо: өдрийн зорилго
биелж дараалал ахих үед `min(streakBase × дараалал, streakMax)` XP нэмнэ.

- **Гүйлгээ commit болсны дараа** олгоно — ахисан дарааллыг харах ёстой.
- **Өдөрт яг нэг удаа**: `awardOnce`-ийн `referenceId` = өдрийн түлхүүр (UB).
- **Рекурс болохгүй**: `source === STREAK` бол дахин бонус тооцохгүй (гол
  хамгаалалт), нэмээд тэр үед `lastActiveDate` аль хэдийн өнөөдөр болсон байна.
  Хоёуланг нь `xp/streak-bonus.spec.ts` шалгана.

### Давталт (SRS) XP — `POST /reviews/:wordId`

Флашкарт давтахад **XP олгодог боллоо** (өмнө нь огт олгодоггүй байсан ч
`XpSource.WORD_REVIEW` enum нь бэлэн байсан). Хариунд **`xpEarned`** нэмэгдэв.

| Тохиолдол | XP |
| --- | --- |
| Зөв санасан (`quality >= PASS_THRESHOLD`) | **10** |
| Санаагүй | **2** (оролдсон нь ч тоологдоно) |

**Anti-abuse:** нэг үг **өдөрт нэг л удаа** XP өгнө (Redis
`reviewxp:<user>:<word>:<өдөр>`). `awardOnce`-оор үг тус бүрт нэг удаа гэвэл
буруу байх байсан — SRS гэдэг нь яг тэр үгийг долоо хоног/сараар дахин давтах
тухай, тэр нь XP авсаар байх ёстой. Өдрөөр таглах нь дадлыг урамшуулж,
"нэг картыг нааш цааш шудрах" фармыг утгагүй болгоно.

## 13a. Push мэдэгдэл — `/api/notifications`

| Method + Path | Auth | Зорилго | Body |
| --- | --- | --- | --- |
| POST `/notifications/token` | JWT | Төхөөрөмжийн Expo token бүртгэх (idempotent). Хэлбэр буруу бол **400** | `{ token: "ExponentPushToken[...]" }` |
| DELETE `/notifications/token` | JWT | Гарах/зөвшөөрөл цуцлахад token устгах | — |
| POST `/notifications/prefs` | JWT | Сануулга асаах/унтраах (token хэвээр үлдэнэ) | `{ enabled: boolean }` |
| POST `/notifications/broadcast` | admin | Бүх (эсвэл роль тус бүрийн) хэрэглэгчид push илгээх — **одоо бодитоор илгээнэ** (өмнө нь `console.log` stub байсан) | `BroadcastNotificationDto` |
| GET `/notifications` | admin | Илгээсэн мэдэгдлийн түүх | — |

**Өдөр тутмын давтлагын сануулга (cron).** UB цагаар **20:00**-д ажиллана
(`scheduler.service.ts`). Сонгох дүрэм:
- `word_reviews.next_review_at <= now()` тоо **≥ 5**
- `expo_push_token` бий **ба** `push_enabled = true`
- **өнөөдөр хичээллээгүй** (`last_active_date != today`) → идэвхтэй хэрэглэгчийг сайрхуулахгүй
- сүүлийн **20 цагт** сануулга аваагүй (`last_reminder_at`) → cron 2 удаа ажиллавал давхар илгээхгүй

Мессеж нь **тодорхой**: "*N үг чамайг хүлээж байна*" — ерөнхий "буцаж ирээрэй"
биш. Expo `DeviceNotRegistered` гэж хариулсан token-ыг **автоматаар цэвэрлэнэ**
(устгасан апп руу мөнхөд илгээхгүй).

## 13b. Өдрийн зорилт — `/api/gamification`

| Method + Path | Auth | Зорилго | Body |
| --- | --- | --- | --- |
| PATCH `/gamification/goal` | JWT | Өдрийн XP зорилт тавих. Зөвхөн **20 / 50 / 100** (өөр утга → **400**). Хариу нь шинэчилсэн gamification summary | `{ dailyGoalXp: 20\|50\|100 }` |
| POST `/gamification/streak-freeze` | JWT | **Streak freeze** худалдаж авах (100 Sparks, багцаас хамаарна). Хамгийн ихдээ **2** хадгална → давсан бол **400**; Sparks дутуу → **400** | — |
| POST `/gamification/streak-seen` | JWT | Streak баяр хүргэлтийг үзүүлсний дараа тэмдэглэнэ → `{ ok: true }` | — |
| POST `/gamification/daily-path/claim` | JWT | Soril daily path дүүрсэн үед өдөрт 1 удаа Sparks авах → `{ sparksAwarded, alreadyClaimed, todayExercises, dailyExerciseGoal }` | — |

`GET /gamification` хариунд одоо **`streakFreezeCost`** (тухайн хэрэглэгчийн
багцаар шийдэгдсэн үнэ) ба **`maxStreakFreezes`** бас орно — апп үнийг
hardcode хийхгүйн тулд (`HeartsState.refillCost`-тэй ижил зарчим).

**Streak баяр хүргэлт (2026-07-31).** `GET /gamification` хариунд
**`streakCelebration: { streak, bonusXp } | null`** нэмэгдсэн. Streak ахисан
өдрийн эхний уншилтад л утгатай гарч, апп трофейн адил баяр хүргэх цонх
харуулаад `POST /gamification/streak-seen` дуудна. "Үзсэн" тугийг **Redis**-д
(`streak:seen:{userId}`, TTL 48ц) хадгална — "streak өнөөдөр ахисан" гэдэг нь
`users.last_active_date` дотор аль хэдийн байгаа тул шинэ багана шаардлагагүй.
Redis уншигдахгүй бол `null` буцна (цонх давтагдахаас нэг удаа алдсан нь дээр).
`bonusXp` нь `streakXp()`-ээс — Redis-ээр тохируулагддаг тул апп hardcode
хийхгүй.

**Streak нь ӨДРИЙН ЗОРИЛТ биелэхэд ахина** (2026-07-29-нөөс). Өмнө нь өдрийн
**анхны XP** дээр ахидаг байсан тул 1 XP олоход л streak нэмэгддэг байв —
"апп нээсэн" гэсэн утгатай болж, хэмжүүр сул байсан. Одоо `todayXp >= dailyGoal`
болмогц ахина (Duolingo яг ингэдэг). Freeze-ийн логик хэвээр.

`GET /gamification`-ийн `dailyGoal` нь одоо хатуу 50 биш, **хэрэглэгчийн сонголт**
(`users.daily_goal_xp`). Хариунд **`streakFreezes`** (үлдсэн freeze) ба
**`streakFreezesUsed`** (одоогийн streak-ийг хамгаалахад зарцуулсан freeze) бас орно.

**Streak freeze дүрэм** (`resolveStreak`, `src/xp/gamification.ts` — цэвэр функц,
unit-тесттэй):
- Өчигдөр идэвхтэй байсан → streak үргэлжилнэ, freeze зарцуулагдахгүй.
- **1 өдөр** алгассан + ≥1 freeze → 1 freeze зарцуулж streak хадгалагдана.
- **2 өдөр** алгассан + ≥2 freeze → 2 freeze зарцуулна.
- **3+ өдөр** алгассан → хэдэн freeze байсан ч streak тэглэгдэнэ
  (`MAX_FROZEN_DAYS = 2`). Freeze хураагаад сараар алга болчихоод "100 хоногийн
  streak"-тай эргэж ирэхээс сэргийлнэ.
- **Аврах боломжгүй завсарт freeze зарцуулахгүй** — streak яагаад ч хамаагүй
  тасрах бол freeze нь хэвээр үлдэнэ.

> **🔧 Засвар (2026-08-03).** `GET /gamification`-ийн буцаадаг `currentStreak` нь
> **freeze-ийг тооцдог** болов (`isStreakAlive()` — `resolveStreak`-тай ижил
> дүрэм, зөвхөн уншдаг хувилбар). Өмнө нь зөвхөн "өнөөдөр эсвэл өчигдөр
> идэвхтэй байсан уу" гэж шалгадаг байсан тул: 1 өдөр алгассан + 1 freeze-тэй
> хэрэглэгч өдрийн зорилтоо биелүүлэх хүртэл Home дээрээ **0** харж, төлбөртэй
> авсан freeze нь ажиллаагүй мэт ойлгогддог байв (freeze нь зорилт биелэх үед л
> зарцуулагддаг). Хариуны бүтэц өөрчлөгдөөгүй.

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

> **Сурагчийн `avatarUrl`.** `/classes/:id` (`students[]` + `teacher`),
> `/classes/:id/students`, `/classes/:id/requests` бүгд бүтэн `SafeUser` буцаана —
> **`avatarUrl` аль хэдийн орсон** (`sanitizeUser` нь зөвхөн `passwordHash`-ыг л
> хасдаг). Утга нь эсвэл байршуулсан зургийн URL, эсвэл `default:avN` түлхүүр,
> эсвэл **`null`** (сурагч зураг тавиагүй → mobile `Avatar` нэрнээс нь үүдэлтэй
> бэлэн зураг харуулна). Багшийн талд зураг гарахгүй бол API биш, тухайн мөрийн
> `avatar_url` хоосон байгаа эсэхийг эхлээд шалга.

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
| POST `/assignments` | teacher, admin, super_admin | Хичээл/quiz-ийг ангид оноох. `note` + `studentIds` (сонгосон сурагчид, хоосон = бүх анги) дэмжинэ; оноох үед target сурагч бүрд `assigned` submission урьдчилж үүснэ | `CreateAssignmentDto` (`note?`, `studentIds?`) |
| GET `/assignments/mine` | JWT | Элссэн ангиудын даалгаврууд | — |
| GET `/assignments` | JWT (гишүүнчлэл шалгана) | Ангийн даалгаврууд | `classId` (required) |
| GET `/assignments/:id/submissions` | teacher, admin, super_admin | Даалгаврын submission-ууд (сурагч бүрийн status/оноо/оролдлого) | path `id` |
| POST `/assignments/:id/complete` | JWT | Сурагч даалгавар дуусгах (idempotent; `late`/`completed` тэмдэглэнэ) | path `id` |
| DELETE `/assignments/:id` | teacher, admin, super_admin | Даалгавар устгах | path `id` |

> 🔴 **Даалгавар = гамификацийн ГАДНА (2026-07-31).** Багшийн оноосон сорил
> дээр **XP олгохгүй**, **зүрх хасахгүй** — энэ бол энгийн сургуулийн даалгавар.
> Шийдвэрийг `AssignmentsService.isAssignedWork(userId, quizId)` server талд
> гаргана (client-ийн `assignmentId`-д найдахгүй — тэр нь үнэгүй зүрхний унтраалга
> болно). Submission нь хэвээр бүртгэгдэж багшийн самбарт харагдана.
> `XpSource.ASSIGNMENT` нь **зориуд ашиглагдахгүй** — enum-д зөвхөн хуучин
> `xp_logs` мөрүүд задрахын тулд үлдсэн.

> **Teacher Panel Phase 1:** `POST /quizzes/:id/submit` нь `SubmitQuizDto`-д
> сонголтоор `assignmentId` авна — өгвөл тухайн даалгаврын submission-ыг оноотой
> нь бүртгэнэ. Бүх quiz submit нэг `quiz_attempt` (skill + score) хадгална
> (skill breakdown-ийн эх сурвалж). Дараах teacher read views нь эдгээр дата дээр
> тулгуурлана (mobile багшийн панел ашиглана).

## 16a. Teacher (багшийн панел read views) — `/api`
| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/teacher/dashboard` | teacher, admin, super_admin | Багшийн ангиудын нийт/идэвхтэй(7 хон.) сурагч, дундаж, pending/overdue | — |
| GET `/classes/:id/overview` | teacher, admin, super_admin | Ангийн skill breakdown + хамгийн сул skill + сурагч бүрийн completion % | path `id` |
| GET `/classes/:id/students/:studentId/progress` | teacher, admin, super_admin | Нэг сурагчийн skill breakdown (+vocab), даалгаврын түүх+оноо, XP/streak. Хариу: `studentId, fullName, avatarUrl, xp, currentStreak, skills, assignments[]` | path `id`, `studentId` |

## 17. Payments — `/api/payments`
Guard per-method. (QPay QR stub — §PRODUCT: Update 1.)

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/payments/plans` | **Public** | Идэвхтэй багцын жагсаалт | — |
| POST `/payments/plans` | admin, super_admin | Багц үүсгэх (давхардвал 409) | `CreatePlanDto` |
| POST `/payments` | JWT | Төлбөрийн intent үүсгэх (QPay QR stub) | `CreatePaymentDto` |
| POST `/payments/:id/confirm` | JWT | QPay callback дараа баталгаажуулах. Худалдан авагчийг урьсан хүн байвал эхний удаад урисан хүнд referral Sparks bonus нэмнэ (transaction дотор, нэг л удаа) | `ConfirmPaymentDto` |
| GET `/payments/my` | JWT | Өөрийн төлбөрийн түүх | — |
| GET `/payments` | admin, super_admin | Бүх төлбөр (хэрэглэгчтэй) | — |

## 18. Upload — `/api/upload`
Controller-level: admin-баг.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/upload` | admin-баг | Зураг/аудио/видео/**3D загвар** → нийтийн URL. Зураг→Cloudinary (≤10MB), аудио/видео→Cloudinary (≤200MB), **`.glb/.gltf`→Cloudflare R2 (≤50MB)**. Хариу `{ url, filename, type }` (`type: image\|video\|audio\|model`) | multipart `file` |

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

## 21. Referrals (урих) — `/api/referrals`

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/referrals/me` | JWT | Өөрийн урих код + шагналын статистик. Код байхгүй бол анх дуудахад автоматаар үүсгэнэ → `{ referralCode, username, invitedCount, totalXpEarned, totalSparksEarned }` | — |

**Урамшуулал:** найз `referralCode`-оор бүртгүүлж имэйлээ баталгаажуулахад **хоёр тал тус бүр +50 XP**
(`XpSource.REFERRAL`). Тэр найз анхны төлбөрөө хийхэд **урисан хүнд Sparks bonus**
(`SparksSource.REFERRAL`, `/payments/:id/confirm` дотор). Урих код нь username-ээр
ч ажиллана. Шинэ prod багана/enum: migration `AddReferralSystem1782500000000`.

## 22. Achievements (trophy) — `/api/achievements`

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/achievements` | JWT | Trophy catalog + өөрийн авсан төлөв → `{ tiers[], total, earned, unseen[], pinned[], trophies: [{slug, tier, name, image, thumb, condition, earned, earnedAt}] }` | — |
| POST `/achievements/seen` | JWT | Баярлах цонх үзүүлсний дараа тэмдэглэнэ → `{ updated }` | `{ slugs?: string[] }` — хоосон бол бүх үзээгүйг |
| POST `/achievements/pinned` | JWT | Профайлд онцлох трофейнуудыг **бүхэлд нь** солино → `{ pinned }`. >5 эсвэл аваагүй трофей → **400** | `{ slugs: string[] }` (харагдах дараалалтай, хоосон = бүгдийг болиулна) |

**Онцлох (pin, 2026-07-31).** Хэрэглэгч авсан трофейнуудаасаа **хамгийн ихдээ 5**-ыг
профайл дээрээ онцолно. Дараалал нь `user_trophies.pinned_rank` (0…4, null =
онцлоогүй; migration `AddTrophyPinnedRank1786300000000`). Аваагүй трофей мөргүй
тул онцлох боломжгүй. `GET /achievements → pinned[]` нь rank-аар эрэмбэлэгдсэн.

**Зураг:** `thumb` = 256px WebP ~19KB · `image` = 640px WebP ~87KB.
**Grid-д заавал `thumb` ашиглана** — 100 трофейг `image`-ээр зурвал 2.4MB биш 8.7MB татна.

**Олголт автомат.** `XpService.award()` транзакц commit хийсний дараа
`AchievementsService.checkAfterXp()` дуудагдана (fire-and-forget, алдаагаа өөрөө
залгина). Тухайн `XpSource`-той холбоотой нөхцөлүүд + XP/streak/sparks/трофейн тоо
(эдгээр нь эх сурвалжаас үл хамааран өөрчлөгддөг) л шалгагдана.

Авсан трофей `user_trophies` хүснэгтэд (`UNIQUE(user_id, slug)`); `created_at` = авсан
огноо, `seen_at = null` = баярлах цонх хараахан гараагүй. Хуучин `users.trophies` jsonb
багана **ашиглагдахаа больсон**.

**Нөхцөл:** `catalog.ts` дотор өгөгдөл хэлбэрээр (`{ type, value }`), логик нь
`conditions.ts`-д. 96 трофей нөхцөлтэй; 4 CEFR Finisher `condition: null` (UI-д
"удахгүй"). Grammar цуврал нь `quiz_count{skill:'fill'}` — `fill` контент нэмэгдэх
хүртэл түр идэвхгүй.

Шинэ prod хүснэгт: migration `CreateUserTrophies1786100000000`.
Deploy хийсний дараа нэг удаа `src/scripts/backfill-trophies.ts` ажиллуулна
(`--dry-run`-тай) — байгаа хэрэглэгчдийн түүхийг чимээгүй (`seen_at = now()`) олгоно.

---

## 24. Speaking (дуудлагын дасгал) — `/api/speaking` (2026-08-10)

Ярианы дасгал: сурагч үгээ дуудаж бичих → сервер STT-ээр таниж, зорилтот үгтэй
харьцуулна. AI-gateway-ийн **STT adapter (ElevenLabs Scribe)-ыг reuse** хийнэ
(шинэ provider үгүй). Контент нь одоо байгаа **Үгс банк** (`GET /words`).

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| POST `/speaking/check` | JWT | Дуудлага шалгах (multipart `file` аудио) → `{ correct, transcript, similarity }` | query `target=<үг>` · file |

`correct` = яг таарсан / зорилтот үг transcript дотор орсон / fuzzy ≥ 0.8.
Mobile: **`app/speaking.tsx`** (үг → 🔊 сонсох → 🎤 хэлэх → шалгах, 3 оролдлого),
`src/api/speaking.ts` (`checkPronunciation`). Home "Ярих" tile → `/speaking`.
⚠️ App PROD руу заадаг тул **prod-д deploy болтол** ажиллахгүй.

## 23. Learning Analytics — `/api/analytics` (2026-08-06)

Read-only статистик. **Шинэ хүснэгт байхгүй** — бүх метрикийг одоо байгаа
өгөгдлөөс (`xp_logs`, `sparks_logs`, `word_reviews`, `quiz_attempts`,
`buddy_sessions`, `ai_usages`, `messages`) aggregate хийж, `XpService` (streak/xp)
+ `StarsService` (од)-ыг reuse хийнэ. Судалгааны цаг (study time) нь `xp_logs`-ийн
timestamp-уудыг session болгон бүлэглэж (30 мин зайтай бол шинэ session) тооцоолно.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| GET `/analytics/overview` | JWT | Суралцагчийн бүрэн snapshot → `{ study{totalMinutes,todayMinutes,weekMinutes,monthMinutes}, lessons{completed,total,completionRate}, practice{sessions,completed}, vocabulary{learned,reviewed,mastered}, buddy{sessions,minutes,voiceMinutes,textMessages}, gamification{xp,sparksEarned,stars,currentStreak,longestStreak} }` | — |
| GET `/analytics/history` | JWT | Графикийн өдөр тутмын цуваа → `{ range, days:[{date,xp,studyMinutes}] }` (0-оор дүүргэсэн) | `range?=week\|month` (default `week`=7 хоног, `month`=30) |

`vocabulary.mastered` = `interval_days ≥ 21` (achievements/teacher progress-тэй ижил).
Admin dashboard энэ endpoint-уудыг дараа ашиглаж болно (одоогоор admin UI хийгээгүй).

---

## Frontend → Backend зураглал

### Mobile (`mobile/src/api/*.ts`)
Функц бүр `token`-ыг аргумент болгож авдаг.

| Файл | Функц → Endpoint |
| --- | --- |
| `auth.ts` | `getSocialProviders`→GET `/auth/social/providers` · `socialSignIn`→POST `/auth/social` · `socialComplete`→POST `/auth/social/complete` · `register`→POST `/auth/register` · `verifyOtp`→POST `/auth/verify-otp` · `resendOtp`→POST `/auth/resend-otp` · `login`→POST `/auth/login` · `forgotPassword`→POST `/auth/forgot-password` · `resetPassword`→POST `/auth/reset-password` · `getMe`→GET `/auth/me` |
| `users.ts` | `getStats`→GET `/users/me/stats` · `getMyPlan`→GET `/users/me/plan` · `updateProfile`→PATCH `/users/me` · `uploadAvatar`→POST `/users/me/avatar` |
| `gamification.ts` | `getGamification`→GET `/gamification` |
| **`analytics.ts`** 🆕 | `getAnalyticsOverview`→GET `/analytics/overview` · `getAnalyticsHistory`→GET `/analytics/history?range=`. Хэрэглэгч: **`src/components/AnalyticsSection.tsx`** (профайлын "Статистик" блок — метрик tile-ууд + 7/30 хоногийн идэвхийн график), **`app/(tabs)/profile.tsx`**-д суусан |
| **`achievements.ts`** 🆕 | `getAchievements`→GET `/achievements` · `markTrophiesSeen`→POST `/achievements/seen` · `setPinnedTrophies`→POST `/achievements/pinned`. Хэрэглэгч: **`app/trophies.tsx`** (100 цомын бүрэн дэлгэц, tier тус бүрээр, шүүлтүүр Бүгд/Авсан/Аваагүй, дэлгэрэнгүй sheet) · **`app/(tabs)/profile.tsx`** (**онцолсон** цомын хэвтээ мөр — онцлоогүй бол эзэмшсэн/түгжээтэй нь + `Бүгдийг харах` → `/trophies`) · **`src/lib/useCelebrations.ts`** (`unseen` трофей **+** `streakCelebration` → `AchievementModal` баяр хүргэл → `POST /seen` / `POST /gamification/streak-seen`; нэг дараалал — streak эхэлж, трофей дараа нь; host нь `src/components/CelebrationHost.tsx`, `app/_layout.tsx`-д суусан; дуусгах дэлгэцүүд (хичээл · сорил · унших · swipe · game) `checkCelebrations()` дуудна). Түгжээтэй цомын нөхцөлийг `src/lib/trophyCondition.ts` монголоор бичнэ |
| `lessons.ts` | `getLessons`→GET `/lessons?isPublished=true` · `getLesson`→GET `/lessons/:id` · `checkAccess`→GET `/lessons/:id/access` · `unlockLesson`→POST `/lessons/:id/unlock` · `completeLesson`→POST `/lessons/:id/complete` · **`getContinue`→GET `/lessons/continue`** (C1 ✅ Home hero — Choi, 2026-07-22) · **`getCompletedLessonIds`→GET `/lessons/completed`** (түвшний замын ✓ — 2026-08-04) |
| `quizzes.ts` | `getQuiz`→GET `/quizzes/:id` · `getQuizzes`→GET `/quizzes?isPublished=true[&lessonId=]` · `getExercises`→GET `/quizzes?standalone=true&isPublished=true&category=` · `submitQuiz`→POST `/quizzes/:id/submit` · **`checkAnswer`→POST `/quizzes/:id/check`** (C2 — Boju нэмнэ). **IELTS 3a ✅** (Choi, 2026-07-22): `getExercises`-ийг `category=ielts_listening\|ielts_reading`-аар дуудаж `/ielts` hub + `/skill/ielts_*` жагсаалт; runner нь `passageText`/`audioUrl`-ыг үзүүлж, `submit`-ийн `band`-ыг үр дүнд харуулна |
| `quiz.ts` (vocab) | `getQuiz`→GET `/words/quiz?count=` · `submitQuiz`→POST `/words/quiz/submit` |
| `reading.ts` | `getReadingList`→GET `/reading?limit=50` · `getReadingPassage`→GET `/reading/:id` · `completeReading`→POST `/reading/:id/complete` |
| `reviews.ts` | `getDue`→GET `/reviews/due` · `submitReview`→POST `/reviews/:wordId` · `getLearnQueue`→GET `/reviews/learn` · `toggleSave`→POST `/reviews/:wordId/save` · `getSaved`→GET `/reviews/saved` · `getReviewStats`→GET `/reviews/stats` |
| `words.ts` | `getWords`→GET `/words` · **`getSampleQuestions`→GET `/words/sample?count=`** (C4 ✅ бүртгэлийн өмнөх taste-task, token-гүй — Choi, 2026-07-22) |
| `dictionary.ts` | `searchWord`→GET `/dictionary/search/:word` (**`translation` = үгийн утга, 2026-08-05**) · `lookupWord`→GET `/dictionary/:word` · `translateSentence`→POST `/dictionary/translate` · `getWordAudio`→GET `/dictionary/:word/audio` · `getDictionarySaves`→GET `/dictionary/saves` · `toggleDictionarySave`→POST `/dictionary/saves/:word` |
| `idioms.ts` | `getIdiomList`→GET `/idioms?limit=100` · `getIdiom`→GET `/idioms/:id` |
| `leaderboard.ts` | `getLeaderboard`→GET `/leaderboard?period=&scope=` |
| `ai.ts` | `sendMessage`→POST `/ai/chat` · `getHistory`→GET `/ai/conversations/:id` · (AI Buddy voice) `getBuddies`→GET `/ai/buddies` · `startSession`→POST `/ai/buddy/sessions` · `sendBuddyTextTurn`→POST `/ai/buddy/sessions/:id/turn/text` · `sendBuddyAudioTurn`→POST `/ai/buddy/sessions/:id/turn/audio` · `getBuddyUsage`→GET `/ai/buddy/usage` · memory GET/DELETE `/ai/buddy/memory` (Boju хийнэ) |
| **`buddyRealtime.ts`** 🆕 | `getBuddyRealtimeCapabilities`→GET `/ai/buddy/rt/capabilities` · `sendBuddyTextTurnSmart`/`sendBuddyAudioTurnSmart` (streaming эсвэл **автомат fallback** → `ai.ts`-ийн хуучин turn) · `interruptBuddyTurn`→POST `/ai/buddy/rt/interrupt/:streamId`. `app/(tabs)/chat.tsx` турн илгээхдээ Smart хувилбарыг дууддаг; realtime flag (`src/lib/buddyRealtimeFlag.ts`) **OFF** тул одоо хуучин урсгалаар ажиллана |
| `classes.ts` | `getMyClasses`→GET `/classes` · `createClass`→POST `/classes` · `getClass`→GET `/classes/:id` · `getClassStudents`→GET `/classes/:id/students` · `requestJoinClass`→POST `/classes/join` · `getJoinRequests`→GET `/classes/:id/requests` · `approveRequest`→POST `/classes/:id/requests/:studentId/approve` · `rejectRequest`→DELETE `/classes/:id/requests/:studentId` |
| `assignments.ts` | `createAssignment`→POST `/assignments` · `getClassAssignments`→GET `/assignments?classId=` · `getMyAssignments`→GET `/assignments/mine` · `deleteAssignment`→DELETE `/assignments/:id` |
| `organizations.ts` | `getOrganizations`→GET `/organizations?limit=100` |
| `referrals.ts` | `getMyReferral`→GET `/referrals/me` |

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
- **Зөвхөн mobile:** `/auth/*`, `/users/me*`, `/gamification`, `/reviews/*`, `/dictionary/*` (гэхдээ `/dictionary/admin/*` нь
  admin-web), `/words/quiz*`, `/leaderboard` (query), `/lessons/:id/access|unlock|complete`, `/reading/:id/complete`, `/quizzes/:id/submit`, `/classes/join`, `/assignments/mine`.
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
