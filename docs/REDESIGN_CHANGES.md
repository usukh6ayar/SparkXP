# SparkXP — Redesign өөрчлөлтийн тэмдэглэл (Boju)

> Огноо: **2026-07-29** · Branch: `boju` · Эх сурвалж: `docs/Redesign.pdf` (v2.0, "one light source")
> Төлөв: **tsc + eslint цэвэр** (0 error). Бүх өөрчлөлт **зөвхөн visual/layout** — data, navigation, handler хэвээр.

Энэ баримт нь энэ session-д хийсэн UI redesign болон Home-ийн толгойн тохируулгуудыг нэгтгэнэ.

---

## 0. Суурь — §1 Token davharga
`mobile/src/theme/theme.ts`-ийн token утгууд (4 палитр, шинэ token, typography, radius)
**өмнө нь орсон байсан** (REDESIGN V2.0). Тиймээс энэ ажил нь spec-ийн **component/screen хагас**
(§2–§3.2b) дээр төвлөрсөн.

---

## 1. Profile дэлгэц (§3.3) — `app/(tabs)/profile.tsx`

**Status card руу нэгтгэсэн** (hero + stats + actions → нэг `radius.xl` card):
- **Crown gradient** дээд тал: avatar (XP progress ring + level badge) · нэр + `@username`
  · CEFR chip · байршил chip (province · district) · **edit ✏️ + Share** товч баруун дээд.
- **4 stat** доор нь, ижил border дотор — тус бүр **icon (flame/gem/trophy/book) + тоо + шошго**
  (Өдөр дараалал · Очирхон · Сорил · Хичээл).
- Функц хэвээр: зураг солих (`pickPhoto`), `EditProfileModal`, Share, бодит `gamification` дата.
- Ашиглагдахгүй болсон import/style цэвэрлэсэн (`Pill`, `Button`, `ROLE_TKEY`, hero styles).

---

## 2. Home дэлгэц (§3.1) — `app/(tabs)/index.tsx`

### 2a. Бүтэц (§3.1 mockup дагуу)
- **Continue card = `elevation.float`** — Home-ийн цорын ганц "гэрэлтэх" primary элемент.
- **Хоёр next-step хагас tile**: Давтах үг (due badge) · Даалгавар (enrolled бол).
- **2×2 том gradient skill tile** ("Юу сурах вэ?") — өмнөх жижиг хавтгай 4-row-г сольсон;
  `skillGradients` ашиглаж, count-тэй (материал/дасгал).
- **"Бас үзээрэй" хэвтээ rail** — IELTS + Хэлц үг.
- Дараалал: Continue → өдрийн зорилт → tiles → skill grid → rail.

### 2b. Толгойн стат хэсэг (олон дахин тохируулсан)
- **Subtitle устгасан** ("Өнөөдөр шинэ зүйл сурч…").
- **3 өнгөт стат карт** нэг эгнээнд, greeting-ийн доор: 🔥 Streak · ⚡ XP · 💎 Очирхон —
  тус бүр **өнгөт border + icon-tile (гэрэлтэй glow) + тоо** (зөвхөн icon+тоо, шошгогүй).
- **Icon glow** — flame/bolt/diamond тус бүрдээ өнгөт shadow (iOS), tile 44 + icon 34.
- Icon+тоог картын **төвд** байрлуулсан (богино "1" зайтай харагдахгүй).
- **Hearts pill** — баруун талд, үнэгний дээд тэнгэр дээр **хөвж**: дээр 5 зүрх, доор
  `✦ N/max Зүрх ⓘ`; дархад hearts sheet нээнэ; улаан glow.
- **Үнэгийг доошлуулсан** (`HEADER_RESERVE` 106→200) — стат картуудтай давхцахгүй болгосон.
- **Streak freeze устгасан** — streak картыг дархад "Streak мөстөх" sheet гарахгүй болгож,
  `StreakFreezeSheet`-ийн Home доторх дуудлага/state/import-ыг авсан.
  ⚠️ *Feature-ийн component файл хэвээр; хэрэгтэй бол өөр газраас нээж болно.*

---

## 3. Lessons map (§3.2) — `app/(tabs)/lessons.tsx`

Island-уудыг **4 төлөв**-т оруулсан (өмнө зөвхөн locked/unlocked):
- **ЭНД БАЙНА (current)** — зөөлөн pulsing violet halo + waypoint chip + ringed label card;
  тухайн island руу **автоматаар scroll**.
- **Mastered** — gold star badge + ногоон (success) done/total + track.
- **Unlocked** — level badge + progress.
- **Locked** — label card `lockedSurface / lockedInk` (opacity биш — текстийн контраст хадгална).
- ⚠️ *"Явсан/үлдсэн зам" (ahead-trail) бүдгэрүүлэлтийг нэмсэн боловч бүх өргөний dark band
  үүсгэж байсан тул **буцааж авсан** (хар зураас засвар). Хэрэгтэй бол зөвхөн замын шугам дээр
  нарийхан хийж болно.*

---

## 4. Node path (§3.2b) — `app/level/[code].tsx`

Node-уудыг **4 төлөв**-т оруулсан:
- **Mastered** — ногоон fill + цагаан check.
- **Current** — `primaryGradient` fill + pulsing glow ring + "ЭНД" flag.
- **Unlocked** — surface fill + `borderStrong` ring + дугаар.
- **Locked** — `lockedSurface` fill + `lockedInk` lock, ring-гүй.
- Trail bead: current-аас дээших нь **muted** (travelled/ahead).
- Ашиглагдахгүй болсон код (`lessonXp`, `NEXT_XP`, dead styles) цэвэрлэсэн.

---

## 5. i18n — `src/i18n/index.ts`
Шинэ түлхүүрүүд (MN + EN): `learnEyebrow`, `whatToLearn`, `alsoTry`, `materialCount`,
`youAreHere`, `youAreHereShort`, `unitDays`, `heartsLabel`.

---

## Өөрчилсөн файлууд
```
mobile/app/(tabs)/index.tsx      — Home
mobile/app/(tabs)/lessons.tsx    — Lessons map
mobile/app/(tabs)/profile.tsx    — Profile
mobile/app/level/[code].tsx      — Node path
mobile/src/i18n/index.ts         — шинэ i18n түлхүүрүүд
```

## Тест
- `npx tsc --noEmit` — **0 error** (бүх файл).
- `eslint --quiet` — **0 error** (өмнөх `exhaustive-deps` warning-ууд минийх биш).
- ⚠️ Бодит утсан дээр (Expo Go) харж баталсан — олон тохируулга нь screenshot-аар давтагдсан.

---

## Үлдсэн / Blocked
- **Profile trophy case (§3.3)** — 100-цомын tier систем: **backend achievements API + trophy PNG
  asset** хэрэгтэй (одоо байхгүй; spec өөрөө "open question").
- **Node path chapter grouping + hexagon chapter-test** — зориудаар орхисон (урсдаг trail хангалттай).
- **commit + PR** — хийгээгүй (хэрэглэгчийн зөвшөөрлөөр commit хийнэ).

---

## Өмнө нь (энэ session, аль хэдийн merged — PR #184)
- Сорил Duolingo болгосон: дуу (WAV, default OFF), shake, доод sticky feedback panel.
- Зүрхний UI (hearts): bar, refill/wait дэлгэц, re-ask queue, сүлжээ reconcile.
- IELTS Plan 3b — Writing/Speaking практик дэлгэц.
- Buddy chat starter prompts (C3).
- `docs/STORE_LISTING.md` draft.
