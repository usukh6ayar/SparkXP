# EnglishXP — Mobile App Roadmap (Frontend)

React Native + Expo оюутны апп-ийн төлөвлөгөө. Backend (`/backend`) бэлэн тул
дэлгэц бүрийг **жинхэнэ API endpoint**-той холбоно. Зарчим: MVP эхэнд, дараа нь
scale. Монгол хэл primary.

> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж байгаа · `[ ]` хийгээгүй
> Backend roadmap: `ROADMAP.md` · Дүрэм: `CLAUDE.md`
> **Бүтээгдэхүүний чиглэл / plan / cost guardrail: `PRODUCT_BRIEF.md`** (Hustle Hive docx нэгтгэл).

---

## 🎨 Дизайн / Брэнд — **SparkXP** 🦊

> ⚠️ **UI/UX REDESIGN ЯВАГДАЖ БАЙНА (2026-06).** Брэндийг **бүрэн шинэ** чиглэл рүү
> (Modern Mongol — гүн индиго + алт, Onest фонт, үнэг mascot хэвээр) шилжүүлж байна.
> Дэлгэрэнгүй: **`mobile/DESIGN_BRIEF.md`** (requirement) + **`mobile/DESIGN_SYSTEM.md`**
> (Figma spec). Эхлээд Figma-д design system, дараа нь кодод буулгана.
> Доорх **хуучин SparkXP палитр** нь шилжилт дуустал кодод түр хэвээр.

Лого: гүйж буй үнэг + очирхон. Брэнд өнгө (`src/theme/theme.ts`):

- **Улбар шар** `#F47B20` — primary, XP, гол товч (үнэг + "XP")
- **Навигатор хөх** `#182547` — гарчиг, текст ("Spark" + сарвуу)
- **Цөцгий** `#FBF4E6` — дулаан гадаргуу · **Амбер** `#FFB020` — Очирхон
- Уриа: "Суралц • Дадлага хий • Амжилтанд хүр"

> Жинхэнэ логог `mobile/assets/logo.png`-д хийвэл `src/components/Logo.tsx`-ийн
> текст wordmark-ийг `<Image>`-ээр солино. Одоо 🦊 + "SparkXP" текстээр.
> Фонт: системийн (кирилл дэмждэг); дизайн фонт сонгвол theme-д нэмнэ.

---

## 👥 Ажлын хуваарь (хэн · аль branch)

Бид 2 dev, тус бүр **нэг branch**-тай:

| Dev | Branch | Хариуцах дэлгэцүүд |
| --- | --- | --- |
| **Усухбаяр** | **`usukhbayar`** | Auth · Home · Review(SRS) · Lessons · Leaderboard |
| **Бишрэлт** | **`bishrelt`** | Quiz · AI chat · Profile · Sparks store |

Дэлгэцүүдийг **өөрсдийн бичсэн backend-тэй нь тааруулж** хуваасан.
**Foundation (M0) бэлэн, `main`-д орсон тул хоёулаа ОДОО зэрэг эхэлж болно.**

| Дэлгэц | Хэн | Branch | Backend | Төлөв |
| --- | --- | --- | --- | --- |
| M0 Foundation | Усухбаяр | — | — | ✅ main-д |
| M1 Login / Register | Усухбаяр | `usukhbayar` | `/auth/*` | ✅ main-д |
| M2 Home/Dashboard | Усухбаяр | `usukhbayar` | `/users/me/stats` | ✅ main-д (XP/Sparks карт) |
| M2 Review (SRS) | Усухбаяр | `usukhbayar` | `/reviews/*` | ⬜ дараагийнх |
| M2 Lessons (list+detail) | Усухбаяр | `usukhbayar` | `/lessons/*` | ⬜ |
| M3 Leaderboard | Усухбаяр | `usukhbayar` | `/leaderboard` | ✅ |
| M2 Quiz | Бишрэлт | `bishrelt` | `/quizzes/:id/submit` | ✅ bishrelt-д |
| M2 AI buddy chat | Бишрэлт | `bishrelt` | `/ai/chat` | ✅ bishrelt-д |
| M3 Profile (засах) | Бишрэлт | `bishrelt` | `/users/me` | ✅ bishrelt-д |
| M3 Sparks store / нээх | Бишрэлт | `bishrelt` | `/lessons/:id/unlock` | ✅ bishrelt-д |
| M4 Өнгөлгөө | 👥 хамт | — | — | ⬜ |

### Branch урсгал

1. **Ажил эхлэхийн өмнө** main-аас шинэчил:
   ```bash
   git checkout main && git pull origin main
   git checkout <usukhbayar | bishrelt>
   git merge main          # foundation + нөгөөгийн merge хийсэн ажлыг авна
   ```
2. Өөрийн branch дээр дэлгэцээ барина. **Дахин ашиглах UI → `src/components/`**
   (CLAUDE.md DRY дүрэм). Өнгө/текст → `theme`/`i18n`-ээс.
3. Дуусаад push → **PR** `<branch>` → `main` → нөгөө dev review → merge.
4. `main` руу **шууд push хийхгүй**.

> Хоёулаа өөр өөр дэлгэц (өөр файл) дээр ажиллах тул conflict бараг гарахгүй.
> Дундын файл `app/(tabs)/_layout.tsx`-д таб нэмэхэд бага зэрэг тааралдвал хоёр
> таб-ыг хоёуланг нь үлдээгээд шийднэ.

---

## 🧰 Технологийн сонголт (MVP default)

| Зүйл | Сонголт | Шалтгаан |
| --- | --- | --- |
| Framework | **Expo (managed) + TypeScript** | Хурдан эхлэх, OTA, build амар |
| Navigation | **Expo Router** (file-based) | Орчин үеийн default, гүн линк |
| Серверийн өгөгдөл | **TanStack Query** (эсвэл энгийн fetch+Context) | Cache, loading/error амар |
| Auth token | **expo-secure-store** | JWT-г найдвартай хадгална |
| State | **React Context** (auth/user) | MVP-д хангалттай |
| Хэл (i18n) | Энгийн `t()` + strings файл, **MN primary** | Хоёр хэл |
| Styling | `StyleSheet` + theme constants | Энгийн, junior уншина |
| HTTP | `fetch` wrapper (Bearer token автомат) | Нэг газар |

> `EXPO_PUBLIC_API_URL` орчны хувьсагчаар backend хаягийг тохируулна
> (dev: `http://localhost:3000/api`, утсан дээр LAN IP).

---

## 📁 Төлөвлөж буй бүтэц

```
mobile/
  app/                  Expo Router дэлгэцүүд
    (auth)/login.tsx, register.tsx
    (tabs)/index.tsx (Home), learn.tsx, leaderboard.tsx, profile.tsx
    lesson/[id].tsx, quiz/[id].tsx, review.tsx, chat.tsx
  src/
    api/client.ts       fetch wrapper (token, baseUrl, алдаа)
    api/*.ts            endpoint бүлгүүд (auth, words, lessons, ...)
    auth/AuthContext.tsx
    i18n/               mn.ts (primary), en.ts
    theme/              өнгө, фонт, spacing
    components/         дахин ашиглах UI (Button, Card, XPBadge, ...)
```

---

## 🎯 Phase M0 — Foundation `[x]` — 👤 Усухбаяр ✅

- [x] Expo (SDK 56) + TypeScript төсөл (`/mobile`) + Expo Router
- [x] Folder бүтэц (`app/`, `src/api|auth|i18n|theme`) + theme + i18n (mn primary)
- [x] `api/client.ts` — fetch wrapper, `EXPO_PUBLIC_API_URL`, Bearer token, ApiError
- [x] `AuthContext` — login/register/logout, token-г secure-store-д, `/auth/me` сэргээх
- [x] Expo Router auth gate: нэвтрээгүй→login, токентой→tabs (автомат redirect)
- [x] Минимал Login + Home (XP/Sparks, logout) дэлгэц
- **DoD:** ✅ Апп асаж, auth gate ажиллаж байна. tsc typecheck цэвэр.
  > Theme өнгө/фонт нь placeholder — дизайн ирэхэд тааруулна.

## 🎯 Phase M1 — Auth дэлгэцүүд `[x]` — 👤 Усухбаяр ✅

- [x] **Login** дэлгэц → `POST /api/auth/login` → token хадгалах (брэнд UI)
- [x] **Register** дэлгэц → `POST /api/auth/register`
      (нэр, имэйл, нууц үг + аймаг/дүүрэг picker — UB-д дүүрэг харагдана)
- [x] Алдаа/loading төлөв, login↔register холбоос
- [x] Дахин ашиглах компонент: `Logo`, `Button`, `TextField`, `SelectField`
- **DoD:** ✅ Шинэ хэрэглэгч бүртгүүлж, нэвтэрч, апп руу орно. tsc цэвэр.
  > Home-г бас брэндээр шинэчилсэн (XP/Sparks карт, "Өнөөдрийн зорилго").

## 🎯 Phase M2 — Үндсэн суралцах дэлгэцүүд `[~]` — 👤 Усухбаяр + Бишрэлт

- [x] **Home/Dashboard** (👤 Усухбаяр) — XP/Sparks карт, "Өнөөдрийн зорилго"
      _(одоо session-ээс; M2-д `GET /api/users/me/stats`-аар live болгоно)_
- [ ] **Vocabulary / Review** — `GET /api/reviews/due` → карт эргүүлэх →
      `POST /api/reviews/:wordId {quality 0-5}` (Again/Hard/Good/Easy товч)
- [ ] **Lessons** жагсаалт — `GET /api/lessons` (type/level филтр)
- [ ] **Lesson detail** — `GET /api/lessons/:id`, түгжээтэй бол үнэ (priceSparks)
      харуулах; `GET /api/lessons/:id/access`-ээр нээгдсэн эсэхийг шалгах
- [x] **Quiz** — асуулт харуулах → `POST /api/quizzes/:id/submit` → оноо + XP — 👤 Бишрэлт ✅
- [x] **AI buddy chat** — `POST /api/ai/chat` (текст), түүх харуулах — 👤 Бишрэлт ✅
- [x] **Lesson detail** — `GET /api/lessons/:id` + `GET /api/lessons/:id/access` + unlock — 👤 Бишрэлт ✅
- **DoD:** Оюутан үг давтаж, хичээл үзэж, quiz өгч, AI-тай ярина.

## 🎯 Phase M3 — Gamification UI `[~]` — 👤 Усухбаяр + Бишрэлт

- [x] **Leaderboard** — `GET /api/leaderboard?period=&scope=`
      (weekly/monthly/all-time таб + global/аймаг/дүүрэг/класс scope), миний байр — 👤 Усухбаяр
- [x] **Profile** — мэдээлэл, `PATCH /api/users/me` (нэр, аймаг/дүүрэг засах) — 👤 Бишрэлт ✅
- [x] **Sparks store / хичээл нээх** — `POST /api/lessons/:id/unlock`
      (Spark хүрэлцэхгүй бол мессеж) — 👤 Бишрэлт ✅
- **DoD:** Оюутан рейтингээ, профайлаа харж, Spark-аар хичээл нээнэ.

## 🎯 Phase M4 — Өнгөлгөө `[ ]` — 👥 хамт

- [ ] Voice AI товч — "Тун удахгүй" (coming soon, CLAUDE.md)
- [ ] Loading skeleton, empty/error state бүх дэлгэцэд
- [ ] Pull-to-refresh, offline сэрэмжлүүлэг
- [ ] App icon, splash screen, нэр
- **DoD:** Апп бүрэн, гацахгүй, алдаа найрсаг харагдана.

---

## 🔁 Дүрэм (CLAUDE.md-ээс)

- Монгол хэл primary, англи secondary. Cyrillic-safe фонт.
- AI зөвхөн backend AI Gateway-аар (апп шууд AI API дуудахгүй).
- Контентыг hardcode хийхгүй — API-аас татна.
- Энгийн, junior уншиж ойлгох код.

## 🌿 Git workflow (ROADMAP.md-тэй ижил)

- Усухбаяр → `usukhbayar` branch · Бишрэлт → `bishrelt` branch.
- Дуусах бүрт PR → нөгөө dev review → `main`. `main` руу шууд push хийхгүй.

---

## 📌 Дараагийн алхам

✅ **Дууссан (main-д):** M0 Foundation · M1 Auth (login/register) · Home ·
SparkXP брэнд theme · дахин ашиглах компонентууд.

✅ **Бишрэлт дууссан (`bishrelt` branch-д):** Quiz · AI chat · Profile · Lesson detail + unlock · API modules

**Одоо үлдсэн ажил:**

| Dev | Branch | Дараагийн дэлгэц |
| --- | --- | --- |
| **Усухбаяр** | `usukhbayar` | M2 **Review (SRS)** → Lessons жагсаалт → M3 Leaderboard |
| **Бишрэлт** | `bishrelt` | M4 Өнгөлгөө (skeleton, error state, pull-to-refresh) |

> Усухбаяр **Lessons жагсаалт** дэлгэц хийхдээ `app/lesson/[id].tsx` руу navigate хийвэл
> Бишрэлтийн lesson detail + unlock дэлгэц автоматаар ажиллана.
3. Дараа нь M1 (auth дэлгэц) → M2 (суралцах) → M3 (gamification).

---

## 🔄 UI/UX Redesign — Төлөв (2026-06-12)

Брэндийг **бүрэн шинэ ягаан (purple) чиглэл** рүү шилжүүлж, гол дэлгэцүүдийг
mockup-аар дахин зохион барьсан. Дизайны эх сурвалж: `DESIGN.md`,
`DESIGN_PROMPT.md` (+ `DESIGN_BRIEF.md`, `SCREEN_SPECS.md`).

### ✅ Хийгдсэн

**Design system (`src/theme/theme.ts`)**
- Ягаан палитр (`DESIGN.md`): primary `#6C3BFF`, gradient `#7A4DFF→#5A28F0`,
  bg `#F8F8FC`, surface цагаан, surfaceAlt `#F2F3FA`.
- Gamification өнгө: XP=алт `#F5A623` · Очирхон=цэнхэр алмаз `#38BDF8` ·
  Streak=улбар `#FF8A00`.
- Semantic typography (`display/h1/h2/h3/body/bodyStrong/label/caption/overline`),
  spacing (4pt), radius (12/16/20/28), `elevation` (sm/md/float).

**Шинэ/шинэчилсэн компонентууд (`src/components/`)**
- `Text` (AppText), `Card`, `SectionHeader`, `ProgressBar`, `IconTile` (шинэ).
- `Button`, `Pill`, `StatCard`, `TopBar`, `CustomTabBar` (шинэчилсэн).

**Дэлгэцүүд (mockup-аар)**
- **Home** — мэндчилгээ+badge, `home-banner.png` hero (ImageBackground),
  "Давтах үгс" карт, 4 скилл grid, 3-stat карт.
- **Lessons жагсаалт** — скилл-icon thumb, level filter (A1–C1), явц%/үнэ+цоож.
- **Lesson detail** — дугаар толгой, **placeholder видео тоглуулагч**, segment
  жагсаалт, Санамж, CTA (unlock/access логик хадгалсан).
- **Soril** — header, `soril-banner.png` challenge hero, 6 тоглоомын grid,
  "Амжилтын зам" node path.
- **Profile** — gradient hero + glow avatar, premium XP, stat нүд, collectible
  badge, түргэн цэс (8), gradient premium карт, гарах.
- **Chat** — `buddy-menu.png` (Спарк avatar) buddy menu/empty/мессежид.
- **Leaderboard, Swipe** — token-оор шинэчлэгдсэн.
- **Bottom tab** — төвд AI Найз buddy зураг + glow + label (наалдсан).

**Контент / навигаци**
- Home/Lessons скилл: Сонсгол`listening` · Унших`reading` · Нөхөх`fill` ·
  Бичих`writing` (Lessons `?type`-аар шүүнэ).

**Assets** — дэлгэц тус бүрийн фолдер бүтэц (`assets/README.md`).
Одоо байгаа: `home-banner.png`, `buddy-menu.png`, `soril-banner.png`, `logo.png`.

**Backend (shared) + засвар**
- `LessonType`-д `reading`/`writing`/`fill` нэмсэн + seed skill хичээл. `API.md`.
- `seed.ts` DataSource `synchronize: true` (plans г.м хүснэгт автоматаар үүснэ).
- `@types/multer` суулгасан (Бишрэлтийн upload feature build засвар).
- **Bug fix:** `URLSearchParams` → энгийн query string (RN-д найдваргүй, Lessons
  ачаалагдахгүй байсан). `.env` API IP шинэчилсэн (LAN IP өөрчлөгдсөн).

### 🟦 Шийдвэрүүд
- Брэнд: **ягаан + үнэг mascot хэвээр**, нэр **SparkXP** хэвээр.
- Фонт: **Onest/Inter** (зөвлөмж) — *одоо системийн фонт, хараахан ачаалаагүй*.
- Icon: **Lucide** (зөвлөмж) — *одоо Ionicons*.
- Dark mode: **дараа**.

### ⬜ Хийгдэх (TODO)
- [ ] **App icon** — `icon.png`/`favicon.png`/`android-icon-*` файлууд **алга**
      (app.json заасан). Брэнд icon үүсгэх.
- [ ] **Фонт ачаалах** — Onest/Inter (`expo-font`).
- [ ] **Lucide icon** руу шилжих (Ionicons-оос).
- [x] **Onboarding flow** — 3 слайд carousel (skip, dots, mascot) + login/register
      redesign (multi-step: мэдээлэл→байршил→амжилттай). main-д. *(mascot зураг түр
      placeholder — `assets/onboarding/PROMPTS.md`-аар жинхэнийг солино.)*
- [ ] **Бодит gamification дата** — streak, level, өдрийн XP зорилго, category
      progress, lesson completion, Profile stat (Хичээл/Сорил тоо) — бүгд одоо
      **placeholder** (backend tracking хэрэгтэй).
- [ ] **Видео тоглуулагч** — жинхэнэ (`expo-video` + `content.videoUrl`).
- [ ] **Soril тоглоомууд** — логик ("тун удахгүй").
- [ ] (Сонголт) Home/Lessons/Chat-д premium gradient/depth давхарга.

---

## 🎯 Phase M5 — Багшийн хэсэг (role-based) `[ ]` — 👤 Усухбаяр

> Шийдвэр: **role-оор tab бүхэлд солино** · teacher эрх зөвхөн admin-аас
> (`PATCH /users/:id`) · MVP = анги + join code + roster + даалгавар оноох.
> Backend бараг бэлэн (`PRODUCT_BRIEF.md` §6).

**Role routing**
- [ ] `app/_layout.tsx` gate — нэвтэрсний дараа `user.role`-оор: `teacher`→`/(teacher)`, бусад→`/(tabs)`.
- [ ] Шинэ route group `app/(teacher)/` + энгийн `Tabs` (AI-төв байхгүй).
- [ ] Register-ийг student-only болгох (backend DTO-той зэрэгцүүлж).

**Mobile API давхарга** (бүгд backend-д бэлэн)
- [ ] `src/api/classes.ts` — `getMyClasses` (`GET /classes`), `createClass` (`POST /classes`),
      `getClass` (`GET /classes/:id`), `getClassStudents` (`GET /classes/:id/students`),
      `getClassProgress` (`GET /classes/:id/progress` → оюутан бүрийн xpWeek/Month/Total+sparks).
- [ ] `src/api/assignments.ts` — `createAssignment` (`POST /assignments`),
      `getClassAssignments` (`GET /assignments?classId=`), `deleteAssignment` (`DELETE /assignments/:id`).

**Дэлгэцүүд (🟢 одоо хийж болно)**
- [ ] **Ангиуд** (`(teacher)/index.tsx`) — заадаг ангиуд (нэр, сурагч тоо, код) + "Анги үүсгэх".
- [ ] **Ангийн дэлгэрэнгүй** (`(teacher)/class/[id].tsx`) — **элсэх кодын карт (Share)** ·
      сурагчид (нэр + XP, progress-аас xpWeek/Total) · даалгаврууд (оноох/устгах).
- [ ] **Даалгавар оноох** — төрөл (хичээл/сорил) → контент → due date → `POST /assignments`.
- [ ] **Багшийн профайл** — нэр, "Багш" badge, сургууль/анги, гарах (student profile суурийг дахин ашиглах).
- **DoD:** Багш нэвтэрч → анги үүсгэ → код хуваалцана → сурагч элснэ → roster+XP харна → даалгавар онооно.

**🟡 Backend хэрэгтэй (дараа — `ROADMAP.md` coordinate)**
- [ ] Даалгаврын **гүйцэтгэлийн төлөв** (хэн дуусгасан, X/N).
- [ ] Сурагч бүрийн **quiz оноо** + **сул сэдвүүд** (weak topics).
- [ ] Класснаас сурагч хасах UI (`DELETE /classes/:id/leave` бэлэн — багш талын endpoint тодруулах).

---

## 🎯 Phase M6 — Product-brief alignment (сурагч тал) `[ ]` — 👤 Усухбаяр

> `PRODUCT_BRIEF.md`-д нийцүүлэх. Эрэмбэ: эхлээд хямд/одоо боломжтой.

**Одоо / хямд**
- [ ] **Home → "Үргэлжлүүлэх"** ганц гол үйлдэл (Duolingo-style), дараа нь secondary.
- [ ] **Placement / level** сонголт (register эсвэл onboarding-д; User `level`).
- [ ] **Оноосон даалгавраа харах** (сурагч) — `GET /api/assignments/my` бэлэн (хурдан ялалт).
- [ ] Профайлд **English name санал + avatar**.
- [ ] **Plan / limit badge** — одоогийн plan + Sparks тэнцэл (Sparks бэлэн).

**Дараа (Phase 1.5+)**
- [ ] Duolingo-style **lesson path** (одоогийн жагсаалтын оронд).
- [ ] **Voice AI** speaking + cap UI (80%/95% warning → voice зогсох → reset+upgrade) — одоо "coming soon".
- [ ] **Double-tap dictionary** (DB/cache эхэлж, дараа Gemini).
- [ ] **Profession AI buddies** (Бишрэлт 5 buddy backend-д нэмсэн — mobile-д ил гаргах).
- [ ] **Streak / badge** UI (backend tracking бэлэн болоход).
