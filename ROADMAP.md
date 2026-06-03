# EnglishXP — Хөгжүүлэлтийн төлөвлөгөө (Roadmap)

Энэ файл нь backend-ийн дараагийн ажлуудыг дарааллаар нь жагсаасан төлөвлөгөө.
CLAUDE.md-ийн build phase-уудтай нийцнэ. Зарчим: **MVP эхэнд, дараа нь scale.**
Over-engineering хийхгүй.

> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж байгаа · `[ ]` хийгээгүй

---

## ✅ Хийгдсэн — Суурь (Foundation)

- [x] NestJS + TypeScript төсөл (`/backend`)
- [x] PostgreSQL холболт (TypeORM), Redis холболт (ioredis, global module)
- [x] 12 entity бүгд: User, Organization, Class, Lesson, Word, Quiz,
      Assignment, WordReview, XpLog, AiUsage, Message, Payment
- [x] UUID primary key, `created_at`/`updated_at` (BaseEntity)
- [x] jsonb: `lesson.content`, `quiz.questions`, `*.metadata`
- [x] `.env` тохиргоо, README, ROADMAP

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

### 2. Users module `[ ]`
- [ ] CRUD (admin-д зориулсан)
- [ ] Профайл засах (`PATCH /api/users/me`)
- [ ] XP/Sparks тэнцэл унших (`GET /api/users/me/stats`)

### 3. Content modules — DB-д суурилсан `[ ]`
> Бүх контент DB-д. Hardcode хийхгүй. Admin нэмж чадна.
- [ ] **Words module** — CRUD, level/lesson-оор шүүх
- [ ] **Lessons module** — CRUD, type (vocab/grammar/listening), publish
- [ ] **Quizzes module** — CRUD, `questions` jsonb-ийг service-д validate хийх
- **DoD:** Admin үг/хичээл/quiz нэмж, оюутан түүнийг API-аар авч чадна.

### 4. Vocabulary / Spaced Repetition `[ ]`
- [ ] `GET /api/reviews/due` — өнөөдөр давтах ёстой үгс (WordReview)
- [ ] `POST /api/reviews/:wordId` — хариу илгээх (зөв/буруу)
- [ ] SM-2 алгоритм service-д (easeFactor, interval, nextReviewAt шинэчлэх)
- **DoD:** Оюутан үг давтахад дараагийн давталтын огноо зөв тооцогдоно.

### 5. Quiz submission + XP `[ ]`
- [ ] `POST /api/quizzes/:id/submit` — хариу шалгах, оноо тооцох
- [ ] **XP service** — зөв хариунаас XP олгох, `XpLog`-д бичих,
      `User.xp` cache-г шинэчлэх
- [ ] Anti-abuse: зөвхөн жинхэнэ зөв харилцаанаас XP (CLAUDE.md)
- **DoD:** Quiz өгөхөд XP нэмэгдэж, XpLog-д мөр үүснэ.

### 6. AI Gateway module `[ ]` ⚠️ ЧУХАЛ
> Бүх AI дуудлага ЗААВАЛ энэ нэг module-ээр дамжина. Feature-ээс шууд AI API
> дуудахгүй (CLAUDE.md).
- [ ] `AiGatewayService.chat()` — текст AI buddy
- [ ] Per-user хязгаар шалгах (DB/Redis-ээс уншсан тохиргоогоор)
- [ ] Дуудлага бүрийг `AiUsage`-д logging (token, cost тооцох)
- [ ] Plan limit-ийг DB/admin-аас тохируулдаг болгох (app update-гүйгээр)
- [ ] `Message` entity-д харилцааны түүх хадгалах
- **DoD:** Оюутан AI buddy-тэй ярихад хариу авч, AiUsage-д бүртгэгдэж,
  хязгаар хэтрэхэд блоклогдоно.

### 7. Basic Admin `[ ]`
- [ ] Контент CRUD-ийг admin role-оор хамгаалах
- [ ] Энгийн seed script (туршилтын үг/хичээл оруулах)

### 8. Чанар, найдвартай байдал `[ ]`
- [ ] Global exception filter + стандарт алдааны формат
- [ ] Request validation (DTO + class-validator) бүх endpoint дээр
- [ ] `GET /api/health` — health check
- [ ] Production-д `DB_SYNCHRONIZE=false` + migration ашиглах
- [ ] Гол flow-уудад unit/e2e test (auth, XP, review)

---

## 📋 Phase 2 — Teacher dashboard, Organizations, Payments

- [ ] **Organizations module** — school/company/law_firm (type нь нээлттэй string)
- [ ] **Classes module** — багш класс үүсгэх, `join_code` үүсгэх
- [ ] Оюутан `join_code`-оор класст элсэх (`POST /api/classes/join`)
- [ ] **Assignments** — багш класст хичээл/quiz оноох, due date
- [ ] Багшийн dashboard API — оюутны прогресс, статистик
- [ ] **Payments module** — QPay (Монгол) эсвэл Stripe integration
- [ ] Org-level plan / суудлын тоо удирдах

---

## 🚀 Phase 3 — Voice AI, Premium, Sparks store

- [ ] Voice AI: STT/TTS — AI Gateway-аар дамжуулж (одоо UI "coming soon")
- [ ] Voice минут хязгаарыг plan-аас тохируулах
- [ ] **Sparks store** — Sparks-аар юм худалдаж авах
- [ ] Sparks олгох/зарцуулах rate-ийг admin-аас тохируулах
- [ ] Premium subscription tiers

---

## 🔁 Тогтмол баримтлах зарчмууд (CLAUDE.md-ээс)

- Бүх контент **DB-д**, hardcode хийхгүй
- Бүх AI дуудлага **AI Gateway**-ээр
- Plan limit-үүд **DB/admin-аас** тохируулагддаг (app update-гүй)
- UUID primary key, jsonb flexible контент, `created_at`/`updated_at`
- TypeScript everywhere, жижиг функц, тодорхой нэр, junior уншиж ойлгохоор
- Хоёр хэл: Монгол primary, Англи secondary

---

## 📌 Дараагийн нэн тэргүүний алхам

**Auth module** (#1) — бусад бүх зүйл нэвтрэлт дээр тулгуурладаг тул эхэнд.
Дараа нь Content (#3) → Vocabulary/Review (#4) → AI Gateway (#6).
