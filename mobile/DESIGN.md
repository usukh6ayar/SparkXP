# SparkXP Mobile App Design System

## Design Philosophy

SparkXP бол Монгол сурагчдад зориулсан gamified English learning app.

UI нь:

- Duolingo-ийн motivation
- Quizlet-ийн clarity
- Superhuman-ийн premium feel
- Apple-ийн cleanliness

зэргийг хослуулсан байна.

Үндсэн зорилго:

- Хичээл хийхэд амархан
- Хүүхэд, оюутан, насанд хүрэгчдэд ойлгомжтой
- Gamification мэдрэмж өндөр
- Premium боловч хэтэрхий хүүхдийн биш

---

# Visual Style

## Keywords

- Clean
- Modern
- Friendly
- Premium
- Gamified
- Soft
- Spacious

---

# Theming — Light / Dark (ЭНЭ ХЭСГИЙГ ЗААВАЛ УНШ)

> **Гол дүрэм:** Settings дэх appearance toggle-ийг (☀️ Light / 🌙 Dark) дарахад
> **дэлгэц дээрх БҮХ дизайны элемент** (background, card, текст, border, track,
> divider, icon tint …) дагаад солигдох ёстой. Ганц ч hardcode хийсэн өнгө
> үлдээж болохгүй — үлдвэл тэр элемент горим солиход "гацна".

## Яаж ажилладаг (архитектур)

Өнгөний **ганц эх сурвалж (single source of truth)** нь `mobile/src/theme/theme.ts`.
Тэнд хоёр palette тодорхойлогдсон:

- **`appThemes`** = `{ dark, light }` — апп даяарх ерөнхий palette (`AppColors`).
  Ихэнх дэлгэц / компонент үүнийг ашиглана.
- **`premiumThemes`** = `{ dark, light }` — Profile / Settings маягийн "premium
  surface" дэлгэцүүдийн palette (`PremiumPalette`).

Идэвхтэй горимыг хадгалж, солих логик нь `mobile/src/settings/SettingsContext.tsx`.
Сонголт **AsyncStorage**-д хадгалагдаж, апп дахин нээхэд сэргэдэг. Default = **dark**.

## Дэлгэц / компонент дотор өнгийг ЯАЖ авах вэ

Screen эсвэл component дотор өнгийг **hook-оор** ав — импортоор биш:

```tsx
import { useColors } from '../src/settings/SettingsContext'; // ерөнхий palette
// эсвэл
import { useTheme } from '../src/settings/SettingsContext';  // premium palette

function Screen() {
  const c = useColors();            // идэвхтэй (light/dark) palette
  const styles = makeStyles(c);     // style-г palette-аас БҮТЭЭ
  return <View style={styles.card} />;
}
```

- ✅ `const c = useColors()` → `c.background`, `c.text`, `c.surface`, `c.border` …
  Toggle солиход энэ компонент дахин render хийгдэж, шинэ өнгө автоматаар орно.
- ✅ StyleSheet-ээ palette-аас бүтээ (`makeStyles(c)`) эсвэл inline `style={{ color: c.text }}`.
- ❌ `import { colors } from '.../theme'` дараа `colors.background` гэж
  **шууд ашиглаж болохгүй** — энэ бол dark горимд царцсан статик утга,
  toggle-ийг дагахгүй.
- ❌ `'#191040'`, `'#FFFFFF'` гэх мэт hex-ийг дэлгэцэнд шууд бичиж болохгүй.

> **Legacy тэмдэглэл:** `theme.ts` доторх экспортлосон `colors` объект нь
> `appThemes.dark`-тай тэнцүү бөгөөд зөвхөн **шилжүүлж амжаагүй хуучин дэлгэцүүд**
> ажилласаар байхын тулд үлдээсэн. Шинэ болон засварласан код **заавал**
> `useColors()` / `useTheme()` ашиглана. `static colors` импорт = migration өр.

## Одоогийн migration статус (2026-07)

Theme дэд бүтэц бэлэн, гэхдээ дэлгэцүүд бүрэн шилжиж амжаагүй:

- ✅ `useColors()` / `useTheme()` reactive-аар ашигладаг: ~16 файл (солигддог).
- ⚠️ static `colors`-г шууд импортолсон: ~56 файл (dark-д царцсан, солигдохгүй).

**Definition of done (light/dark бүрэн ажиллаж дуусах):** аппын аль ч дэлгэц дээр
static `colors` импорт үлдээгүй, бүх screen `useColors()`/`useTheme()`-аар өнгө
авдаг болсон үед л "элемент бүр дагаж солигдоно" гэсэн шаардлага биелнэ. Энэ
migration нь `theme.ts` + `src/components/*` (shared файлууд) хамардаг тул
багтай зохицуулж, жижиг PR-аар хийнэ (`TEAM_WORKFLOW.md`).

## Семантик токен зарчим (өнгийг УТГА-аар нь нэрлэ)

Toggle-г дагаж зөв солигдохын тулд токенийг **утгаар** (intent) нь ашигла,
шаталсан hex-ээр биш. Ижил токен light/dark хоёулаа "зөв" харагдана:

| Токен (`useColors()`)       | Утга / хаана                                  |
| --------------------------- | --------------------------------------------- |
| `background`                | Дэлгэцний суурь дэвсгэр                        |
| `backgroundGradient`        | Дэвсгэрийн градиент (2 өнгө)                   |
| `surface`                   | Карт / өргөгдсөн гадаргуу                      |
| `surfaceAlt`                | Хоёрдогч гадаргуу — input, chip, track        |
| `text`                      | Үндсэн текст (эрчимтэй)                        |
| `textSecondary`             | Хоёрдогч текст                                 |
| `textMuted`                 | Caption / hint / идэвхгүй                      |
| `border` / `borderStrong`   | Зөөлөн / хүчтэй хүрээ                          |
| `primary` / `primaryGradient` | Brand үйлдэл, CTA, XP, active state          |
| `success` `warning` `danger`| Семантик төлөв                                |
| `xp` `sparks` `streak`      | Gamification accent                            |

**Brand / gamification / semantic өнгө** (`primary`, `success`, `xp`, `streak`,
`sparks`, `danger`…) light/dark хоёулаа **ижил** байна — зөвхөн гадаргуу, текст,
хүрээ ялгаатай. Тиймээс горим солиход брэнд царай хадгалагдана.

---

# Color System (Light / Dark palette)

> Утгууд `theme.ts`-тэй тааруулагдсан. `theme.ts` = эх сурвалж; энэ хүснэгт бол
> лавлагаа. Зөрвөл `theme.ts` зөв.

## Brand — Primary (Purple) — light/dark ижил

- Primary 500: `#6C3BFF`
- Primary 600 (dark): `#5A28F0`
- Primary 700 (pressed): `#4B1ED8`
- Gradient: `#7A4DFF → #6C3BFF → #5A28F0`
- Glow / halo: `#9D7BFF`

Хэрэглээ: CTA товч, progress, XP, active state.

## Semantic — light/dark ижил

- Success (green): `#34D399` — дууссан хичээл, reading category
- Warning / Streak (orange): `#FF8A3D` — streak, өдрийн mission
- Info (blue): `#4FC3F7` — writing category, статистик
- Danger (red): `#F87171`

## Gamification accent — light/dark ижил

- XP (gold): `#FFC93C`
- Sparks / Очирхон (gem blue): `#4FC3F7`
- Streak (orange): `#FF8A3D`

## Гадаргуу ба текст (горим бүрд ялгаатай)

| Токен              | 🌙 Dark (default) | ☀️ Light   |
| ------------------ | ----------------- | ---------- |
| `background`       | `#191040`         | `#F4F2FC`  |
| `backgroundGradient` | `#1B1147→#2A1A5E` | `#F4F2FC→#FFFFFF` |
| `surface` (card)   | `#2A1E5C`         | `#FFFFFF`  |
| `surfaceAlt`       | `#372A7A`         | `#EFEBFA`  |
| `text`             | `#FFFFFF`         | `#1A1430`  |
| `textSecondary`    | `#B9A9E6`         | `#5A5470`  |
| `textMuted`        | `#8E80BC`         | `#8A83A8`  |
| `border`           | `#3D2F73`         | `#E4DFF4`  |
| `borderStrong`     | `#4A3A85`         | `#D5CEEC`  |

`textOnDark` / `textOnDarkMuted` нь өнгөт гадаргуу (primary товч гэх мэт) дээр
суудаг тул хоёр горимд **цайвар хэвээр** үлдэнэ.

---

# Typography

Font:

- Inter
- SF Pro

| Style   | Size | Weight   | Хэрэглээ                 |
| ------- | ---- | -------- | ------------------------ |
| display | 30   | 800      | Hero тоо / баяр хүргэлт   |
| h1      | 24   | 800      | Дэлгэцний гарчиг          |
| h2      | 19   | 700      | Секцийн гарчиг            |
| h3      | 16   | 700      | Карт / мөрийн гарчиг      |
| body    | 15   | 400      | Үндсэн текст              |
| bodyStrong | 15 | 600     | Товчны шошго, түлхүүр утга |
| label   | 13   | 600      | Талбарын шошго, chip      |
| caption | 12   | 500      | Caption, hint             |
| overline | 11  | 700      | UPPERCASE eyebrow / tag   |

Текстний өнгийг `typography.*` дотор битгий царцаа — screen дотор
`useColors()`-оос `c.text` / `c.textMuted` өг (light/dark дагахын тулд).

---

# Border Radius

- Small: 12
- Medium: 16 / 20
- Large: 28
- Hero Cards: 28–32
- Floating Avatar / full: 999

---

# Shadows / Elevation

Elevation нь **горимоос хамаарна**:

- **Light** горимд: сонгодог зөөлөн хар сүүдэр — `0 8 24 rgba(0,0,0,0.06)`.
- **Dark** горимд: хар сүүдэр харагдахгүй тул картыг **зөөлөн ягаан гэрлээр**
  (`#9D7BFF` glow) "хөвүүлнэ". Floating элемент (FAB / төв таб) арай хүчтэй
  primary glow-той.

Хатуу хар хүрээ (harsh border) хэзээ ч бүү хэрэглэ.

---

# Spacing

Base unit: **8px** (4pt scale-тэй нийцүүлсэн).

Common: 4 · 8 · 12 · 16 · 20 · 24 · 32

- `lg` (16) = дэлгэцний default gutter.
- Cramped layout-аас зайлсхий. Том цагаан зай (whitespace) урамшуулна.

---

# Components

## Buttons

Primary

- Purple gradient (`primaryGradient`)
- White text
- Radius ~18

Secondary

- Surface background (`surface`)
- Purple border (`primary`)

Ghost

- Transparent
- Purple text (`primary`)

## Cards

Бүх карт:

- `surface` дэвсгэр (light = цагаан, dark = өргөгдсөн ягаан)
- Radius ~20–24
- Зөөлөн elevation (горимоор)

Хатуу хүрээ бүү хэрэглэ.

## Lesson Card

Агуулга: Lesson number · Illustration · Title · Description · Skill tag · Progress state.

Төлөв: Locked · Available · In Progress · Completed.

## XP Card

Hero component. Агуулга: Daily XP Goal · Progress Bar · Mascot. Gradient background.

## Achievement Card

Visual priority: 1) Badge 2) Title 3) Description. Том өнгөлөг 3D icon.

## Bottom Navigation

- Height: 88–96
- Style: Floating
- Background: `surface`
- Shadow: зөөлөн (горимоор)
- Center: Spark Fox mascot button — бусад таб-аас том.

---

# Mascot Guidelines

Character: **Spark Fox**

Rules: Always smiling · Friendly · Confident · Purple hoodie.

Never: Angry · Sad · Aggressive.

Use mascot in: Home Hero · AI Friend · Lesson Completion · Empty States.

---

# Gamification

Core Rewards: XP · Gems (Sparks) · Streaks · Achievements.

Reward feedback дор: Animation · Glow · Scale effect.

Амжилттай үйлдэл бүр урамшуулсан мэдрэмж төрүүлэх ёстой.

---

# Accessibility

- Minimum touch area: 44×44
- Text contrast: WCAG AA
- Цагаан дэвсгэр дээр цайвар саарал текст (light горим) бүү хэрэглэ; харанхуй
  дэвсгэр дээр бүдэг лаванда текстийг хэт бага контрасттай бүү болго.
- Light/dark аль алинд контраст шалга — токен солиход контраст алдагдаж
  болзошгүй.

---

# Motion Design

- Duration: 200–300ms
- Use: Scale · Fade · Slide
- Avoid: Bounce overload · Excessive rotation
- Motion premium мэдрэмжтэй байх ёстой.
