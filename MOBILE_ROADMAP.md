# EnglishXP — Mobile App Roadmap (Frontend)

React Native + Expo оюутны апп-ийн төлөвлөгөө. Backend (`/backend`) бэлэн тул
дэлгэц бүрийг **жинхэнэ API endpoint**-той холбоно. Зарчим: MVP эхэнд, дараа нь
scale. Монгол хэл primary.

> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж байгаа · `[ ]` хийгээгүй
> Backend roadmap: `ROADMAP.md` · Дүрэм: `CLAUDE.md`
> **Бүтээгдэхүүний чиглэл / plan / cost guardrail: `PRODUCT_BRIEF.md`** (Hustle Hive docx нэгтгэл).

---

## 🎨 Дизайн / Брэнд — **SparkXP** 🦊

> ✅ **ДИЗАЙН ЧИГЛЭЛ БАТЛАГДСАН (2026-06-29): ЯГААН `#6C3BFF`.** Өмнө
> `DESIGN_BRIEF.md`-д дурдсан "Modern Mongol — индиго + алт" хувилбарыг
> **ХЭРЭГЛЭХГҮЙ** — код дээр аль хэдийн буусан ягаан чиглэлээр үргэлжилнэ.
> UI/UX visual mockup гаргуулах эх prompt: **`mobile/UIUX_DESIGN_PROMPT.md`**
> (гадны AI design tool-д хуулна). Брэнд токен эх сурвалж: `mobile/DESIGN.md`
> + `SCREEN_SPECS.md`.

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

**2026-06-29 reorg — баг 4 хүн боллоо.** Mobile-ыг **Choi + Boju** хариуцна
(Усухбаяр → admin + lead, Бишрэлт → backend). Дэлгэцийг бүлгээр хувааж merge
conflict-ээс зайлсхийнэ:

| Dev | Branch | Хариуцах дэлгэцүүд (mobile) |
| --- | --- | --- |
| **Choi** | **`choi`** | **Сурах цөм:** Auth (onboarding/login/register/forgot) · Home · Lessons (list+detail) · Review (SRS) · Swipe + Saved |
| **Boju** | **`boju`** | **Тоглоом+сошл:** Quiz/Vocab-quiz · Soril · AI Найз chat · Leaderboard · Profile/Avatar/Assignments · Teacher · Join |

> Хуваалт screen-group-оор. **Shared `src/components` + `theme.ts`**-г 2уулаа
> зэрэг бүү засаарай — жижиг PR-аар, энд зарлаад ор. Backend endpoint хэрэгтэй
> бол **Бишрэлт**-д хэлж нэмүүлнэ (`API.md`). Foundation (M0) бэлэн тул хоёулаа
> ОДОО зэрэг эхэлж болно.

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
- [x] **Vocabulary / Review** — `GET /api/reviews/due` → карт эргүүлэх →
      `POST /api/reviews/:wordId {quality 0-5}` (Again/Hard/Good/Easy товч) — 👤 Усухбаяр ✅
      _(swipe + review дэлгэц)_
- [x] **Lessons** жагсаалт — `GET /api/lessons` (type/level филтр) — 👤 Усухбаяр ✅
- [x] **Lesson detail** — `GET /api/lessons/:id`, түгжээтэй бол үнэ (priceSparks)
      харуулах; `GET /api/lessons/:id/access`-ээр нээгдсэн эсэхийг шалгах — 👤 Усухбаяр ✅
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

- [x] Voice AI товч — "Тун удахгүй" (coming soon, CLAUDE.md) — 👤 Усухбаяр ✅
- [ ] Loading skeleton, empty/error state бүх дэлгэцэд
- [x] Pull-to-refresh (lessons/home), offline сэрэмжлүүлэг (offline үлдсэн)
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

✅ **Дууссан (main-д merged):**
- M0 Foundation · M1 Auth · M2 (Review/Lessons/Quiz/Chat) · M3 (Leaderboard/Profile/Sparks)
- **Brand redesign** (purple) бүх дэлгэцэд
- **Onboarding** (3-slide) + login/register redesign
- **Auth overhaul:** username + email **OTP** баталгаажуулалт, нууц үг сэргээх, username/email login
- **M5 Багшийн хэсэг:** role tabs · анги (сургууль+нэр) · join code + QR · **элсэх зөвшөөрөл** · даалгавар · багшийн чансаа
- **Сурагч:** анги нэгдэх (код/**QR scanner**) · **avatar** (upload + default)

**🔜 Үлдсэн ажил (эрэмбээр):**

| # | Ажил | Хамаарал |
| --- | --- | --- |
| 1 | Home **"Үргэлжлүүлэх"** + сурагчийн **оноосон даалгавар** харах (`/assignments/mine` бэлэн) | mobile |
| 2 | **Placement/level** сонголт + English name | mobile + `User.level` backend |
| 3 | **Plan/limit badge** профайлд | mobile + plan backend |
| 4 | M4 **Өнгөлгөө** — skeleton, error/empty, pull-to-refresh, app icon, фонт ачаалах | mobile |
| 5 | Багшийн 🟡: даалгаврын **гүйцэтгэл / quiz оноо / weak topics** | backend (coordinate) |
| 6 | **Voice AI** speaking + cap UI · **double-tap dictionary** · Duolingo lesson path | Phase 1.5+ |
| 7 | **Streak / badge / level** бодит дата (одоо placeholder) | backend tracking |

> Backend талын дэлгэрэнгүй (completion tracking, usage metering, AI dictionary,
> voice, plan caps г.м): `ROADMAP.md` → "Doc-aligned backlog".

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

## 🎯 Phase M5 — Багшийн хэсэг (role-based) `[x]` — 👤 Усухбаяр ✅

> Шийдвэр: **role-оор tab бүхэлд солино** · teacher эрх зөвхөн admin-аас
> (`PATCH /users/:id`). **Бүгд main-д merge хийгдсэн.**

**Role routing**
- [x] `app/_layout.tsx` gate — `user.role`-оор: `teacher`→`/(teacher)`, бусад→`/(tabs)`.
- [x] Шинэ route group `app/(teacher)/` + энгийн `Tabs`.
- [x] Register-ийг **student-only** болгож түгжсэн.

**Mobile API давхарга**
- [x] `src/api/classes.ts` (getMyClasses/createClass/getClass/getClassStudents + join requests).
- [x] `src/api/assignments.ts` (create/getClassAssignments/delete).

**Дэлгэцүүд**
- [x] **Ангиуд** — заадаг ангиуд + "Анги үүсгэх" (**сургууль сонгож** + нэр 10А/11Б).
- [x] **Ангийн дэлгэрэнгүй** — элсэх код + **QR**, сурагчид (XP), даалгаврууд (оноох/устгах),
      **элсэх хүсэлт зөвшөөрөх/татгалзах**.
- [x] **Даалгавар оноох** — хичээл/сорил + due date.
- [x] **Багшийн "Чансаа" таб** — `scope=teacher` (өөрийн сурагчид).
- [x] **Багшийн профайл** — "Багш" badge, гарах.

**🟡 Backend хэрэгтэй (дараа — `ROADMAP.md` coordinate)**
- [ ] Даалгаврын **гүйцэтгэлийн төлөв** (хэн дуусгасан, X/N).
- [ ] Сурагч бүрийн **quiz оноо** + **сул сэдвүүд** (weak topics).
- [ ] Класснаас сурагч хасах UI.

---

## 🎯 Phase M6 — Product-brief alignment (сурагч тал) `[~]` — 👤 Усухбаяр

> `PRODUCT_BRIEF.md`-д нийцүүлэх. Эрэмбэ: эхлээд хямд/одоо боломжтой.

**Хийгдсэн ✅**
- [x] **Анги нэгдэх** — код оруулах эсвэл **QR уншуулах** (camera), pending хүсэлт.
- [x] **Профайл зураг (avatar)** — gallery-аас upload + бэлэн зургуудаас сонгох.
- [x] **Auth шинэчлэл** — username + email OTP баталгаажуулалт, нууц үг сэргээх.

**Дараагийн (хямд / одоо боломжтой)**
- [x] **Home → "Үргэлжлүүлэх"** ганц гол үйлдэл (Duolingo-style). — 👤 Усухбаяр ✅
- [x] **Placement / level** сонголт (sign-up; `User.level`). — 👤 Усухбаяр ✅
- [x] **Оноосон даалгавраа харах** (сурагч) — `GET /api/assignments/mine`. — 👤 Усухбаяр ✅
- [x] Профайлд **English name** санал (sign-up). — 👤 Усухбаяр ✅
- [x] **Plan / limit badge** — одоогийн plan + лимит харуулах. — 👤 Усухбаяр ✅

**Дараа (Phase 1.5+)**
- [ ] Duolingo-style **lesson path** (жагсаалтын оронд).
- [ ] **Voice AI** speaking + cap UI (80%/95% warning → voice зогсох → reset+upgrade).
- [x] **Double-tap dictionary** — англи үг дээр дарж монгол тайлбар (bottom sheet).
      `GET /api/dictionary/:word` (Words DB → AI fallback, Бишрэлт backend).
      AI chat-ийн хариунд `TappableText` холбосон. — 👤 Усухбаяр ✅
- [ ] **Profession AI buddies**-ийг mobile-д ил гаргах.
- [ ] **Streak / badge** UI (backend tracking бэлэн болоход).
