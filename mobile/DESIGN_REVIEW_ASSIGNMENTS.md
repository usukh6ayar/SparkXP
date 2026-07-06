# SparkXP — Design Review ажил хуваарилалт (Choi ⇄ Boju)

> Эх сурвалж: [`DESIGN_REVIEW.md`](./DESIGN_REVIEW.md) (50 сайжруулалт).
> Зорилго: 2 mobile dev-т **зөрчилгүй**, тэнцвэртэй хуваарилах + хэн эхэлж push
> хийх, юуг **зэрэг** (parallel) хийж болохыг тодорхойлох.

---

## ✅ Choi-гийн ажлын явц (2026-07-06) — Boju АНХААР, давхардуулж бүү хий

Доорх хүснэгтүүдэд ✅ = дууссан (Choi), ⏸ = хойшлуулсан. Choi-гийн бүх Stage
дууссан бөгөөд PR-аар оруулсан:

- **PR #101 (merge болсон)** — Stage 1 Foundation: #1, #2, #3, #6, #7, #8, #28,
  #29, #40, #42, #43. Shared файлууд: `lib/haptics.ts`, `lib/motion.ts`,
  `components/PressableScale.tsx`, `Button.tsx`, `CustomTabBar.tsx`,
  `ProgressBar.tsx`, `EmptyState.tsx`, `app/_layout.tsx`.
- **PR #102** — Stage 2 (Choi дэлгэцүүд): #9, #10, #12a, #15, #16, #20, #21, #22,
  #23, #24, #36, #37. + Stage 3: #18 (`IconButton` a11y), #31 (pull-refresh
  haptic). #19 (Choi дэлгэцүүд theme-reactive тул хэрэггүй), #30/#39 (аль хэдийн
  байсан), **#48 хойшлуулсан** (theme cross-fade).

> ⚠️ Choi аль хэдийн `haptics.ts` / `motion.ts` / `PressableScale.tsx` /
> `shake()` helper-ийг бүтээсэн — **Boju эдгээрийг дахин бүү үүсгэ, import хийж
> ашигла.** Reward-infra (#14/#38/#47/#49) болон Boju-гийн дэлгэцүүд (#4,5,11,13,
> 17,25,26,27,34,35,44,45,46 г.м) **Boju-д хэвээр** — доор ⬜ тэмдэгтэй.

---

## 0. Хуваарилалтын зарчим (CLAUDE.md-ийн эзэмшлээр)

| Dev | Branch | Эзэмшдэг дэлгэцүүд |
| --- | --- | --- |
| **Choi (Чойжамц)** | `choi` | Auth, **Home**, Lessons (list+detail), Reading, Review/Swipe, Saved |
| **Boju (Батсайхан)** | `boju` | **Quiz/Soril**, AI Chat, Idioms, Leaderboard, Profile/Avatar/Assignments, Teacher, Join |

**⚠️ Гол зөрчлийн эх үүсвэр — SHARED файлууд** (хоёулаа хэрэглэдэг):
`src/theme/theme.ts`, `src/components/Button.tsx`, `ProgressBar.tsx`,
`CustomTabBar.tsx`, `Text.tsx`, шинэ `src/lib/haptics.ts` гэх мэт. Эдгээрийг
**хоёул нэгэн зэрэг засвал merge conflict** гарна.

### 🔑 Гол дүрэм — "Foundation эхэлж → дараа нь parallel"

1. **Stage 1 (Foundation):** shared файлуудыг **зөвхөн Choi** эхэлж хийж, **эхэлж
   push хийнэ**. Хүн бүр `main`-аас татаж авсны дараа л дараагийн ажлаа эхэлнэ.
2. **Stage 2 (Parallel):** foundation ороод ирсний дараа Choi/Boju хоёр **өөр
   өөрийн дэлгэц дээр зэрэг** ажиллана — өөр файл тул зөрчилгүй.
3. **Stage 3 (Migration/polish):** тус тусын дэлгэцийн static-color migration +
   a11y + skeleton — үргэлж parallel, тус тусын файл.

> Яагаад Choi foundation-г хийх вэ? Учир нь foundation нь **interaction primitive**
> (haptics, Button, ProgressBar, tab) — эдгээрийг нэг хүн нэг дор хийхгүй бол
> зөрчилдөнө. Choi Home эзэмшдэг тул эдгээрийг хамгийн түрүүнд шаарддаг.
> **Boju зэрэг эхлэх боломжтой:** Stage 1-ийн үед Boju өөрийн quiz дэлгэц дотор
> shared-д хамааралгүй ажлыг (доор ⚡ тэмдэгтэй) зэрэг эхэлж болно.

---

## 1. Push дараалал (богино хариулт)

| Дараалал | Хэн | Юу | Бусад юу хийж байх вэ |
| --- | --- | --- | --- |
| **1-рт push** | **Choi** | Stage 1 foundation (shared components) | Boju ⚡-тай quiz-local ажлаа эхэлж болно |
| **2-рт** | Choi + Boju **зэрэг** | Stage 2 — тус тусын дэлгэц | Foundation merge хийсний дараа, зөрчилгүй |
| **3-рт** | Choi + Boju **зэрэг** | Stage 3 — migration/polish | Тус тусын файл, үргэлж parallel |

**Товч:** *Choi эхэлж push хийнэ (foundation). Түүнээс хойш бүх зүйл parallel.*

---

## 2. Бүрэн хуваарилалт (50 ажил)

**Багана:** № = DESIGN_REVIEW.md-ийн дугаар · **Эзэн** (Choi/Boju/**Shared**) ·
**Stage** (1/2/3) · **Зэрэг?** = зэрэг хийж болох уу.

> 🔒 = shared файл (нэг хүн, зөрчилтэй) · ⚡ = Stage 1-тэй зэрэг эхэлж болно (дэлгэц-дотоод) · ✅ = parallel-safe

### 🟥 Stage 1 — Foundation (Choi, ЭХЭЛЖ push) — ✅ ДУУССАН (PR #101)

| № | Ажил | Эзэн | Файл | Төлөв |
| --- | --- | --- | --- | --- |
| 1 | `haptics.ts` helper | **Choi** 🔒 | `src/lib/haptics.ts` | ✅ |
| 2 | Button — glow gradient + `useColors` бүрэн | **Choi** 🔒 | `components/Button.tsx` | ✅ |
| 3 | `PressableScale` wrapper (scale 0.97 + spring) | **Choi** 🔒 | `components/PressableScale.tsx` | ✅ |
| 6 | Tab press haptic + active chip spring | **Choi** 🔒 | `components/CustomTabBar.tsx` | ✅ |
| 7 | Shared component-ууд static colors устгах | **Choi** 🔒 | `components/*` | ✅ |
| 8 | ProgressBar — `withTiming` дүүргэлт | **Choi** 🔒 | `components/ProgressBar.tsx` | ✅ |
| 28 | `radius` нийцлийг нэгтгэх | **Choi** 🔒 | `components/*` | ✅ |
| 29 | EmptyState-д fox mascot | **Choi** 🔒 | `components/EmptyState.tsx` | ✅ |
| 40 | Button `secondary`/`ghost` төлөв нэгтгэх | **Choi** 🔒 | `components/Button.tsx` | ✅ |
| 42 | Root screen transition (fade/slide) | **Choi** 🔒 | `app/_layout.tsx` | ✅ |
| 43 | Reduce-Motion хүндэтгэх wrapper | **Choi** 🔒 | `src/lib/motion.ts` | ✅ |

### 🟥 Stage 2 — Choi-ийн дэлгэцүүд — ✅ ДУУССАН (PR #102)

> "Төлөв" багана: ✅ = Choi дуусгасан. ("Зэрэг?" мэдээллийг доор тайлбарт үлдээв.)

| № | Ажил | Файл | Төлөв |
| --- | --- | --- | --- |
| 9 | Home skeleton loading | `app/(tabs)/index.tsx` | ✅ |
| 10 | Home continueProgress placeholder засах* | `app/(tabs)/index.tsx` | ✅ (хуурамч 75% устгав) |
| 12a | Home/Lessons list entrance stagger | `index.tsx`, `lessons.tsx` | ✅ |
| 15 | Onboarding slide parallax/fade | `app/(auth)/onboarding.tsx` | ✅ |
| 16 | Form validation shake + error haptic | `SignInSheet.tsx`, `register.tsx` | ✅ (`shake()` helper) |
| 20 | Streak flame pulse | `app/(tabs)/index.tsx` | ✅ |
| 21 | Lesson map node → detail transition | `app/level/[code].tsx` | ✅ (node pop-in + haptic) |
| 22 | Lesson lock/unlock reveal + haptic | `app/lesson/[id].tsx` | ✅ |
| 23 | Reading double-tap translate sheet | `reading/[id].tsx`, `DictionaryProvider.tsx` | ✅ |
| 24 | Reading scroll-linked progress | `app/reading/[id].tsx` | ✅ |
| 36 | Continue карт жинхэнэ thumbnail | `app/(tabs)/index.tsx` | ✅ |
| 37 | Task grid responsive (23% засах) | `app/(tabs)/index.tsx` | ✅ (2×2 tile) |

\* #10-ийн жинхэнэ progress өгөгдөл = **backend (Өсөхбаяр)**; Choi нь frontend талыг
хийсэн (өгөгдөлгүй тул хуурамч 75%-ийг нууж, thumbnail + CTA үлдээв).

### 🟥 Stage 2 — Boju-ийн дэлгэцүүд (⚡ = Stage 1-тэй зэрэг эхэлж болно)

| № | Ажил | Файл | Зэрэг? |
| --- | --- | --- | --- |
| 4 | Quiz instant зөв/буруу feedback loop | `app/quiz/[id].tsx` | ⚡ Stage 1-тэй зэрэг |
| 17 | Quiz raw `Text` → `AppText` | `app/quiz/[id].tsx` | ⚡ зэрэг |
| 34 | word_match → drag&drop | `app/quiz/[id].tsx` | ⚡ зэрэг |
| 5 | Quiz result confetti + haptic + XP count-up | `app/quiz/[id].tsx` | ✅ (haptic #1 хэрэгтэй) |
| 11 | Answer select haptic + scale | `app/quiz/[id].tsx` | ✅ (#1 дараа) |
| 13 | Wrong answer shake + error haptic | `app/quiz/[id].tsx` | ✅ (#1 дараа) |
| 35 | Quiz progress bar анимаци | `app/quiz/[id].tsx` | ✅ (#8 дараа) |
| 44 | Quiz combo/streak заалт | `app/quiz/[id].tsx` | ✅ |
| 25 | Chat typing indicator + bubble fade | `app/(tabs)/chat.tsx` | ✅ |
| 26 | Profile stat count-up | `app/(tabs)/profile.tsx` | ✅ |
| 45 | Level progress ring | `app/(tabs)/profile.tsx` | ✅ |
| 27 | Leaderboard stagger + top-3 glow | `app/leaderboard.tsx` | ✅ |
| 46 | Leaderboard өөрийн мөр sticky | `app/leaderboard.tsx` | ✅ |
| 12b | Leaderboard list stagger | `app/leaderboard.tsx` | ✅ |
| 31b | Join code хуулах haptic + toast | `components/JoinCodeCard.tsx` | ✅ |

### 🟨 Reward-infra (Boju барих — gamification эзэн; шинэ файл тул low-conflict)

| № | Ажил | Эзэн | Файл | Зэрэг? |
| --- | --- | --- | --- | --- |
| 14 | XP авах "+XP" floating toast | **Boju** 🔒 | `src/lib/xpToast.tsx` (шинэ) | #1 дараа, announce |
| 38 | Toast/snackbar дундын систем | **Boju** 🔒 | `src/components/Toast.tsx` (шинэ) | announce |
| 47 | Sound effect helper (сонголттой) | **Boju** 🔒 | `src/lib/sound.ts` (шинэ) | ✅ |
| 49 | Achievement/badge unlock modal | **Boju** 🔒 | `src/components/AchievementModal.tsx` (шинэ) | ✅ |

> Эдгээр нь **шинэ shared файл** тул хоёр dev-ийн байгаа файлтай зөрчихгүй — гэхдээ
> Choi-д хэрэгтэй болбол энд announce хийж, tiny PR-аар.

### 🟩 Stage 3 — Migration & polish (ХОЁУЛАА зэрэг, тус тусын дэлгэц)

| № | Ажил | Choi (өөрийн дэлгэц) | Boju (өөрийн дэлгэц) |
| --- | --- | --- | --- |
| 19 | Static `colors` → `useColors()` migration (46 файл) | ✅ n/a — Choi дэлгэцүүд theme-reactive (static нь brand/semantic л) | ⬜ Quiz/Chat/Profile/Leaderboard/Teacher/Join |
| 18 | Icon-only товчинд `accessibilityLabel` | ✅ `IconButton` role+label (Home) | ⬜ өөрийн дэлгэцийн icon |
| 30 | Modal spring open/close | ✅ `SignInSheet` bottom-sheet spring | ⬜ `EditProfileModal` |
| 31 | Pull-refresh haptic | ✅ Home/Lessons/Reading/skill/saved | ⬜ Leaderboard/Profile |
| 39 | Skeleton нэгтгэл | ✅ Home/Lessons/Reading/skill | ⬜ Profile/Leaderboard |
| 32 | Contrast (WCAG AA) audit | \| **Shared** — Өсөхбаяр/lead шалгаж token засна \| |
| 33 | Dynamic font scale тэсвэр | \| **Shared** — хамтдаа шалгах \| |
| 41 | Fox idle blink/breathe loop | \| **Shared** `MascotCircle`/`BuddyAvatar` — Boju (avatar эзэн) \| |
| 48 | Theme toggle cross-fade | \| ⏸ **ХОЙШЛУУЛСАН** (Choi, `SettingsContext`) — эрсдэл өндөр/ROI бага \| |
| 50 | App icon + splash + font (Onest/Inter) | \| **Shared** — lead/launch checklist \| |

---

## 3. Зэрэг (parallel) хийж болох эсэх — зөрчлийн матриц

| Нөхцөл | Зэрэг болох уу? | Тайлбар |
| --- | --- | --- |
| Choi Stage 1 (shared) **∥** Boju ⚡ quiz-local (#4,17,34) | ✅ **Тийм** | Өөр файл (`components/*` vs `app/quiz/*`) |
| Choi Stage 1 (shared) **∥** Boju reward-infra (#14,38,47,49) | ⚠️ **Болгоомжтой** | Шинэ файл тул OK, гэхдээ #14/#38 нь `haptics.ts` (#1)-д тулна → #1 эхэлж merge |
| Choi Stage 2 дэлгэц **∥** Boju Stage 2 дэлгэц | ✅ **Тийм** | Тус тусын `app/*` файл, огт давхцахгүй |
| Choi **∥** Boju — **хоёул shared component** засах | ❌ **Үгүй** | Заавал дараалан: announce → tiny PR → merge |
| Choi Stage 3 migration **∥** Boju Stage 3 migration | ✅ **Тийм** | Тус тусын дэлгэцийн static color |

**Ганц хатуу хориг:** `theme.ts` + `src/components/*` дээр **хоёулаа нэгэн зэрэг**
бүү ажилла. Stage 1-д Choi бөөнөөр нь цэвэрлэнэ; түүнээс хойш shared-д хүрэх бол
энд бичиж мэдэгдээд **жижиг PR**-аар (CLAUDE.md → "announce → tiny PR → merge fast").

---

## 4. Долоо хоногийн timeline (санал)

| Долоо хоног | Choi | Boju | Push дараалал |
| --- | --- | --- | --- |
| **7-хон 1** | Stage 1 foundation (#1,2,3,6,7,8,28,29,40,42,43) | ⚡ Quiz-local (#4,17,34) эхлүүлж, foundation merge хүлээнэ | **Choi эхэлж push** → Boju merge |
| **7-хон 2** | Home/Lessons (#9,10,12a,20,21,22,36,37) | Quiz reward (#5,11,13,35,44) + reward-infra (#14,38,49) | **Зэрэг** push (өөр файл) |
| **7-хон 3** | Reading/Auth (#15,16,23,24) + Stage 3 migration | Chat/Profile/Leaderboard (#25,26,27,45,46) + Stage 3 | **Зэрэг** push |
| **Тасралтгүй** | Өөрийн дэлгэцийн #19 migration | Өөрийн дэлгэцийн #19 migration | Зэрэг, жижиг PR |

---

## 5. Ажлын ачаалал — тэнцвэр

| Dev | Гол хариуцлага | Тоо (ойролцоо) |
| --- | --- | --- |
| **Choi** | Foundation (interaction primitives) + Home/Lessons/Reading/Auth | ~23 ажил |
| **Boju** | Gamification delight (quiz celebration, reward-infra) + Chat/Profile/Leaderboard | ~23 ажил |
| **Shared/Lead** | Contrast, dynamic font, app icon/font (#32,33,50) | ~4 ажил (Өсөхбаяр) |

> Choi = **"platform"** (foundation-г нэг хүн барих ёстой тул), Boju = **"delight"**
> (reward-heavy дэлгэцүүдийг эзэмшдэг тул celebration ажил байгалиасаа түүнд таарна).
> Тэнцвэртэй бөгөөд зөрчилгүй.
