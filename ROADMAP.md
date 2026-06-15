# EnglishXP — Хөгжүүлэлтийн төлөвлөгөө (Roadmap)

Энэ файл нь backend-ийн дараагийн ажлуудыг дарааллаар нь жагсаасан төлөвлөгөө.
CLAUDE.md-ийн build phase-уудтай нийцнэ. Зарчим: **MVP эхэнд, дараа нь scale.**
Over-engineering хийхгүй.

> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж байгаа · `[ ]` хийгээгүй

---

## 👥 Багийн ажлын урсгал (хэн · аль branch · хэзээ merge)

Бид 2 dev. Хүн бүр **өөрийн branch**-тай ажиллана:

| Dev          | Branch       | Хариуцах сэдэв                                                   |
| ------------ | ------------ | ---------------------------------------------------------------- |
| **Усухбаяр** | `usukhbayar` | Контент (Words/Lessons) · Vocabulary/SRS (#4) · Leaderboard (#8) |
| **Бишрэлт**  | `bishrelt`   | Quizzes · XP service (#5) · Sparks store (#9) · AI Gateway (#6)  |

`main` = үргэлж тогтвортой. **`main` руу шууд push хийхгүй** — зөвхөн PR-аар.

### Ажлын мөчлөг (хүн бүр дагана)

1. **Эхлэхийн өмнө** main-аас шинэчилнэ:
   ```bash
   git checkout main && git pull origin main
   git checkout <өөрийн-branch>
   git merge main          # main дээрх нөгөөгийн merge хийсэн шинэ ажлыг авна
   ```
2. Өөрийн branch дээр ажиллаж, commit хийнэ.
3. **Дуусаад, тест хийсний дараа** push:
   ```bash
   git push origin <өөрийн-branch>
   ```
4. GitHub дээр **Pull Request** үүсгэнэ: `<өөрийн-branch>` → `main`.
5. **Нөгөө dev** review хийж approve хийнэ.
6. GitHub дээр **"Merge pull request"** дарж `main` руу нэгтгэнэ.
7. Хоёулаа `git checkout main && git pull origin main` хийж шинэчилнэ.

### Чухал дүрэм

- **Нэг модуль дуусах бүрт PR → merge хий.** Бүх ажлаа нэг дор хураалгүй,
  branch-аа `main`-тай ойр байлга (хол явах тусам conflict ихэснэ).
- Өөр өөр модуль = өөр өөр файл → conflict бараг гарахгүй.
- `app.module.ts`-д хоёулаа module бүртгэнэ. Энд бага conflict гарвал хоёр
  import-ийг **хоёуланг нь** үлдээгээд шийднэ.
- `.env` хэзээ ч commit хийхгүй. Шинэ тохиргооны key нэмбэл `.env.example`-д бич.

---

## ✅ Хийгдсэн — Суурь (Foundation) + Auth

- [x] NestJS + TypeScript төсөл, PostgreSQL (TypeORM) + Redis
- [x] 14 entity бүгд (UUID PK, `created_at`/`updated_at`, jsonb)
- [x] **Auth module** — register, login, JWT `/me`, role guard (`main`-д merged)
- [x] Leaderboard / Sparks store-ийн **schema** (entity, enum, багана)
- [x] `.env` тохиргоо, README, CLAUDE.md, ROADMAP

---

## 🎯 Phase 1 — MVP (Student app backend)

Зорилго: оюутан бүртгүүлж нэвтрэх, үг/дүрэм/сонсгол сурах, quiz өгөх,
XP цуглуулах, текст AI buddy-тэй ярих. Энгийн admin.

### 1. Auth module `[x]`

- [x] `POST /api/auth/register` — имэйл, нууц үг, нэр (bcrypt hash)
- [x] `POST /api/auth/login` — JWT access token буцаах
- [x] JWT strategy + `@UseGuards(JwtAuthGuard)` + `@CurrentUser()` decorator
- [x] `GET /api/auth/me` — одоогийн хэрэглэгчийн мэдээлэл
- [x] Role-based guard — `@Roles(UserRole.ADMIN)` + `RolesGuard`
- **DoD:** ✅ Шинэ хэрэглэгч бүртгүүлж, нэвтэрч, токеноор хамгаалагдсан
  endpoint руу хандаж чадна. Role-оор хамгаалалт ажиллаж байна (student→403,
  admin→200). (E2E тестээр баталгаажсан)

### 2. Users module `[x]` — 👤 Бишрэлт ✅

- [x] CRUD (admin-д зориулсан) — `GET /api/users`, `DELETE /api/users/:id`
- [x] Профайл засах (`PATCH /api/users/me`)
- [x] XP/Sparks тэнцэл унших (`GET /api/users/me/stats`)

### 3. Content modules — DB-д суурилсан `[x]`

> Бүх контент DB-д. Hardcode хийхгүй. Admin нэмж чадна.
> **Хуваарь:** Words/Lessons = 👤 Өсөхбаяр · Quizzes = 👤 Бишрэлт (өөр файл тул зэрэг хийж болно)

- [x] **Words module** — CRUD, level/lesson-оор шүүх — 👤 Усухбаяр ✅
- [x] **Lessons module** — CRUD, type/level/publish, jsonb content — 👤 Усухбаяр ✅
- [x] **Quizzes module** — CRUD, `questions` jsonb-ийг service-д validate — 👤 Бишрэлт ✅
- **DoD:** Admin үг/хичээл нэмж, оюутан API-аар авч чадна (admin-only бичих, E2E тест).

### 4. Vocabulary / Spaced Repetition `[x]` — 👤 Усухбаяр ✅

- [x] `GET /api/reviews/due` — өнөөдөр давтах ёстой үгс (WordReview)
- [x] `POST /api/reviews/:wordId` — хариу илгээх (quality 0-5)
- [x] SM-2 алгоритм service-д (easeFactor, interval, nextReviewAt шинэчлэх)
- **DoD:** ✅ Оюутан үг давтахад дараагийн давталтын огноо зөв тооцогдоно
  (1→6→16 өдөр, буруу хариунд reset). E2E тестээр баталгаажсан.

### 5. Quiz submission + XP `[x]` — 👤 Бишрэлт ✅

- [x] `POST /api/quizzes/:id/submit` — хариу шалгах, оноо тооцох
- [x] **XP service** — зөв хариунаас XP олгох, `XpLog`-д бичих,
      `User.xp` cache-г шинэчлэх
- [x] Anti-abuse: зөвхөн жинхэнэ зөв харилцаанаас XP (CLAUDE.md)
- **DoD:** Quiz өгөхөд XP нэмэгдэж, XpLog-д мөр үүснэ.

### 6. AI Gateway module `[x]` ⚠️ ЧУХАЛ — 👤 Бишрэлт ✅

> Бүх AI дуудлага ЗААВАЛ энэ нэг module-ээр дамжина. Feature-ээс шууд AI API
> дуудахгүй (CLAUDE.md).

- [x] `AiGatewayService.chat()` — текст AI buddy (Claude Haiku)
- [x] Per-user хязгаар шалгах (Redis-ийн `ai:limits:default`-аас)
- [x] Дуудлага бүрийг `AiUsage`-д logging (token, cost тооцох)
- [x] Plan limit-ийг Redis-аар тохируулдаг болгох — `PATCH /api/ai/limits` (app update-гүйгээр)
- [x] `Message` entity-д харилцааны түүх хадгалах
- **DoD:** Оюутан AI buddy-тэй ярихад хариу авч, AiUsage-д бүртгэгдэж,
  хязгаар хэтрэхэд блоклогдоно.

### 7. Basic Admin `[x]` — 👤 Бишрэлт ✅

- [x] Контент CRUD-ийг admin role-оор хамгаалах (Quizzes, Lessons, Words — admin guard)
- [x] Seed script — `npm run seed` (admin user, words, lessons, quizzes) — `src/scripts/seed.ts`

### 8. Leaderboard module `[x]` — 👤 Усухбаяр ✅

> Рейтинг = **XP** (Spark-аар БИШ). XP-г устгаж reset хийхгүй — period нь зүгээр
> `XpLog.created_at` дээрх хугацааны цонх.
> ⚠️ Энэ нь #5 (XP service, Бишрэлт)-ийн дараа жинхэнэ дата авна — query-г seed
> дататай урьдчилж барьж болно.

- [x] Schema: `User.province/district/country`, `Organization.province/district`
- [x] Enum: `LeaderboardPeriod` (weekly/monthly/all_time), `LeaderboardScope`
- [x] `GET /api/leaderboard?period=weekly&scope=province` — топ N + миний байр
- [x] Postgres query: `XpLog`-г хугацаа+scope-оор SUM, эрэмбэлэх
- [x] Scope-ууд: global, province, district, class, organization
- [ ] (Дараа нь) Redis ZSET-ээр хурдасгах — scale хэрэгтэй болоход
- **DoD:** ✅ Оюутан өөрийн дүүрэг/аймаг/global-аар, долоо хоног/сар/бүх цагаар
  рейтингээ харна. E2E тестээр баталгаажсан (XpLog seed дататай).
  > Тэмдэглэл: жинхэнэ XP нь #5 (XP service, Бишрэлт) бэлэн болоход орж ирнэ.

### 9. Sparks store — хичээл худалдах `[x]` — 👤 Бишрэлт ✅

> Spark = зарцуулагддаг валют. Хичээл Spark-аар нээж болно.

- [x] Schema: `Lesson.priceSparks`, `SparksLog` (ledger), `LessonUnlock`
- [x] Enum: `SparksSource` (олох/зарах эх сурвалж)
- [x] **Sparks service** — Spark олгох/хасах, `SparksLog`-д бичих,
      `User.sparks` cache шинэчлэх (XP service-ийн ихэр)
- [x] `POST /api/lessons/:id/unlock` — Spark хасч `LessonUnlock` үүсгэх
      (нэг транзакц, balance шалгах, давхар худалдан авалтаас сэргийлэх)
- [x] Хичээл авах эрхийг шалгах — `GET /api/lessons/:id/access`
- [ ] **Spark-г мөнгөөр цэнэглэх** — `Payment` амжилттай → `SparksLog` (+,
      source=`PURCHASE`). Payment module-той хамт (Phase 2).
- **DoD:** Оюутан хангалттай Spark-тай бол хичээл нээж, дараа нь үргэлж
  хандана. Spark дутвал блоклогдоно. Spark-г мөнгөөр худалдаж авч болно.

### 10. Чанар, найдвартай байдал `[x]` — 👤 Бишрэлт ✅

- [x] Global exception filter + стандарт алдааны формат (`src/common/filters/http-exception.filter.ts`)
- [x] Request validation (DTO + class-validator) бүх endpoint дээр (`ValidationPipe` global)
- [x] `GET /api/health` — health check (DB + Redis ping)
- [ ] Production-д `DB_SYNCHRONIZE=false` + migration ашиглах (Phase 2-д шилжих үед)
- [x] Гол flow-уудад e2e test (auth, XP/quiz submit, Sparks unlock, health) — `test/app.e2e-spec.ts`

---

## 📋 Phase 2 — Teacher dashboard, Organizations, Payments `[x]` — 👤 Бишрэлт ✅

- [x] **Organizations module** — school/company/law_firm (type нь нээлттэй string)
      `POST/GET/PATCH/DELETE /api/organizations` (admin-only write)
- [x] **Classes module** — багш класс үүсгэх, `join_code` автомат үүснэ
      `POST/GET/PATCH/DELETE /api/classes` (teacher/admin)
- [x] Оюутан `join_code`-оор класст элсэх — `POST /api/classes/join`
- [x] Оюутан класс орхих — `DELETE /api/classes/:id/leave`
- [x] **Assignments** — багш класст хичээл/quiz оноох, due date
      `POST/GET/DELETE /api/assignments`, `GET /api/assignments/my` (оюутан)
- [x] Багшийн dashboard API — `GET /api/classes/:id/progress`
      (оюутан бүрийн xpWeek/xpMonth/xpTotal/sparks)
- [x] **Payments module** — QPay stub (амьд API-г тохиргоо хийхэд орлоно)
      `POST /api/payments` (intent үүсгэх), `POST /api/payments/:id/confirm` (Sparks цэнэглэх),
      `GET /api/payments/my`, `GET /api/payments` (admin)
- [ ] Org-level plan / суудлын тоо удирдах (Phase 3-т шилжүүлсэн)
- [ ] QPay live API холбох (`.env` QPAY_* keys нэмэхэд бэлэн)

---

## 🚀 Phase 3 — Voice AI, Premium, Sparks store

- [ ] Voice AI: STT/TTS — AI Gateway-аар дамжуулж (одоо UI "coming soon")
- [ ] Voice минут хязгаарыг plan-аас тохируулах
- [ ] **Sparks store-ийг өргөтгөх** — хичээлээс гадна бусад зүйл (avatar, hint,
      streak freeze г.м). Үндсэн механик нь Phase 1 #9-д бэлэн.
- [ ] Sparks олгох/зарцуулах rate-ийг admin-аас тохируулах
- [ ] Premium subscription tiers

---

## 📑 Doc-aligned backlog — Product Brief-ээс (coordinate)

> Hustle Hive docx-ийн дагуу (`PRODUCT_BRIEF.md`) backend-д нэмэх ёстой зүйлс.
> Эдгээр нь mobile (teacher + student) болон admin-д хамаатай тул **PR-ийн өмнө
> хоёр dev тохиролцоно**. Ихэнх нь Phase 1.5 / Phase 3.

**Teacher dashboard гүнзгийрүүлэлт** (mobile M5 🟡)
- [ ] Assignment **completion tracking** — оноосон lesson/quiz-ийг хэн дуусгасан
      (X/N), статус. (Assignment-д completion data, эсвэл шинэ progress query.)
- [ ] Класс доторх **per-student quiz оноо** aggregate.
- [ ] **Weak topics** — оюутны сул скилл/категори (quiz/SRS дататай тооцох).
- [x] `GET /api/classes/:id/progress` (xpWeek/Month/Total+sparks) — бэлэн.

**User профайл / plan** (mobile M6)
- [ ] `User.level` (placement түвшин) + `User.plan` талбар.
- [ ] Plan caps-ийг admin/DB-ээс тохируулах (app update-гүй) — Free/Standard/Premium.

**AI usage metering + cap enforcement** (PRODUCT_BRIEF §5)
- [ ] `AiUsage`-д: `voice_seconds`, `stt_seconds`, `dictionary_ai_count`,
      `dictionary_cache_hit`, `ai_input/output_tokens`, `memory_storage_mb`,
      `memory_retrieval_count`. Real-time per-user meter.
- [ ] Voice cap (Standard 25 / Premium 50 мин) — 80%/95% warning, cap-д voice зогсоод text үргэлжлэх.
- [ ] STT cap (75 / 100–120 мин) + VAD.

**AI Dictionary module** (Gemini 2.5 Flash-Lite)
- [ ] DB/cache-first lookup; Gemini зөвхөн шинэ үг/гүн тайлбар. 4-section, `max_output_tokens≈450–500`, grounding OFF, cache.

**Voice AI** (Phase 3, AI Gateway-аар)
- [ ] TTS (ElevenLabs Flash/Turbo) + STT (Scribe) — fallback: API унавал text mode.

**Gamification tracking** (mobile Home/Profile placeholder-ийг live болгох)
- [ ] Streak, daily-XP goal, lesson completion, badge — endpoint + `User`/log талбарууд.

---

## 🔁 Тогтмол баримтлах зарчмууд (CLAUDE.md-ээс)

- Бүх контент **DB-д**, hardcode хийхгүй
- Бүх AI дуудлага **AI Gateway**-ээр
- Plan limit-үүд **DB/admin-аас** тохируулагддаг (app update-гүй)
- UUID primary key, jsonb flexible контент, `created_at`/`updated_at`
- TypeScript everywhere, жижиг функц, тодорхой нэр, junior уншиж ойлгохоор
- Хоёр хэл: Монгол primary, Англи secondary

---

## 📌 Дараагийн алхам

✅ **Phase 1 бүрэн дууссан.**
✅ **Phase 2 бүрэн дууссан — `bishrelt` branch-д бэлэн.**

Бишрэлт хийсэн: #2 Users · #3 Quizzes · #5 XP · #6 AI Gateway · #7 Seed · #9 Sparks · #10 Quality · Phase 2 (Orgs/Classes/Assignments/Payments)
Усухбаяр хийсэн: #3 Words/Lessons · #4 SRS · #8 Leaderboard

**Дараагийн алхам:**
1. `bishrelt` + `usukhbayar` branch PR → `main` merge.
2. Phase 3 (Voice AI, Premium, Sparks store өргөтгөл) эхлэх.
3. QPay live API нэгтгэх — `.env.example`-д `QPAY_*` keys нэмнэ.

---

## 🔄 Mobile redesign-аас үүдсэн shared backend өөрчлөлт (2026-06-12)

> Усухбаярын mobile redesign-ийн явцад `/backend`-д орсон жижиг өөрчлөлтүүд
> (хоёр dev-д хамаатай — `git pull` хийхэд ирнэ):

- **`LessonType` enum** (`common/enums`) — `reading`, `writing`, `fill` нэмсэн
  (mobile 4 скилл: Сонсгол/Унших/Нөхөх/Бичих). `API.md` шинэчилсэн.
- **`scripts/seed.ts`** — DataSource `synchronize: true` (дутуу хүснэгт автоматаар
  үүснэ, ж: `plans`) + skill жишээ хичээл.
- **`@types/multer`** dev-dependency нэмсэн (upload feature TS build засвар).
- **Хийгдэх (mobile хэрэгцээ):** бодит **streak / level / daily-XP / lesson
  completion** tracking endpoint (одоо mobile талд placeholder). Lesson `content`
  jsonb-д **видео** shape (`videoUrl`, `segments`, `tip`) — admin бөглөнө.
