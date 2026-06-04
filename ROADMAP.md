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

### 2. Users module `[ ]` — 👥 хамт / дараа

- [ ] CRUD (admin-д зориулсан)
- [ ] Профайл засах (`PATCH /api/users/me`)
- [ ] XP/Sparks тэнцэл унших (`GET /api/users/me/stats`)

### 3. Content modules — DB-д суурилсан `[ ]`

> Бүх контент DB-д. Hardcode хийхгүй. Admin нэмж чадна.
> **Хуваарь:** Words/Lessons = 👤 Өсөхбаяр · Quizzes = 👤 Бишрэлт (өөр файл тул зэрэг хийж болно)

- [ ] **Words module** — CRUD, level/lesson-оор шүүх — 👤 Өсөхбаяр
- [ ] **Lessons module** — CRUD, type (vocab/grammar/listening), publish — 👤 Усухбаяр
- [ ] **Quizzes module** — CRUD, `questions` jsonb-ийг service-д validate — 👤 Бишрэлт
- **DoD:** Admin үг/хичээл/quiz нэмж, оюутан түүнийг API-аар авч чадна.

### 4. Vocabulary / Spaced Repetition `[ ]` — 👤 Усухбаяр

- [ ] `GET /api/reviews/due` — өнөөдөр давтах ёстой үгс (WordReview)
- [ ] `POST /api/reviews/:wordId` — хариу илгээх (зөв/буруу)
- [ ] SM-2 алгоритм service-д (easeFactor, interval, nextReviewAt шинэчлэх)
- **DoD:** Оюутан үг давтахад дараагийн давталтын огноо зөв тооцогдоно.

### 5. Quiz submission + XP `[ ]` — 👤 Бишрэлт

- [ ] `POST /api/quizzes/:id/submit` — хариу шалгах, оноо тооцох
- [ ] **XP service** — зөв хариунаас XP олгох, `XpLog`-д бичих,
      `User.xp` cache-г шинэчлэх
- [ ] Anti-abuse: зөвхөн жинхэнэ зөв харилцаанаас XP (CLAUDE.md)
- **DoD:** Quiz өгөхөд XP нэмэгдэж, XpLog-д мөр үүснэ.

### 6. AI Gateway module `[ ]` ⚠️ ЧУХАЛ — 👤 Бишрэлт

> Бүх AI дуудлага ЗААВАЛ энэ нэг module-ээр дамжина. Feature-ээс шууд AI API
> дуудахгүй (CLAUDE.md).

- [ ] `AiGatewayService.chat()` — текст AI buddy
- [ ] Per-user хязгаар шалгах (DB/Redis-ээс уншсан тохиргоогоор)
- [ ] Дуудлага бүрийг `AiUsage`-д logging (token, cost тооцох)
- [ ] Plan limit-ийг DB/admin-аас тохируулдаг болгох (app update-гүйгээр)
- [ ] `Message` entity-д харилцааны түүх хадгалах
- **DoD:** Оюутан AI buddy-тэй ярихад хариу авч, AiUsage-д бүртгэгдэж,
  хязгаар хэтрэхэд блоклогдоно.

### 7. Basic Admin `[ ]` — 👥 хамт / дараа

- [ ] Контент CRUD-ийг admin role-оор хамгаалах
- [ ] Энгийн seed script (туршилтын үг/хичээл оруулах)

### 8. Leaderboard module `[ ]` — 👤 Усухбаяр

> Рейтинг = **XP** (Spark-аар БИШ). XP-г устгаж reset хийхгүй — period нь зүгээр
> `XpLog.created_at` дээрх хугацааны цонх.
> ⚠️ Энэ нь #5 (XP service, Бишрэлт)-ийн дараа жинхэнэ дата авна — query-г seed
> дататай урьдчилж барьж болно.

- [x] Schema: `User.province/district/country`, `Organization.province/district`
- [x] Enum: `LeaderboardPeriod` (weekly/monthly/all_time), `LeaderboardScope`
- [ ] `GET /api/leaderboard?period=weekly&scope=province` — топ N + миний байр
- [ ] Postgres query: `XpLog`-г хугацаа+scope-оор SUM, эрэмбэлэх
- [ ] Scope-ууд: global, province, district, class, organization
- [ ] (Дараа нь) Redis ZSET-ээр хурдасгах — scale хэрэгтэй болоход
- **DoD:** Оюутан өөрийн дүүрэг/аймаг/global-аар, долоо хоног/сар/бүх цагаар
  рейтингээ харна.

### 9. Sparks store — хичээл худалдах `[ ]` — 👤 Бишрэлт

> Spark = зарцуулагддаг валют. Хичээл Spark-аар нээж болно.

- [x] Schema: `Lesson.priceSparks`, `SparksLog` (ledger), `LessonUnlock`
- [x] Enum: `SparksSource` (олох/зарах эх сурвалж)
- [ ] **Sparks service** — Spark олгох/хасах, `SparksLog`-д бичих,
      `User.sparks` cache шинэчлэх (XP service-ийн ихэр)
- [ ] `POST /api/lessons/:id/unlock` — Spark хасч `LessonUnlock` үүсгэх
      (нэг транзакц, balance шалгах, давхар худалдан авалтаас сэргийлэх)
- [ ] Хичээл авах эрхийг шалгах (нээгдсэн эсэх) контент уншихад
- [ ] **Spark-г мөнгөөр цэнэглэх** — `Payment` амжилттай → `SparksLog` (+,
      source=`PURCHASE`). Payment module-той хамт (Phase 2).
- **DoD:** Оюутан хангалттай Spark-тай бол хичээл нээж, дараа нь үргэлж
  хандана. Spark дутвал блоклогдоно. Spark-г мөнгөөр худалдаж авч болно.

### 10. Чанар, найдвартай байдал `[ ]` — 👥 хамт

- [ ] Global exception filter + стандарт алдааны формат
- [ ] Request validation (DTO + class-validator) бүх endpoint дээр
- [ ] `GET /api/health` — health check
- [ ] Production-д `DB_SYNCHRONIZE=false` + migration ашиглах
- [ ] Гол flow-уудад unit/e2e test (auth, XP, review, leaderboard, unlock)

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
- [ ] **Sparks store-ийг өргөтгөх** — хичээлээс гадна бусад зүйл (avatar, hint,
      streak freeze г.м). Үндсэн механик нь Phase 1 #9-д бэлэн.
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

## 📌 Дараагийн алхам — хэн юунаас эхлэх

✅ **Auth (#1) дууссан, `main`-д merged.** Schema (#8, #9) бэлэн. Одоо хоёулаа
**параллель** эхэлж болно (өөр өөр модуль = өөр файл = conflict бараг үгүй):

| Dev          | Branch       | Эхлэх ажил                                  |
| ------------ | ------------ | ------------------------------------------- |
| **Усухбаяр** | `usukhbayar` | #3 Words + Lessons module → дараа нь #4 SRS |
| **Бишрэлт**  | `bishrelt`   | #3 Quizzes module → дараа нь #5 Quiz+XP     |

Дараа нь: Усухбаяр → #8 Leaderboard · Бишрэлт → #9 Sparks store + #6 AI Gateway.

> Тэмдэглэл: Content (#3) бол суурь — XP (#5), Leaderboard (#8), Sparks store (#9)
> бүгд контент байхыг шаардана. Тиймээс хоёулаа эхлээд өөрсдийн контент модулиа
> барина.
