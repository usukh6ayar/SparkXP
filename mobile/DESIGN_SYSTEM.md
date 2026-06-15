# SparkXP — Design System (Modern Mongol)

> Figma-д барих **бүрэн design system spec**. Art direction: **Modern Mongol** —
> гүн индиго премиум суурь + дулаан алт, **үнэг mascot**. Onest typography.
> Дараа нь энэ токенуудыг `src/theme/theme.ts`-д 1:1 буулгана.
>
> Хослол: индиго (cool, итгэл) + алт-улбар үнэг (warm, эрч хүч) = complementary,
> премиум боловч тоглоомлог. Cyrillic эхэнд.

---

## 0. Брэнд суурь

- **Mascot:** Үнэг (хэвээр) — премиум, геометр хэлбэрээр дахин зурна. Өнгө: алт-улбар
  (`#F5A524`–`#E07B2E`), индиго суурин дээр тод харагдана. Зөвхөн зан төлөвт
  (AI Найз, баяр хүргэх, empty state) — UI icon болгож хэрэглэхгүй.
- **Tone of voice:** дэмжсэн, найрсаг, богино. Монгол primary.
- **Нэр:** одоохондоо "SparkXP" (эцсийн нэр TBD — § 11).

---

## 1. Color — Primitives (түүхий өнгө)

> Figma: `Color / Primitives` collection. Эдгээрийг шууд бүү хэрэглэ — § 2 semantic
> token-оор дамжуул.

| Нэр | Hex | | Нэр | Hex |
|---|---|---|---|---|
| Indigo 50 | `#ECECFB` | | Ink 900 | `#0E1430` |
| Indigo 100 | `#DCDCF7` | | Ink 800 | `#161C3A` |
| Indigo 300 | `#A9A9EE` | | Ink 700 | `#1F274A` |
| Indigo 500 | `#5B5BD6` | | Slate 600 | `#4A5170` |
| Indigo 600 | `#4646B8` | | Slate 400 | `#8A90A8` |
| Indigo 700 | `#3A3A99` | | Slate 200 | `#D7DAE6` |
| Gold 400 | `#F5C451` | | Slate 100 | `#E8EAF2` |
| Gold 500 | `#E8A317` | | Cloud 50 | `#F5F6FB` |
| Fox 500 | `#F5A524` | | Cloud 100 | `#EDEFF7` |
| Fox 600 | `#E07B2E` | | White | `#FFFFFF` |
| Teal 500 | `#16B8A6` | | Green 500 | `#1FA463` |
| Cyan 500 | `#22C3E6` | | Red 500 | `#E5484D` |
| Flame 500 | `#FF7A45` | | | |

---

## 2. Color — Semantic tokens (эдгээрийг хэрэглэ)

> Figma: `Color / Semantic` collection, **Light** mode (Dark mode § 10).

### Brand & action
| Token | Утга | Hex |
|---|---|---|
| `primary` | Гол үйлдэл, line, focus | `#5B5BD6` |
| `primaryPressed` | Дарсан төлөв | `#4646B8` |
| `primarySoft` | Tint bg (chip, highlight) | `#ECECFB` |
| `accent` | Алт — онцлох, reward | `#F5C451` |
| `accentSoft` | | `#FCF3D8` |

### Surface
| Token | Утга | Hex |
|---|---|---|
| `background` | Аппын суурь | `#FFFFFF` |
| `surface` | Зөөлөн карт/input | `#F5F6FB` |
| `surfaceAlt` | Дарсан/nested | `#EDEFF7` |
| `inkSurface` | Хар hero карт, nav | `#0E1430` |
| `inkSurfaceAlt` | Хар дотор давхарга | `#1F274A` |

### Text
| Token | Утга | Hex |
|---|---|---|
| `text` | Гол текст | `#0E1430` |
| `textSecondary` | Хоёрдогч | `#4A5170` |
| `textMuted` | Caption, hint | `#8A90A8` |
| `textOnInk` | Хар дээрх текст | `#FFFFFF` |
| `textOnInkMuted` | Хар дээрх хоёрдогч | `#AEB4CC` |

### Border
| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `border` | `#E8EAF2` | | `borderStrong` | `#D7DAE6` |

### Semantic
| Token | Hex | Soft |
|---|---|---|
| `success` | `#1FA463` | `#E5F6EE` |
| `danger` | `#E5484D` | `#FCEBEC` |
| `warning` | `#E8A317` | `#FCF3D8` |

### Gamification (тус бүр өөр ойлголт)
| Token | Утга | Hex |
|---|---|---|
| `xp` | XP — насан туршийн прогресс | `#F5C451` (алт) |
| `sparks` | Очирхон — зарцуулагддаг эрдэнэ | `#22C3E6` (cyan) |
| `streak` | Цуврал — гал | `#FF7A45` (flame) |
| `level` | Түвшин | `#5B5BD6` (индиго) |

### Category tints (lesson / game / icon tile)
| Tint | bg | fg |
|---|---|---|
| indigo | `#ECECFB` | `#4646B8` |
| teal | `#DEF6F3` | `#0E9C8A` |
| gold | `#FCF3D8` | `#B8860B` |
| coral | `#FDE9E6` | `#D14B3A` |
| violet | `#F1E9FB` | `#7C3AED` |
| green | `#E5F6EE` | `#15924F` |

### CEFR level → tint
`A1→green · A2→gold · B1→teal · B2→indigo · C1→violet · C2→coral`

---

## 3. Typography — Onest

> Figma: текст styles. Fallback фонт: Manrope. Системийн фонт биш — Onest-г
> `expo-font`-оор оруулна (Cyrillic бүрэн). Weights: 400/500/600/700/800.

| Style | Size / Line | Weight | Хэрэглээ |
|---|---|---|---|
| `display` | 30 / 36 | 800 | Hero тоо, баяр хүргэх |
| `h1` | 24 / 30 | 700 | Дэлгэцийн гарчиг |
| `h2` | 20 / 26 | 700 | Section header |
| `h3` | 17 / 24 | 600 | Карт/мөрийн гарчиг |
| `bodyL` | 16 / 24 | 400 | Урт текст (chat, lesson) |
| `body` | 15 / 22 | 400 | Үндсэн текст |
| `bodyStrong` | 15 / 22 | 600 | Товчны label, чухал утга |
| `label` | 13 / 18 | 600 | Field label, chip |
| `caption` | 12 / 16 | 500 | Caption, hint, meta |
| `overline` | 11 / 14 | 700 | UPPERCASE, tracking +0.5 |

**Дүрэм:** бүгдийг 800 болгохгүй. Hierarchy = size + weight контраст. Хамгийн
том 30px. Cyrillic урт үг wrap-д тэвчээртэй (`numberOfLines` + ellipsize).

---

## 4. Spacing · Radius · Elevation

**Spacing (4pt):** `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`
- Дэлгэцийн gutter: **16**. Section хоорондын зай: **24**. Карт padding: **12–16**.

**Radius:** `sm 8 · md 12 · lg 16 · xl 20 · full 999`
- Карт **16**, товч **12**, chip/pill **full**, hero **20**.

**Elevation (индиго өнгөтэй зөөлөн сүүдэр):**
| Token | Y | Blur | Color |
|---|---|---|---|
| `sm` | 2 | 8 | `rgba(14,20,48,0.06)` |
| `md` | 6 | 20 | `rgba(14,20,48,0.10)` |
| `lg` | 12 | 32 | `rgba(14,20,48,0.14)` |

> Сүүдрийг хэмнэлттэй. Жагсаалтын карт = border (`#E8EAF2`), floating элемент = `md`.

---

## 5. Iconography

- **Сет:** Lucide (premium, нэг хэв маяг — Linear/Stripe мэдрэмж).
  RN: `lucide-react-native`. _Одоо код Ionicons ашиглаж байгаа — солих нь дараагийн task._
- Stroke 2px (`md` дэлгэцэд size 20–24, mini 16). Идэвхтэй = `primary`, идэвхгүй = `textMuted`.
- **Emoji-г UI icon болгож хэрэглэхгүй.** Зөвхөн mascot/character.
- Хэмжээ: 16 (inline) · 20 (default) · 24 (tab/header).

---

## 6. Component library (Figma + RN)

> Component бүрийг variant/state-тэйгээр Figma-д. RN дахь нэр `src/components/`.

### 6.1 Text
- Prop: `variant` (§3), `color`, `center`. Бүх текст энүүгээр.

### 6.2 Button
- Variant: `primary` (индиго fill) · `secondary` (индиго outline) · `ghost` ·
  `inverse` (хар дээр цагаан fill).
- Size: `lg` (52h) · `md` (44h) · `sm` (36h). Radius 12.
- State: default / pressed (scale .99, darken) / disabled (.45) / loading.
- Optional leading icon. Full-width default.

### 6.3 Card
- Variant: `flat` (border) · `raised` (elevation.sm) · `filled` (surface) ·
  `ink` (хар hero). Radius 16, padding 12/16. Tappable = press state.

### 6.4 Pill / Tag
- full radius, optional icon. Жишээ: level (A2), үнэ (Очирхон), "Үнэгүй".

### 6.5 IconTile
- Tinted дугуй квадрат (radius 12) + Lucide icon. Size 38/44/48. Category tint хос.

### 6.6 StatCard
- IconTile + value (`h2`) + label (`caption`). Хэвтээ, нягт. XP/Sparks/Streak.

### 6.7 ProgressBar / Ring
- Bar: track + fill, h 8, full radius. Ring: level/daily goal-д (хувь %).

### 6.8 SectionHeader
- `h2` зүүн + "Бүгд" холбоос баруун.

### 6.9 ListRow
- Lucide icon + label (`bodyStrong`) + optional value + chevron. Settings, цэс.

### 6.10 Input (TextField / SelectField)
- Label (`label`) + field (52h, border 1.5, radius 12, surface bg).
- State: default / focus (primary border) / error (danger + мессеж) / disabled.

### 6.11 TopBar
- Back (chevron, 36 surface квадрат) + title (`h1`) зүүн · streak/sparks badge баруун.

### 6.12 TabBar
- 4 таб + төвд floating үнэг товч (AI Найз). Идэвхтэй индиго, идэвхгүй muted.

### 6.13 EmptyState / Skeleton / Toast
- Empty: үнэг + гарчиг + тайлбар + CTA. Skeleton: surface shimmer.
  Toast: success/danger, дээрээс.

### 6.14 Chip group / Segmented
- Leaderboard period (segmented) + scope (chip). Идэвхтэй индиго/хар.

---

## 7. Screen layouts (шинэ систем)

> Бүгд: SafeArea + 16 gutter + loading/empty/error state.

1. **Onboarding** — 2–3 слайд (зураг + h1 + body + dots) → "Эхлэх". Хар эсвэл индиго gradient hero, доор цагаан sheet.
2. **Auth (Login/Register)** — лого, h1, Input-ууд, primary Button, доор холбоос. Register-д аймаг/дүүрэг Select (UB→дүүрэг).
3. **Home** — мэндчилгээ (h1) · **hero карт** (`ink`): streak chip + өдрийн зорилго + CTA · 3 StatCard (XP/Sparks/Streak) · "Юу сурах?" 2-багана IconTile сүлжээ.
4. **Lessons** — дугаарласан module карт: tint thumb (№) + title + desc + level/үнэ pill + lock/chevron.
5. **Lesson detail** — толгой (title + level + үнэ) · контент блок (jsonb) · түгжээтэй бол unlock sheet (Очирхон үлдэгдэл).
6. **Review (SRS)** — прогресс бар · карт (үг → эргүүлэх) · Again/Hard/Good/Easy (4 өнгөт товч).
7. **Swipe** — прогресс · карт стек (next peek) · ✗ / ↺ / ✓ дугуй товч.
8. **Soril** — 2-багана тоглоом карт (IconTile + XP pill) · доор хар "өдрийн сорил" + ProgressBar.
9. **Quiz** — толгой прогресс · асуулт (`h2`) · сонголт (radio карт, сонгосон=индиго) · доод primary Button · үр дүн дэлгэц (оноо + XP).
10. **AI Найз (chat)** — дүр сонголт (хэвтээ) · bubble (AI=surface зүүн, user=индиго баруун) · input bar (mic + send).
11. **Leaderboard** — segmented (хугацаа) + chip (scope) · "миний байр" хар карт · мөр (rank badge: алт/мөнгө/хүрэл top3) + нэр + XP.
12. **Profile** — толгой (avatar + нэр + level pill + edit) · 3 StatCard · "мэдэх үг" карт · хар leaderboard banner · achievement (earned/locked) · settings ListRow.

---

## 8. Figma файлын бүтэц

```
📄 SparkXP — Design System
├─ 0 · Cover
├─ 1 · Foundations   (Color primitives+semantic, Type, Spacing, Radius, Elevation, Grid)
├─ 2 · Icons         (Lucide subset + mascot pose-ууд)
├─ 3 · Components     (§6 бүгд, variant/state property-тэй)
├─ 4 · Onboarding & Auth
├─ 5 · App screens    (Home → Profile, §7)
└─ 6 · Prototype      (flow холболт)
```

**Variables (Figma):**
1. `Color/Primitives` → `Color/Semantic` (alias). Modes: **Light** (одоо) + **Dark** (дараа).
2. `Number/Spacing` (4…48), `Number/Radius` (8…999).
3. Text styles → §3. Effect styles → §4 elevation.

**Grid:** 4pt baseline. Дэлгэц 16 margin, 4-багана (gutter 16). Frame: iPhone 16 (393×852) primary; SE (375×667) + Pro Max (430×932)-д шалга.

---

## 9. Accessibility

- Контраст ≥ 4.5:1 (текст). Индиго `#5B5BD6` цагаан дээр = 4.6:1 ✓. Алт дээр **хар** текст (алт дээр цагаан унших боломжгүй).
- Hit target ≥ 44×44. Focus ring (primary, 2px) клавиатур/switch-д.
- Зөвхөн өнгөөр мэдээлэл дамжуулахгүй (icon/текст давхар). Dynamic type тэвчнэ.

---

## 10. Dark mode (дараа)

- `inkSurface #0E1430` → суурь. surface `#1F274A`. text → `#FFFFFF`/`#AEB4CC`.
- primary бага зэрэг тодруулна (`#6E6EE6`). Figma Light/Dark mode-оор token swap.

---

## 11. Шийдвэрүүд (баталгаажсан 2026-06-09)

- [x] **Аппын нэр:** **SparkXP** хэвээр (visual identity л шинэ, mascot үнэг).
- [x] **Фонт:** **Onest** (Cyrillic бүрэн, OFL үнэгүй). Fallback Manrope.
- [x] **Icon сет:** **Lucide** (`lucide-react-native`). Ionicons-оос солих = дараагийн код task.
- [x] **Dark mode:** энэ phase-д **үгүй** — light mode-д төвлөрнө, token-г dark-д бэлэн нэрлэнэ.

---

## 12. Token → код map (Figma дууссаны дараа)

| Figma | Код (`theme.ts`) |
|---|---|
| Color/Semantic | `colors.*` |
| Number/Spacing | `spacing.*` |
| Number/Radius | `radius.*` |
| Text styles | `typography.*` |
| Effect styles | `elevation.*` |
| Components | `src/components/*` |

> Figma-гийн нэрсийг код token-той **яг ижил** нэрлэ (`primary`, `surface`, `h2`...)
> — буулгахад шууд таарна.
