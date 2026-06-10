# SparkXP — UI/UX Дизайн Brief (Mini-Project Requirement)

> Оюутны mobile аппын UI/UX-г **шинээр** зохиоход зориулсан шаардлагын баримт.
> Эх сурвалж: `CLAUDE.md`, `ROADMAP.md`, `MOBILE_ROADMAP.md`, `ROLES.md` + одоогийн код.
> Зорилго: Duolingo / Quizlet / Khan Academy түвшний **production-ready** харагдац.

---

## 1. Зорилго (Goal)

Геймжүүлсэн англи хэл сурах аппыг **commercial түвшний** болгох. Одоогийн UI
асуудал: хэт том хэмжээтэй, typography эмх замбараагүй, зай үрсэн, mobile-д
оновчгүй. Шинэ дизайн нь **жижиг дэлгэцэд цэгцтэй, мэдээллийн нягтрал сайтай,
тогтвортой компонент системтэй** байх ёстой.

**Амжилтын хэмжүүр:**
- Бүх дэлгэц нэг design system (token + компонент)-оос угсарсан байх.
- Гол flow (нэвтрэх → сурах → XP авах → leaderboard) 3 товшилтод хүрэх.
- Мянга мянган өдрийн идэвхтэй оюутанд зохистой (scale, readability).

---

## 2. Хэн ашиглах (Target user)

- **Гол хэрэглэгч:** Монгол оюутан/сурагч (16–25), утсаар, Монгол хэл primary.
- Хоёрдогч: сургуулийн сурагч (класстай), байгууллагын ажилтан.
- **Дэлгэц:** зөвхөн `student` роль. Багш/admin = тусдаа web (энэ project-д ороогүй).

---

## 3. Хязгаарлалт (Constraints — CLAUDE.md-ээс заавал)

- **Платформ:** React Native + Expo (Expo Router). iOS + Android.
- **Хэл:** Монгол primary, Англи secondary. Cyrillic-safe фонт.
- **Контент hardcode хийхгүй** — бүгд backend API-аас (`src/api/`).
- **Theme + компонент:** өнгө/зай/фонт зөвхөн `src/theme/theme.ts`-ээс. Дахин
  ашиглах UI зөвхөн `src/components/`-д (DRY).
- Код junior уншиж ойлгохоор, энгийн.
- Voice features = **"Тун удахгүй"** (UI байгаа, логик байхгүй).

---

## 4. Дэлгэцийн жагсаалт + шаардлага (бодит API-тай)

| # | Дэлгэц | Гол агуулга | Backend |
|---|--------|-------------|---------|
| 1 | **Onboarding** (шинэ) | Welcome → түвшин/зорилго асуух → бүртгэл | — |
| 2 | **Login / Register** | Имэйл, нууц үг, нэр, аймаг/дүүрэг picker | `/auth/*` |
| 3 | **Home / Dashboard** | Мэндчилгээ, өдрийн зорилго, XP/Sparks/Streak, сурах замууд | `/users/me/stats`, `/reviews/due` |
| 4 | **Lessons (list)** | Хичээлийн жагсаалт, level/түгжээ/үнэ (Sparks) | `/lessons` |
| 5 | **Lesson detail** | Контент (jsonb), нээх (unlock) | `/lessons/:id`, `/:id/access`, `/:id/unlock` |
| 6 | **Review (SRS)** | Карт эргүүлэх, Again/Hard/Good/Easy | `/reviews/due`, `/reviews/:wordId` |
| 7 | **Swipe (үг сурах)** | Tinder-style карт, мэднэ/мэдэхгүй | `/reviews/*` |
| 8 | **Soril / Games** | Тоглоомын төрлүүд (одоо "тун удахгүй") | — |
| 9 | **Quiz** | Асуулт → хариулах → оноо + XP | `/quizzes/:id/submit` |
| 10 | **AI Найз (chat)** | Текст AI tutor, дүр сонгох | `/ai/chat` |
| 11 | **Leaderboard** | weekly/monthly/all-time × global/аймаг/дүүрэг/класс | `/leaderboard` |
| 12 | **Profile** | Мэдээлэл, статистик, амжилт, тохиргоо, засах | `/users/me` |

---

## 5. Design System шаардлага (хамгийн чухал)

### 5.1 Typography
- **Semantic scale:** `display / h1 / h2 / h3 / body / bodyStrong / label / caption`
  — size + line-height + weight хослуулсан.
- Хамгийн том хэмжээ ≤ 30px (одоо 36px хэт том).
- Weight 400→800 хүртэл ялгаатай (бүгд 800 байхгүй).

### 5.2 Spacing & layout
- 4pt scale. Дэлгэцийн gutter **16px** (одоо 24px хэт өргөн).
- Карт padding 12–16px. Cyrillic урт үг wrap-д тэвчээртэй.

### 5.3 Өнгө (брэнд — § асуулт 1-ийг хар)
- Primary улбар шар `#F47B20`, навигатор хөх `#16213E`, цөцгий, амбер.
- Text emphasis 3 түвшин, semantic (success/danger), soft tint хосууд.

### 5.4 Компонент (бүгд `src/components/`)
- `Text` (semantic), `Button` (size/variant/icon), `Card`, `Pill`,
  `IconTile`, `SectionHeader`, `ProgressBar`, `StatCard`, `TopBar`, `TabBar`,
  `TextField`, `SelectField`, `Loading`, `EmptyState`, `Skeleton`.
- **Icon:** нэг систем (Ionicons), emoji-г UI icon болгож хэрэглэхгүй
  (mascot/character-д л emoji зөвшөөрнө).

### 5.5 Gamification презентаци
- **XP** = насан туршийн прогресс (бар/түвшин). **Sparks** = зарцуулагддаг.
- **Streak** = галын дүрс, өдрийн цуврал. **Achievement** = earned/locked төлөв.
- **Level** = XP-ээс тооцсон түвшин + дараагийн түвшин хүртэлх progress.
- Тэмдэглэл: streak/level одоо placeholder (`5`, `A2`) — бодит болгох эсэхийг § асуулт 3.

---

## 6. Non-functional шаардлага

- **Accessibility:** контраст ≥ 4.5:1, товч hit target ≥ 44px, фонт scale тэвчнэ.
- **Responsive:** жижиг (iPhone SE) → том (Pro Max) дэлгэцэд эвдрэхгүй.
- **State бүр:** loading (skeleton) · empty · error · success — бүх дэлгэцэд.
- **Performance:** жагсаалт FlatList, зураг CDN, гялалзахгүй refresh.
- **Feedback:** товшилтын press state, haptics (сонголт), smooth шилжилт.

---

## 7. Onboarding & progression (шинэ — § асуулт 2)

- Анх нээхэд: 2–3 welcome слайд → бүртгэл.
- Бүртгэлийн дараа: түвшин/өдрийн зорилго сонгох (хувийн болгох).
- Progression: Home дээр "өнөөдрийн зорилго", streak, дараагийн level хүртэл.

---

## 8. Scope-оос гадуур (Out of scope)

- Багш / admin / super_admin дэлгэц (web).
- Voice AI логик (UI "тун удахгүй" хэвээр).
- Төлбөрийн (QPay) live урсгал — Sparks unlock л үлдэнэ.
- Backend өөрчлөлт (зөвхөн одоо байгаа endpoint ашиглана).

---

## 9. Deliverable

- [ ] `theme.ts` — шинэчилсэн token (color, spacing, radius, typography, elevation).
- [ ] `src/components/` — бүрэн компонент систем.
- [ ] Дээрх 12 дэлгэц шинэ дизайнаар, бодит API-тай.
- [ ] tsc цэвэр, бүх state (loading/empty/error) бэлэн.

---

## 10. Шийдвэрүүд (2026-06-09)

| Асуулт | Шийдвэр | Үр дагавар |
|--------|---------|------------|
| Брэнд | **Бүрэн шинэ (Direction A — Modern Mongol)** | Шинэ палитр (гүн индиго + алт), Onest фонт. **Mascot = үнэг хэвээр**, гэхдээ премиум/геометр болгож дахин зурна. |
| Scope | **Бүрэн дахин зохиох** | 12 дэлгэц + onboarding flow. |
| Streak/Level/Achievement | **Дараа ярина** | Одоохондоо visual-д төвлөрнө; placeholder зөвшөөрнө. |
| Арга | **Эхлээд Figma** | Code-оор биш — эхлээд Figma-д design system + mockup, дараа нь RN код руу буулгана. |

### Дараагийн алхам (Figma-first)
1. **Art direction сонгох** — палитр, typography, mascot, shape language (chat-д санал болгосон).
2. **Figma foundation** — token (color/type/spacing/radius/elevation) styles + variables.
3. **Component library** — Text, Button, Card, Pill, Icon, Input, TabBar, StatCard, ProgressBar...
4. **Screen mockup** — Onboarding → Auth → Home → Lessons → Review → Quiz → Chat → Leaderboard → Profile.
5. **Code руу буулгах** — Figma token-г `theme.ts`-д, дэлгэцийг RN-д.
