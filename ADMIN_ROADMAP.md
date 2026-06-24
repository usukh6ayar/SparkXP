# SparkXP — Admin Dashboard Roadmap

> **Web admin panel**-ийн төлөвлөгөө. Контент бичигч/ажилтан контент удирдах,
> хэрэглэгч хянах вэб. Роль/эрх: `ROLES.md` · Endpoint: `API.md` · Дүрэм: `CLAUDE.md`.
> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж буй · `[ ]` хийгээгүй

---

## 🏛️ Архитектур

```
Backend (NestJS API)
   ├── Mobile app  (оюутан, React Native — Усухбаяр)
   └── Admin web   (admin/super_admin, React — Бишрэлт)  ← /admin folder
```

- **Шинэ backend хийхгүй** — одоо байгаа API-г ашиглана (`API.md`).
- Admin вэб → `admin` role-оор нэвтэрч, JWT токеноор `@Roles(ADMIN)` endpoint рүү.
- Repo-д **`/admin`** folder (`/backend`, `/mobile`-ийн хажууд).
- `super_admin` нэмэлт эрхтэй (admin удирдах, систем тохиргоо).
- `moderator` = teacher-ийн дээр, admin-ийн доор (контент удирдах эрхтэй).

---

## 🧰 Технологийн сонголт

| Зүйл | Хэрэгжсэн | Тайлбар |
|---|---|---|
| Framework | **React + Vite + TypeScript** | Хурдан, хөнгөн |
| UI | **Tailwind CSS v3** + custom components | SparkXP брэндтэй |
| Auth | JWT → `admin_token` localStorage + in-memory | Backend-ийн `/auth/login` |
| Data | `fetch` wrapper (`api/client.ts`, Bearer token) | `API.md`-ийн endpoint-ууд |
| Upload | Multer (`@nestjs/platform-express`) | `/upload` endpoint |

---

## ✅ Хийгдсэн бүх ажил (2026-06)

---

### 🎯 Phase A0 — Foundation `[x]`

**Commit:** `141c398` Admin dashboard: Phase A0-A4

| Зүйл | Дэлгэрэнгүй |
|---|---|
| `/admin` scaffold | React + Vite 5 + TypeScript + Tailwind v3 |
| `api/client.ts` | `VITE_API_URL`, Bearer token, `ApiError`, `api.get/post/patch/delete` |
| Auth flow | Login → `POST /auth/login` → token → localStorage (`admin_token`) + in-memory (`memToken`) |
| Role guard | `RequireAdmin` — admin/super_admin/moderator биш бол `/login` redirect |
| Layout | `Sidebar.tsx` + `<Outlet />` + protected routes (`App.tsx`) |
| Reusable components | `Button`, `Input`, `Select`, `Badge`, `Table`, `Modal`, `PageHeader` |

---

### 🎯 Phase A1 — Контент удирдлага `[x]`

**Commit:** `141c398`, `0e944be`

| Хуудас | Боломж |
|---|---|
| **Words** (`/words`) | Жагсаалт + level шүүлт + нэмэх/засах/устгах modal |
| **Lessons** (`/lessons`) | CRUD + publish/unpublish toggle + priceSparks + FileUpload (зураг/видео) |
| **Quizzes** (`/quizzes`) | CRUD + questions JSON editor (template байна) |

**Засварууд (`0e944be`):**
- Paginated API: `data.items ?? []` хэлбэрт шилжсэн
- Auth token `in-memory memToken` — localStorage цэвэрлэгдсэн ч ажиллана
- Lesson form UX сайжруулсан

---

### 🎯 Phase A2 — Хэрэглэгч удирдлага `[x]`

**Commit:** `141c398`, `cbf474b`, `23d30d0`

| Боломж | Дэлгэрэнгүй |
|---|---|
| Users жагсаалт | нэр/имэйл/username/утасны дугаараар хайх |
| Оюутан/багш тоо | header дээр харуулна |
| Role өөрчлөх | super_admin-д dropdown, admin-д зөвхөн харах |
| Хэрэглэгч устгах | өөрийгөө устгахаас сэргийлсэн |
| **Username, phone** | AtSign болон Phone icon-тэй харуулна |
| **Trophies** 🏆 | Хэрэглэгч бүрийн цуглуулсан медалийг modal-д харуулна |

**Backend нэмэлт:**
- `User.username`, `User.phone`, `User.trophies` (jsonb) талбарууд
- Register DTO: `username`, `phone`, `role` (student/teacher) хүлээн авна
- `PATCH /users/:id` — role өөрчлөх (super_admin only)

---

### 🎯 Phase A3 — Монитор (Payments + Plans) `[x]`

**Commit:** `141c398`, `cbf474b`, `ab8bf5c`

| Боломж | Дэлгэрэнгүй |
|---|---|
| Payments жагсаалт | нийт орлого, гүйлгээний тоо, plan худалдаа, хүлээгдэж буй |
| **Plan нэмэх** | Modal: нэр, slug (auto), үнэ, хоног, онцлогууд, идэвхтэй |
| **Plan usage limits** | voice мин, STT мин, AI толь, token, memory (MB) — plan карт дээр харуулна |

**Plan limit default утга (cost doc-оос):**

| Plan | Voice | STT | Толь | Memory |
|---|---|---|---|---|
| Standard 34,000₮ | 25 мин | — | 300/сар | 100 MB |
| Plus 56,000₮ | 50 мин | 120 мин | 700/сар | 250 MB |
| Premier 85,000₮ | ∞ | ∞ | ∞ | ∞ |

**Backend нэмэлт:**
- `POST /payments/plans` endpoint (admin/super_admin)
- `Plan` entity: `voiceMinutesLimit`, `sttMinutesLimit`, `dictionaryAiLimit`, `aiTextTokensLimit`, `memoryMbLimit`
- `CreatePlanDto`: дээрх limit талбарууд нэмэгдсэн

---

### 🎯 Phase A4 — AI Buddy `[x]`

**Commit:** `5e00fe4`, `ab8bf5c`

| Боломж | Дэлгэрэнгүй |
|---|---|
| Buddy карт | emoji, нэр, гарчиг, тайлбар, usage progress bar |
| Хэрэглээний статистик | мессеж тоо, token, зардал (USD) |
| Үнийн мэдээлэл | нэмэлт pack үнэ, дуу/мин үнэ |
| Summary | нийт мессеж, нийт зардал, идэвхтэй buddy тоо |

**5 AI Buddy мэргэжил:**

| Slug | Нэр | Мэргэжил |
|---|---|---|
| `cop` | Цагдаа Болд 🚔 | Хуулийн/албан ёсны англи |
| `doctor` | Эмч Сарнай 🏥 | Эмнэлгийн англи |
| `lawyer` | Хуульч Мөнхбаяр ⚖️ | Хуулийн гэрээний англи |
| `engineer` | Программист Тэмүүжин 💻 | IT/техникийн англи |
| `business` | Бизнесмэн Оюунцэцэг 💼 | Корпорацийн англи |

**Backend нэмэлт:**
- `backend/src/ai-gateway/buddies.ts` — `BuddyDefinition` interface + 5 buddy
- `GET /ai/buddies` — public (systemPrompt-гүй)
- `GET /ai/buddy-stats` — admin/moderator (AiUsage-аас нэгтгэл)

---

### 🎯 Phase A5 — Leaderboard `[x]`

**Commit:** `5e00fe4`

| Боломж | Дэлгэрэнгүй |
|---|---|
| Scope tabs | 🌏 Улс / 🏔️ Аймаг / 🏙️ Дүүрэг |
| Period tabs | 7 хоног / Сар / Бүх цаг |
| Dropdown | Аймаг/Дүүрэг сонгох (scope-оос хамаарч) |
| Дүгнэлт | 🥇🥈🥉 медал + XP хэмжээ |

**Backend нэмэлт:**
- `GET /leaderboard/top?scope&period&value&limit` — admin/moderator
- `leaderboard.service.ts`: `getTopList()` — caller-ийн байршлаас хамааралгүй

---

### 🎯 Phase A6 — Ангиуд (Classes) `[x]`

**Commit:** `cbf474b`, `23d30d0`

| Боломж | Дэлгэрэнгүй |
|---|---|
| Ангиудын карт | нэр, багш, оюутны тоо, join code (copy товч) |
| Оюутны жагсаалт | modal: fullName, @username, phone, XP, trophy тоо |

**Backend нэмэлт:**
- `GET /classes/all` — admin/moderator
- `ClassEntity`, join code логик

---

### 🎯 Phase A7 — File Upload `[x]`

**Commit:** `cbf474b`

| Боломж | Дэлгэрэнгүй |
|---|---|
| `FileUpload` component | drag-drop + click, preview, × цэвэрлэх |
| Зураг | max 10 MB, `image/*` |
| Видео | max 200 MB, `video/*` |
| Хичээлд оруулах | Lessons form-д imageUrl + videoUrl талбарууд |

**Backend нэмэлт:**
- `POST /upload` — Multer, `backend/uploads/<uuid>.ext` хадгална
- `GET /uploads/:filename` — static assets served
- `NestExpressApplication` + `useStaticAssets()`
- `upload.module.ts`, `upload.controller.ts`

---

### 🎯 Phase A8 — Үгийн сан (Vocabulary Bank) `[x]`

**Commit:** `23d30d0`, `2e9fa1b`, `d475f5f`

| Боломж | Дэлгэрэнгүй |
|---|---|
| Words table | `exampleSentence` + `exampleTranslation` харуулна |
| **Төхөөрөмжөөс оруулах** | CSV (.csv) болон JSON (.json) хоёуланг дэмжинэ |
| CSV загвар | "Загвар татах" → `words_template.csv` (Excel-д нээж засна) |
| Import үр дүн | оруулсан тоо + давхардал алгасагдсан тоо |

**500 үгийн сан:**
- `backend/src/scripts/words-seed.json` — A1–C2 бүх түвшин
- Монгол орчуулга + жишээ өгүүлбэр + жишээний орчуулга
- `npm run import-words` — database руу оруулах скрипт
- `npm run seed` — аяндаа оруулна

**Backend нэмэлт:**
- `POST /words/bulk` — max 50,000 үг нэг дор (admin/moderator)
- `Word.exampleTranslation` талбар нэмэгдсэн
- `@Max(100)` → `@Max(1000)` (QueryWordsDto)

---

### 🎯 Phase A9 — Moderator роль `[x]`

**Commit:** `cbf474b`

| Зүйл | Дэлгэрэнгүй |
|---|---|
| `UserRole.MODERATOR` | teacher-ийн дээр, admin-ийн доор |
| Эрх | контент CRUD, file upload, words/lessons/quizzes удирдах |
| Хязгаарлалт | super_admin л role өөрчилж чадна |

**Backend нэмэлт:**
- `MODERATOR = "moderator"` → `UserRole` enum
- Controller-уудад `@Roles(ADMIN, SUPER_ADMIN, MODERATOR)` нэмэгдсэн

---

### 🎯 Phase A10 — Хэрэглэгчийн Usage Tracking `[x]`

**Commit:** `ab8bf5c`

`User` entity-д нэмэгдсэн tracking талбарууд (сарын дараа reset хийнэ):

| Талбар | Утга |
|---|---|
| `voiceSecondsUsed` | AI TTS дуу секундэд |
| `sttSecondsUsed` | STT хэрэглэгчийн яриа секундэд |
| `dictionaryAiCount` | Gemini AI тайлбарын тоо |
| `aiInputTokens` | AI chat input токен |
| `aiOutputTokens` | AI chat output токен |
| `memoryStorageMb` | AI buddy memory MB |
| `usageResetAt` | Сүүлийн reset огноо |

---

### 🎯 Phase A11 — Брэнд шинэчлэл `[x]`

**Commit:** `d475f5f`

| Өөрчлөлт | Файл |
|---|---|
| Browser tab: **SparkXP Admin** | `admin/index.html` |
| Sidebar: **Leaderboard** (Өрсөлдөөн-ийн оронд) | `Sidebar.tsx` |

---

### 🎯 Phase A12 — Байгууллагууд (Organizations) `[x]`

**Commit:** `3669fe6`

| Боломж | Дэлгэрэнгүй |
|---|---|
| `/organizations` хуудас | Бүх байгууллагын жагсаалт (хүснэгт) |
| Байгууллага нэмэх/засах | Modal: нэр, төрөл (chip + free-text), аймаг, дүүрэг |
| Байгууллага устгах | confirm dialog |
| Төрлийн шүүлт | Сургууль / Компани / Хуулийн фирм dropdown |
| Аймаг dropdown | 21 аймаг + Улаанбаатар (Монгол бүх аймаг) |
| Дүүрэг dropdown | Улаанбаатар сонгосон үед 9 дүүрэг харагдана |
| Sidebar | 🏢 **Байгууллага** nav item нэмэгдсэн |

**Backend:** `GET/POST/PATCH/DELETE /organizations` endpoint-ууд раньш байсан, admin холбосон.

---

### 🎯 Phase A13 — Хэрэглэгчийн Хэрэглээ (Usage Monitor) `[x]`

**Commit:** `3669fe6`

| Боломж | Дэлгэрэнгүй |
|---|---|
| `/usage` хуудас | Хэрэглэгч бүрийн сарын AI хэрэглэх хүснэгт |
| Summary карт | Нийт хэрэглэгч / AI хэрэглэсэн / Нийт voice мин / Нийт токен |
| Хүснэгтийн багана | 🎙 Voice мин · 🎧 STT мин · 📖 Толь · 🤖 Токен · 🧠 Memory |
| Идэвхтэй мэдээлэл | 0 биш утга primary өнгөөр харуулна |
| Pagination | 50-аар хуваана, өмнөх/дараах товч |
| Sidebar | 📊 **Хэрэглээ** nav item нэмэгдсэн |

---

### 🎯 Phase A14 — Даалгавар удирдлага (Assignments) `[x]`

**Commit:** `3669fe6`

Ангиудын (`/classes`) class detail modal-д **Даалгаварууд** tab нэмэгдсэн:

| Боломж | Дэлгэрэнгүй |
|---|---|
| Сурагчид / Даалгаварууд tab | Modal дотор хоёр tab солигддог |
| Даалгавар жагсаалт | төрөл (📚 Хичээл / ❓ Сорил), targetId, дуусах огноо |
| Даалгавар нэмэх | Хичээл/Сорил сонгох dropdown, datetime-local due date |
| Даалгавар устгах | confirm + `DELETE /assignments/:id` |
| **Анги нэмэх** | PageHeader-т "Анги нэмэх" товч + modal нэмэгдсэн |

**Backend:** `GET/POST/DELETE /assignments` endpoint-ууд раньш байсан.

---

### 🎯 Phase A15 — Visual Quiz Builder `[x]`

**Commit:** `1257ddc`, `7a0eff3`

JSON textarea-г **Google Forms шиг visual form builder**-аар солисон:

| Боломж | Дэлгэрэнгүй |
|---|---|
| **Тоглоомын төрөл** | Mobile `soril.tsx`-тай тохирох 6 category |
| **MCEditor** | Асуулт + 4 сонголт + радио товч (зөв хариулт) + оноо |
| **FBEditor** | Өгүүлбэр (`___` зай) + хариулт input + оноо |
| **WMEditor** | Англи↔Монгол хос (мөр нэмэх/устгах) + оноо |
| Асуулт удирдлага | Нэмэх / Устгах / Scroll |
| Category автомат | Холбох→word_match, Дүүргэх→fill_blank, бусад→multiple_choice |
| Table badge | Quiz category badge (өнгөт) |
| Validation | Хоосон талбар, хоосон сонголт шалгана |

**6 тоглоомын category (mobile soril.tsx GAMES-тэй яг таарна):**

| Value | Нэр | Question формат |
|---|---|---|
| `word_guess` | 👁 Үг таах | multiple_choice |
| `listening` | 🎧 Сонсох | multiple_choice |
| `grammar` | 📖 Дүрэм | multiple_choice |
| `speed` | ⏱ Хурдан хариулт | multiple_choice |
| `matching` | 🔗 Холбох | word_match |
| `fill` | ✏️ Дүүргэх | fill_blank |

**Backend нэмэлт:**
- `Quiz` entity: `quiz_type` varchar column нэмэгдсэн
- `CreateQuizDto`: `WordMatchQuestionDto`, `WordMatchPairDto`, `quizType` field, `word_match` discriminator
- `QuizzesService`: `word_match` validate + score логик

---

### 🎯 Phase A16 — UI Polish `[x]`

**Commit:** `f74c4b4`

| Өөрчлөлт | Дэлгэрэнгүй |
|---|---|
| Sidebar "Сорил" → **"Quiz"** | Quizzes nav label |
| Users: **"Тrofhy" → "Trophy"** | Хүснэгтийн баганын гарчгийн алдаа засагдсан |
| AI Buddy: нэр нуусан | Карт дээр хувийн нэр (Болд, Сарнай) харагдахгүй — зөвхөн emoji + мэргэжил |
| AI Buddy: "нэмэх" товч | "AI Buddy нэмэх" товч + "+" placeholder карт. Дарахад `buddies.ts` тайлбар гарна |
| Lessons: медиа thumbnail | Хичээлийн хүснэгтэд зураг thumbnail — дарахад image/video бүрэн preview modal |
| Lessons: "Засах" shortcut | Preview modal-аас шууд edit нээх |

---

### 🎯 Phase A17 — Cloud Deployment Тохиргоо `[x]`

**Commit:** `bbec54c`

| Өөрчлөлт | Файл |
|---|---|
| PostgreSQL SSL (`DB_SSL=true`) | `backend/src/config/typeorm.config.ts` |
| Upstash Redis (`REDIS_URL`) | `backend/src/redis/redis.module.ts` |
| `.env.example` шинэчлэгдсэн | `DB_SSL`, `REDIS_URL` comment-тэй |

**Deployment зааврын дараалал:**
1. Neon (PostgreSQL) → connection string → `DB_SSL=true`
2. Upstash (Redis) → `REDIS_URL=rediss://...`
3. Railway (Backend) → environment variables тохируулна
4. Vercel (Admin) → `VITE_API_URL=https://your-railway-app.railway.app/api`

---

## 📁 Одоогийн бүтэц

```
admin/
  index.html                       title: SparkXP Admin
  src/
    api/client.ts                  fetch wrapper (Bearer token, ApiError)
    auth/
      AuthContext.tsx              login, logout, token (localStorage + memToken)
      RequireAdmin.tsx             role guard
    components/
      Sidebar.tsx                  navigation (11 item)
      Button / Input / Select / Badge / Table / Modal / PageHeader
      FileUpload.tsx               drag-drop image/video upload
    pages/
      login/LoginPage.tsx
      words/WordsPage.tsx          CRUD + CSV/JSON import
      lessons/LessonsPage.tsx      CRUD + media upload + thumbnail preview
      quizzes/QuizzesPage.tsx      Visual builder (MC/FB/WM) + 6 game categories
      users/UsersPage.tsx          list + search + role + trophy viewer
      classes/ClassesPage.tsx      карт + student roster + assignments tab + create
      organizations/OrganizationsPage.tsx  CRUD + аймаг/дүүрэг
      leaderboard/LeaderboardPage.tsx      scope + period tabs
      buddy/AiBuddyPage.tsx        5 buddy stats (нэр нуусан) + add button
      usage/UsagePage.tsx          per-user AI usage stats
      monitor/MonitorPage.tsx      payments + plan CRUD + usage limits
      settings/SettingsPage.tsx    AI limits
  .env.example                     VITE_API_URL=http://localhost:3000/api
```

---

## 🔐 Эрх матриц

| Үйлдэл | moderator | admin | super_admin |
|---|:---:|:---:|:---:|
| Контент CRUD (үг/хичээл/сорил) | ✅ | ✅ | ✅ |
| File upload (зураг/видео) | ✅ | ✅ | ✅ |
| Words bulk import | ✅ | ✅ | ✅ |
| Хэрэглэгч харах | ✅ | ✅ | ✅ |
| Хэрэглэгч устгах | ❌ | ✅ | ✅ |
| Role өөрчлөх | ❌ | ❌ | ✅ |
| Монитор (AI, Payments) | ✅ | ✅ | ✅ |
| Plan нэмэх | ❌ | ✅ | ✅ |
| Leaderboard харах | ✅ | ✅ | ✅ |

---

## 🔧 Backend нэмэлтүүд (Bishrelt хийсэн)

| Endpoint / Өөрчлөлт | Файл |
|---|---|
| `POST /upload` (image/video) | `upload.controller.ts` |
| `POST /payments/plans` | `payments.controller.ts` |
| `GET /payments/plans` | `payments.controller.ts` |
| `GET /classes/all` | `classes.controller.ts` |
| `GET /leaderboard/top` | `leaderboard.controller.ts` |
| `GET /ai/buddies` (public) | `ai-gateway.controller.ts` |
| `GET /ai/buddy-stats` | `ai-gateway.controller.ts` |
| `POST /words/bulk` | `words.controller.ts` |
| `PATCH /users/:id` (role) | `users.controller.ts` |
| `UserRole.MODERATOR` | `common/enums/index.ts` |
| `User`: username, phone, trophies, usage fields | `user.entity.ts` |
| `Word`: exampleTranslation | `word.entity.ts` |
| `Plan`: 5 usage limit columns | `plan.entity.ts` |
| `AI_BUDDIES` (5 мэргэжил) | `ai-gateway/buddies.ts` |
| `QueryWordsDto @Max(1000)` | `words/dto/query-words.dto.ts` |

---

---

### 🎯 Phase A18 — Үгийн сан review queue + Даалгаварын completion `[x]`

**Commit:** `c17afc7`, `2d9fb2e`, `230c1ce`

#### Words — review queue, bulk actions, import v2

| Боломж | Дэлгэрэнгүй |
|---|---|
| **Stats grid** | Нийт / Нийтэлсэн / Хянах / Зураггүй / Аудиогүй / Давхардал (6 карт) |
| **Analytics panel** | 😵 Хамгийн их мартсан · ⭐ Хадгалсан · ✅ Мэдсэн · 🔥 Хамгийн хүнд + дундаж хадгалалт% |
| **Status filter tabs** | Бүгд / ⏳Хянах / ✅Батлагдсан / 🌐Нийтлэгдсэн / ❌Буцаагдсан / 📝Ноорог |
| **Bulk select** | checkbox-ийн header + мөр бүрт → "N сонгосон" action bar |
| **Bulk actions** | Нийтлэх / Зөвшөөрөх / Татгалзах / Устгах — `PATCH /words/bulk` |
| **Inline publish** | Төлөвийн badge-ийн хажууд шууд "Нийтлэх" link |
| **AI bulk import** | Англи үгсийн жагсаалт → AI бүх талбарыг бөглөнө (`POST /words/ai-bulk`) |
| **Import v2** | Multipart CSV upload → validation report (нэмэгдсэн/алгасагдсан/алдаа/давхардал) |
| **Error CSV download** | Алдааны мөрүүдийг `import_errors.csv`-ээр татна |
| **sparkTip талбар** | Тогтооход туслах мнемоник (`sparkTip`) — form болон AI fill-д |
| **ImageCropUpload** | Зураг crop хийж оруулах component (`ImageCropUpload`) |
| **FileUpload** | Дуудлагын аудио upload (optional) |
| **Хайлт** | Англи/монголоор real-time хайлт |

**Backend нэмэлтүүд:**
- `GET /words/stats` — статусаар тоо + зураг/аудиогүй тоо + давхардал
- `GET /words/analytics` — WordReview дататай сурлагын аналитик
- `POST /words/ai-bulk` — Англи үгсийн жагсаалт → AI bulk fill (3 concurrent)
- `POST /words/import` — multipart CSV, дэлгэрэнгүй validation report
- `PATCH /words/bulk` — олон үгийн статус/ангилал/түвшин нэгт шинэчлэх
- `AiBulkReport`, `WordStats`, `WordStat`, `WordAnalytics`, `ImportReport` interface-ууд нэмэгдсэн

#### Classes — assignment completion tracking

| Боломж | Дэлгэрэнгүй |
|---|---|
| **Completion X/N** | Даалгаварын жагсаалтад хэн дуусгасан тоо харуулна |
| **POST /assignments/:id/complete** | Сурагч даалгавар дуусгасан тэмдэглэх (idempotent) |

**Backend нэмэлтүүд:**
- `AssignmentCompletion` entity (`assignment_completions` хүснэгт, unique per student+assignment)
- `AssignmentsService.complete()` — idempotent mark-done
- `AssignmentsService.findForClass()` → `completedCount` багтаасан (нэг batch query)

#### Notifications, Quiz publish, Cost dashboard (аль хэдийн байсан)

| Боломж | Хуудас |
|---|---|
| **Push notification** | `/notifications` — гарчиг, текст, role-оор илгээх + түүх |
| **Quiz isPublished toggle** | `/quizzes` — Eye/EyeOff товч |
| **Cost dashboard** | `/monitor` — plan-аар нэгтгэсэн сарын API зардлын тооцоо |

---

## 📌 Дараагийн алхам `[ ]`

### Backend (хийгдэх ёстой)
- [ ] Usage metering — voice/STT/dictionary/token хязгаарыг backend дээр бодитоор шалгах
- [ ] Monthly usage reset — сар бүр `voiceSecondsUsed` г.м. reset хийх (cron job)
- [ ] QPay integration — `createIntent()` дахь stub URL-г бодит QPay API-аар солих
- [ ] AI Dictionary endpoint — `GET /dictionary/:word` (DB cache → Gemini fallback)

### Admin dashboard (хийгдэх ёстой)
- [x] **Cost dashboard** — plan-аар нэгтгэсэн сарын API зардлын тооцоо ✅
- [x] **Push notification** — admin-аас бүх хэрэглэгчид мэдэгдэл явуулах ✅
- [x] **Quiz isPublished toggle** — хэрэглэгчдэд харагдах/нуух товч ✅
- [x] **Words review queue** — status filter tabs, bulk approve/publish/reject ✅
- [x] **Assignment completion tracking** — X/N badge, POST /assignments/:id/complete ✅

---

## 🌿 Git workflow

- Бишрэлт → `bishrelt` branch → PR → review → `main`
- `admin/.env` commit хийхгүй — `.env.example` ашиглана
- Ажил эхлэхэд: `git checkout main && git pull origin main && git checkout bishrelt && git merge main`
