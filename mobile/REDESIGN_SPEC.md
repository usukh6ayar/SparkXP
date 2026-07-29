# SparkXP Redesign Spec v2.0

> Source: `docs/Redesign.pdf` (2026-07-29), merged into the repo so every dev's
> Claude session can read it. Covers **Home · Lessons · Profile**.
> Design system of record stays `mobile/DESIGN.md` + `mobile/SCREEN_SPECS.md`;
> this file supersedes their **colour/type/radius/elevation values**.

## Merge status (2026-07-29)

| Half | Status |
|---|---|
| §01 token values → `src/theme/theme.ts` | ✅ **landed** |
| §02–§04 component / layout / motion work | ⬜ not started — see §05 |
| `spacing` rename (§1.6) | ⬜ deliberately skipped — see §05 note |
| Static-palette debt (~56 files) | ⬜ not started |

---

## Design thesis

The current app gives every card its own colour, border and glow, so nothing is
louder than anything else and the learner has to read the whole screen to find
the one thing they came to do. This redesign treats the app as a single night
sky with **exactly one light source: the learner's next action.** Glow becomes
scarce and earned — it marks the live thing, never decoration — while everything
else steps back to flat, quiet, evenly-toned surfaces separated by space and
typographic rhythm instead of by colour.

Concretely:

- **Home** resolves to one glowing Continue card that physically overlaps the
  hero, so the artwork becomes a backdrop rather than a boxed banner.
- **Lessons** answers "where am I" with a single pulsing waypoint on a trail
  that is visibly travelled behind you and dim ahead.
- **Profile** becomes a premium status card plus a real trophy case with tier
  progression and a next-goal hook.

Nothing recolours the fixed artwork. The palette is deepened *underneath* it so
the trophies, the fox and the islands read as lit objects on a darker stage.

---

## 01 · Token set

All values live in `src/theme/theme.ts`. Contrast ratios below are computed from
the WCAG 2.1 relative-luminance formula against the **composited** surface
colour, not the alpha value.

### 1.1 appThemes

| Token | Dark | Light | Note |
|---|---|---|---|
| `background` | `#0B0716` | `#F6F4FD` | Deepened to near-black-indigo so island art and glow read as light sources. |
| `backgroundGradient` | `#140B2A → #0B0716` | `#FFFFFF → #F1EDFC` | Vertical, 0→320pt then flat. Sits behind the hero so the scrim has somewhere to land. |
| `surface` | `#171033` | `#FFFFFF` | Default card. Separation without a border. |
| `surfaceAlt` | `#1F1742` | `#F1EDFC` | Nested surfaces, tracks, inactive tabs, sheets. |
| `text` | `#F5F2FF` | `#1A1330` | Never pure white in dark — cuts halation on OLED. |
| `textSecondary` | `#CFC6F0` | `#4A4266` | Body copy, list rows, descriptions. |
| `textMuted` | `#A79BD0` | `#6B6485` | Unchanged by mandate; both re-verified. |
| `textOnDark` | `#FFFFFF` | `#FFFFFF` | Over artwork, gradients and filled buttons **only**. |
| `textOnDarkMuted` | `rgba(255,255,255,.78)` | `rgba(255,255,255,.82)` | Only over a gradient deep stop or a ≥60% scrim — never raw artwork. |
| `border` | `#241C4A` | `#E4DEF5` | 1pt hairline. Decorative in dark. |
| `borderStrong` | `#3D3070` | `#CFC5EC` | Focused inputs, selected chips, the current node ring. |
| `glassBg` | `rgba(23,16,51,.72)` | `rgba(255,255,255,.72)` | expo-blur intensity 40 underneath. Never a bare alpha fill — Android needs the BlurView. |
| `glassBgStrong` | `rgba(23,16,51,.92)` | `rgba(255,255,255,.92)` | Text-bearing glass must use this. |
| `glassBorder` | `rgba(157,123,255,.24)` | `rgba(108,59,255,.14)` | Top edge only where possible. |
| `primary` | `#6C3BFF` | `#6C3BFF` | **Fill only in dark** (3.20:1 on surface). |
| `primaryDark` | `#5A28F0` | `#5A28F0` | Gradient end stop, pressed fill on light. |
| `primaryPressed` | `#4E1FD6` | `#4E1FD6` | Paired with scale .97, not opacity. |
| `primarySoft` | `rgba(108,59,255,.18)` | `rgba(108,59,255,.10)` | Selected chips, ghost-button fill. |
| `primaryGradient` | `#7A4DFF → #6C3BFF → #5A28F0` | same | 135°, stops at 0 / .55 / 1. |
| `glow` | `#9D7BFF` | `#B49BFF` | Dark: shadowColor + the only legal purple text. Light: focus/highlight strokes. |
| `success` | `#34D399` | `#077A52` | Light darkened — the old value was 1.9:1 as text on white. |
| `danger` | `#F87171` | `#C42B2B` | Same reason. |
| `warning` | `#FF8A3D` | `#9E4A0D` | Doubles as `streak` in dark. |
| `xp` / `sparks` / `streak` | `#FFC93C` / `#4FC3F7` / `#FF8A3D` | identical | **Graphic only** — glyph, ring, bar fill. Identical in both to protect recognition. |
| `xpText` / `sparksText` / `streakText` | `#FFD466` / `#7FD4F9` / `#FFA96B` | `#8A5A00` / `#0A6E93` / `#A34A10` | **NEW.** The label-legible forms. |
| `heroScrim` | `rgba(11,7,22,0) → #0B0716` | `rgba(246,244,253,0) → #F6F4FD` | **NEW.** Dissolves artwork into the body. |
| `focusRing` | `#9D7BFF` (6.35:1) | `#5A28F0` (6.43:1) | **NEW.** 2pt ring, 2pt offset. |
| `lockedSurface` | `#150F2B` | `#EDE9F7` | **NEW.** Replaces `opacity: 0.4`. |
| `lockedInk` | `#8B82AD` (5.09:1) | `#6E6884` (4.85:1) | **NEW.** Locked labels. |

### 1.2 premiumThemes — Profile & Settings

Deliberately richer than `appThemes`: a three-stop vertical bg running violet at
the crown and near-black at the tab bar, a card one step lighter than the app
surface, and a violet `cardBorder` at 30% instead of 24%.

| Token | Dark | Light |
|---|---|---|
| `bg` | `#1A0F3D → #100A26 → #07040F` (0 / .42 / 1) | `#FFFFFF → #F4F0FE → #EFE9FC` |
| `bgFlat` | `#0D0720` | `#F8F6FE` |
| `card` | `#221641` | `#FFFFFF` |
| `cardBorder` | `rgba(157,123,255,.30)` | `#E1D8F8` |
| `text` | `#FBF9FF` (15.96:1 on card) | `#160F2B` |
| `textSecondary` | `#D6CCF5` | `#453C63` |
| `textMuted` | `#A79BD0` | `#6B6485` — same as app, so muted copy never shifts across a navigation |
| `primary` | `#7A4DFF` | `#6C3BFF` |
| `primaryLight` | `#A98BFF` (6.21:1 on card) | `#8B6BFF` |
| `track` | `rgba(255,255,255,.10)` | `rgba(22,15,43,.08)` |
| `divider` | `rgba(157,123,255,.18)` | `#EBE5F9` |
| `lockedSurface` / `lockedInk` | `#1B1235` / `#8B82AD` | `#F1EDFB` / `#6E6884` |
| `focusRing` | `#A98BFF` (7.32:1) | `#5A28F0` (6.30:1) |
| `heroScrim` | `rgba(13,7,32,0) → #0D0720` | `rgba(248,246,254,0) → #F8F6FE` |

### 1.3 tints — bg + fg pairs

Category chips, icon tiles, status pills. Dark bg values are alpha over
`surface`. Light tints are identical in both families. `premiumThemes` reuses
the same fg values but should raise dark bg alpha `.16 → .20` (premium card
`#221641` is a step lighter than app surface `#171033`) — **not yet
implemented**, `tintThemes.dark` is used for both.

| Tint | Dark bg | Dark fg | Light bg | Light fg | Contrast |
|---|---|---|---|---|---|
| purple | `rgba(124,77,255,.18)` | `#C4AEFF` | `#EFE9FE` | `#5426D6` | 7.79 / 6.76 |
| green | `rgba(52,211,153,.16)` | `#6EE7B7` | `#E3F7EF` | `#0B7A53` | 8.96 / 4.80 |
| coral | `rgba(248,113,113,.16)` | `#FCA5A5` | `#FDEAEA` | `#B32B2B` | 7.58 / 5.50 |
| blue | `rgba(79,195,247,.16)` | `#93DCFB` | `#E4F4FD` | `#0A6280` | 8.90 / 6.07 |
| amber | `rgba(255,201,60,.16)` | `#FFDD8A` | `#FBF1DC` | `#7A5200` | 9.78 / 6.17 |
| pink | `rgba(244,114,182,.16)` | `#F9A8D4` | `#FCE9F3` | `#A5215F` | 7.82 / 6.06 |
| teal | `rgba(45,212,191,.16)` | `#7EE7DC` | `#E1F6F3` | `#0A6B60` | 9.26 / 5.69 |
| orange | `rgba(255,138,61,.16)` | `#FFB98A` | `#FDEDE2` | `#8F3D0A` | 8.40 / 6.48 |

### 1.4 gradients

`skillGradients` and `progressGradients` are identical across all four palettes
— a deliberate decision, not a gap: they are always white-on-gradient or
gradient-on-track graphics, so re-tinting per theme would only weaken
recognition. Every `skillGradient` runs bright→deep on 135°, and its label
always sits on the **deep stop**, which is what makes white text pass AA.

| Token | Stops | Note |
|---|---|---|
| `skillGradients.listening` | `#4FC3F7 → #1B5FA8` | Сонсох · 6.46:1 |
| `skillGradients.reading` | `#34D399 → #0A6B4A` | Унших · 6.53:1 |
| `skillGradients.speaking` | `#F472B6 → #9A1E63` | Ярих · 7.66:1 |
| `skillGradients.writing` | `#FF8A3D → #A34A10` | Бичих · 5.93:1 |
| `skillGradients.grammar` | `#7A4DFF → #4E1FD6` | Дүрэм · 8.43:1 |
| `skillGradients.fill` | `#FFC93C → #7A5200` | Нөхөж дуусга · 6.92:1 |
| `progressGradients.primary` | `#7A4DFF → #9D7BFF` | Lesson progress, Continue card |
| `progressGradients.success` | `#34D399 → #6EE7B7` | Completed / mastered |
| `progressGradients.xp` | `#FFC93C → #FFE08A` | Daily goal bar, profile XP ring |
| `progressGradients.streak` | `#FF8A3D → #FFB86B` | Streak ring |
| `progressGradients.danger` | `#F87171 → #FCA5A5` | Hearts depleting |
| `progressGradients.onHero` | `rgba(255,255,255,.95) → rgba(255,255,255,.62)` | The only bar allowed directly over artwork |

### 1.5 islandMap

| Token | Dark | Light | Meaning |
|---|---|---|---|
| `green` | `#34D399` | `#10A176` | A1 · A2 |
| `blue` | `#4FC3F7` | `#2790C4` | B1 · B2 |
| `purple` | `#7A4DFF` | `#6C3BFF` | C1 · C2 |
| `gold` | `#FFC93C` | `#E0A100` | The trail, and the mastered star |
| `streak` | `#FF8A3D` | `#EE6F1F` | The "you are here" waypoint pulse |

### 1.6 spacing & radius

| radius | value | use |
|---|---|---|
| `sm` | 10 | chips, pills, small tiles |
| `md` | 14 | buttons, list rows, inputs |
| `lg` | 20 | cards — the default |
| `xl` | 28 | hero card, sheets, the status card |
| `full` | 999 | avatars, rings, hearts, the centre tab |

Spacing in the spec is `xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48`
(gutter 20, 16 on SE; `xxl` only between tiers). **The shipped `spacing` object
was not changed** — the spec's names are the current names shifted one step up,
so writing it in would silently make every existing `spacing.lg` 24 instead of
16. Tracked as a separate codemod in §05.

### 1.7 elevation

| Preset | iOS dark | iOS light | Android | Use |
|---|---|---|---|---|
| `sm` | glow @ .28, r6, y2 | `#1A1330` @ .06, r6, y2 | 2 | Pills, chips, tab bar edge |
| `md` | glow @ .34, r14, y6 | `#1A1330` @ .09, r14, y6 | 5 | Standard card — a violet bloom in dark, not a shadow |
| `float` | glow @ .45, r26, y12 | `#1A1330` @ .14, r24, y12 | 12 + 1pt glassBorder | Continue card, centre AI tab, sheets |

Only the **dark** values landed; the light values need `elevation` to become
theme-aware (§05).

### 1.8 typography

Onest (headings) + Inter (body) kept — both ship full Cyrillic including Өө/Үү.
Sizes are one step smaller than a comparable English-first app and line-heights
one step taller: Mongolian strings run 20–30% longer and Cyrillic descenders
(ц щ у ф) need the leading.

| Token | Size / line / weight / family | Use |
|---|---|---|
| `display` | 34 / 40 / 800 / Onest | Only the greeting and a celebration count |
| `h1` | 27 / 34 / 700 / Onest | Screen titles |
| `h2` | 22 / 28 / 700 / Onest | Section headers, card titles |
| `h3` | 18 / 24 / 600 / Onest | List-row titles, island level names |
| `body` | 15 / 22 / 400 / Inter | Long-form. 15 not 16 — Mongolian needs the width |
| `bodyStrong` | 15 / 22 / 600 / Inter | Buttons, emphasised values |
| `label` | 13 / 18 / 600 / Inter | Pills, chips, tab labels, stat captions |
| `caption` | 12 / 16 / 400 / Inter | Helper text, timestamps, done/total |
| `overline` | 11 / 14 / 700 / Inter, +0.8 tracking | Section eyebrows only |

### 1.10 contrast audit — the two fill-only rules

Everything in the set passes AA 4.5:1 **except** two deliberate fill-only
colours, which the component specs must enforce:

1. `primary #6C3BFF` on dark surfaces (3.20:1 on `surface`, 2.94:1 on
   `surfaceAlt`) — dark-mode purple **text** uses `glow #9D7BFF` (5.79:1).
2. The bright ends of `xp` / `sparks` / `streak` on light surfaces — reward
   **text** uses the `*Text` tokens.

White on `primary` as a filled button is 5.66:1 — fine.

---

## 02 · Component specs (23 components)

Every measurement is in pt. Every interactive row is ≥44pt tall or has a ≥44pt
hitSlop. Where a state is not listed, the component does not have it.

| Component | Anatomy | Key states |
|---|---|---|
| **Button** h52 · r14 · pad20 | Optional 20pt leading icon · label · optional trailing count, centred **as a group** (never space-between — Mongolian labels wrap off-centre otherwise). Min width 120. | pressed `primaryPressed` + scale .97 (no opacity) · disabled `surfaceAlt` + `textMuted` · loading spinner with width frozen at measured width · secondary = surface + borderStrong · ghost = primarySoft |
| **Card** r20 · pad 16–20 | Surface + optional 1pt border + optional elevation. Never a gradient fill unless it is the primary action. | pressed scale .985 + surfaceAlt · disabled lockedSurface + lockedInk · loading Skeleton **at exact final height** · empty EmptyState inside the same frame · error 1pt danger border + retry row |
| **TopBar** h56 + safe area | Back / title / ≤2 actions. Title `h3`, flex:1, tail ellipsis. | transparent over artwork with `textOnDark` · on scroll cross-fades to glassBgStrong + blur 40 + 1pt bottom border over scrollY 0→48 (200ms) · unread bell = 8pt danger dot, no count |
| **CustomTabBar** h64 | Four 44×56 columns (icon 24 + label 11/14) + a centre circle breaking the top edge. Labels **always visible**. | active = primary icon + a 3pt×18pt pill above the icon (not colour alone — colour-blind safe) · centre = primaryGradient + elevation.float + 2pt background-coloured ring · centre pressed scale .94 |
| **StatCard** min-h76 · r14 | Glyph 20 in a tint bg · value `h2` tabular-nums · label `caption`. Left-aligned, never centred. | loading = 48×22 skeleton bar, label stays · zero renders `0` in textMuted, never an em-dash |
| **Pill** h32 · r full | Glyph 14 + value. Over artwork gains glassBg + blur 30 + glassBorder; on a surface a flat tint. | selected primarySoft + borderStrong · locked lockedSurface + lockedInk + 12pt lock · counter animates via CountUp, never a hard swap |
| **ProgressBar** h8 (10 on the primary card) | Track + gradient fill + optional right-aligned caption. Fill has a 2pt inset so the track shows at 100%. | over artwork → `onHero` · complete → success + 14pt check · indeterminate 40%-width fill, 1200ms linear · zero renders the bare track |
| **ProgressRing** 40 / 64 / 112 · stroke 4/6/8 | SVG circle track + gradient arc from 12 o'clock, clockwise, round caps. | complete: arc closes, centre cross-fades to the level number (220ms) · the 112 size is the profile avatar ring, gains a soft glow at ≥90% |
| **HeartsRow** 5 × 22pt · row h44 | Hearts filled left→right. Trailing timer caption when any are empty. Whole row = one 44pt target opening the refill sheet. | spent = 1pt danger **outline**, no fill (grey would read as disabled) · zero = all outlined, row tints dangerSoft, caption "50 Очирхоноор дүүргэх" · unlimited collapses to one heart + ∞ |
| **DailyGoalCard** inline row h56 | **Demoted from a card**: flame · "Өдрийн зорилт" · tabular "30 / 50" · full-width bar beneath. | met: bar turns success, flame lights, one-time RewardBurst · goal-not-set: ghost "Зорилтоо сонго" opening the 20/50/100 sheet |
| **Avatar** 32 / 44 / 64 / 96 | Circular image + 1pt inner border at 10% white. Fallback = initials in Onest 600 on primarySoft — never a generic person glyph. | with ring = wrapped in ProgressRing at +8pt · online = 10pt success dot · editable = 28pt pencil with 44pt hit area |
| **AwardBadge** 84×104 cell · art 72 · r16 | Trophy PNG over a **tier plate** · name caption ≤2 lines · tier hairline. The plate carries the tier colour — artwork is never tinted. | locked = lockedSurface plate + art at 8% luminosity as a **pre-rendered silhouette** (not opacity) + lock glyph · new (<48h) = 2pt glow ring + 3s pulse |
| **IconTile** 2-col · h104 · r20 | skillGradient 135°, glyph 26 top-left at 60% white, label `bodyStrong` bottom-left pinned to the deep end. | pressed scale .97 + a 12% **black overlay** (opacity would reveal the background through the gradient) · locked = lockedSurface, no gradient · coming-soon = "Тун удахгүй" pill |
| **SectionHeader** h32 | Optional overline eyebrow + `h2` + optional trailing text action reading "Бүгд" — never a bare arrow. | |
| **EmptyState** min-h160 | 64pt Spark Fox pose (reused art) · `h3` · `caption` · optional ghost button. Always inside the card frame that would have held the data. | compact variant: mascot 40pt, button becomes a text link |
| **Skeleton** | surfaceAlt block, 1400ms shimmer at 20% glow, laid out at the **true final height**. | static when reduce-motion is on · never more than 3 shimmer groups on screen |
| **Toast** h52 · r14 · above the tab bar | Glyph + message ≤2 lines + optional action. Enters from the bottom, 240ms ease-out. | auto-dismiss 3200ms (4500ms with an action) · swipe-down to dismiss |
| **SheetModal** r28 top · max-h 88% | Handle 36×4 · optional title · content · optional pinned footer. Scrim = background at 62%. expo-blur on iOS only (BlurView is expensive on Android). | dragging: handle widens to 44 · at max height the top corners square and a divider appears |
| **MascotCircle** 56 / 96 / 140 | primarySoft plate + fox PNG overflowing the top edge by 8pt. On Home the fox is unframed over the sky. | celebrating: 260ms scale 1→1.06→1 spring, once · asleep (streak 0): desaturated, lockedSurface, ambient loop stops |
| **FlashCard** 312×420 · r28 | Word `h1` · transcription · 44pt audio button · optional image. Stack shows 3 cards, each 8pt down and 4% narrower. | dragging tilts ≤8°, reveals a label at 40pt travel: left "Давтах", right "Мэднэ", up "Хадгалах" · flip = 300ms Y-rotate |
| **LeaderboardRow** h64 · r14 | Rank (tabular, fixed 32pt column) · Avatar 44 · name + org · XP right-aligned tabular. Top 3 get a gold/silver/bronze plate. | self = primarySoft + borderStrong, and the row **pins to the bottom of the viewport** when scrolled out of view |
| **Confetti** ~40 particles · 1600ms | 6×10 rounded rects in xp, sparks, primary, glow, success — never more than 5 colours. | reduce-motion → a single 300ms radial glow · never twice within 2s · always `pointerEvents: none` |
| **RewardBurst** 260ms | "+15 XP" scales in at the source, travels to its stat pill while shrinking to 0.6 and fading; the pill then does a 180ms CountUp and a 1.08 pulse. **This is what makes XP feel banked rather than announced.** | stacked bursts queue 90ms apart, max 3 visible · reduce-motion: fade in at the pill and count up, no travel |

---

## 03 · Screen layouts

### 3.1 Нүүр · Home — the daily launchpad

**Problem:** nine sections, each a card with its own accent, so the eye has to
price every one before it can act. The hero ends at a hard edge, turning lovely
artwork into a banner ad.

**Three tiers, in order:**

1. **Primary — one card, glowing.** Continue. The only gradient fill, the only
   `elevation.float`, and it physically overlaps the hero. Everything else on
   the screen is flat.
2. **Secondary — measure, then two next steps.** The daily goal is demoted from
   a card to a bare inline row (it is a readout, not an action). Below it,
   review and assignments as two equal half-width tiles.
3. **Browse — for when nothing is waiting.** The four skill tiles keep their
   grid (a genuine menu). IELTS and Idioms drop out of the vertical stack into a
   horizontal rail, with a peeking third card teaching the gesture.

**The hero:** sky art runs edge to edge and under the status bar, then
`heroScrim` dissolves its bottom 45% into `background`. No card, no border, no
rounded corner. The fox (126×146) overlaps the scrim so he stands *in front of*
the content. At streak 0 the ember loop stops and the fox switches to his
sleeping pose; nothing else changes.

**Spacing:** hero → continue **−28 (overlap)** · continue → goal 24 · goal →
next-step tiles 32 · tier → tier 48 · screen gutter 20 (16 on SE) · last section
→ tab bar 40.

### 3.2 Хичээл · Хичээлийн ертөнц — where am I, and what's next

**Problem:** six islands all look equally available, the trail looks the same
everywhere, and the label cards are the same weight whether the level is
finished, in progress or locked. The map is beautiful and it answers no
question.

**Four states, four silhouettes:**

- **Mastered** — full-colour art, gold star, filled bar, done/total in success.
  The trail behind it is solid gold.
- **You are here** — the only pulsing thing on the screen: a waypoint chip above
  the island, a 3pt glow ring, an elevated label card, and the only button on
  the map. It also owns the initial scroll position.
- **Unlocked, not started** — full-colour art, flat label card, empty track.
- **Locked** — a **pre-rendered silhouette** on a `lockedSurface` plate, never
  opacity. The unlock condition is stated, not implied.

**The trail:** travelled is `islandMap.gold`, 6pt, solid, with a 14pt gold bloom
at 18%. Ahead is a 5pt dotted line in `textMuted` at 35%. The break happens
exactly at the current island, so "you are here" survives even with the labels
unread.

**The stat bar:** absolutely positioned, transparent at scrollY 0 with each pill
carrying its own glassBg + blur 30; the bar behind them cross-fades to
glassBgStrong + blur 40 + a 1pt bottom border between scrollY 0→48.

**Spacing:** island centre → island centre 160 · island art → label card 8 ·
horizontal swing ±68 from centre · first island → top of scroll 96 · opens
scrolled to `current − 180`.

### 3.2b `/level/[code]` · the node path

The island map is the atlas; this is the street. Same four states at node scale,
same "one glowing thing" rule — exactly one node pulses.

- **Sticky header** — back, level code, thin overall bar, and a 3pt top rule in
  the `islandMap` colour so you never lose which level you are inside.
- **Chapter groups** — 38 lessons is too many for one column. Chapters of 5–7
  with a quiet divider; a chapter is expanded only if it contains the current node.
- **Nodes** — 64pt, ±28pt horizontal swing; the 4pt connector takes the same
  travelled/ahead treatment as the trail.
- **Chapter test** — a 76pt hexagonal-plate node closing each chapter. Gold, and
  the only node that can consume hearts, so it earns the size.

Node states: **mastered** success fill + white check, no ring · **passed with a
mistake** success fill + gold 2pt ring (a quiet invitation to redo) · **current**
primaryGradient + 3pt glow ring + 2.4s pulse + "ЭНД" flag, 76pt not 64pt ·
**unlocked** surface fill + borderStrong ring · **locked** lockedSurface +
lockedInk.

### 3.3 Профайл · Profile — premiumThemes

**Problem:** a hundred trophies in ten tiers is a real collection, and it is
currently a horizontal strip — a format that can only show what you already
have, never what you are missing, which is the entire psychology of collecting.
The header is also just an avatar and four numbers; nobody screenshots four
numbers.

- **The status card** — one shareable object, not a screen region: a single
  `radius.xl` card with its own crown gradient holding avatar, level, CEFR,
  place and the four stats **inside one border**. Share exports exactly this
  card at 2× with the wordmark added — which is why the stat row lives inside it.
- **The trophy case — show the holes.** A 4-column grid of fixed cells with
  locked slots always visible. The silhouette is what creates the want.
- **Tier is the spine.** A horizontal tier rail with per-tier counts doubles as
  the filter and as the ladder.
- **One hook, always.** A single "next trophy" card at the top of the case,
  chosen server-side as the nearest unearned one, with its real remaining count.
  This is the only place on Profile with a progress bar.
- **Artwork is never tinted.** Tier colour lives in the plate behind the PNG.

**Section order:** 1 status card → 2 plan (+24) → 3 trophy case (+48) → 4 quick
menu (+48). Menu grid is 2 columns, not 3 — Mongolian labels.

⚠️ **The 2MB PNGs.** The case renders 12 badges above the fold ≈ 24MB. The grid
must request a 144px-wide derivative (Cloudflare Image Transformations,
`width=144,quality=85`) and load full resolution only in the detail sheet. If
transformations are not wired yet, paginate one tier at a time. **Open question.**

### 03b · Direction alternatives (not yet chosen)

All three per screen use the same token set — these are structural choices, not
visual ones, so they do **not** block the token merge.

| Screen | **Built above** | Alternative | Alternative |
|---|---|---|---|
| Home | **1a Dissolve** — artwork becomes the page, the primary action breaks the seam. Best balance of atmosphere and speed; the only one where the fox is big enough to have a personality. | **1b Cockpit** — art shrinks to a 118pt band, every stat collapses into one ledger row. Four sections above the fold. Fastest for daily returning learners and best for adult professionals — but it spends most of the brand to get there. | **1c Portal** — the hero *is* the action, one full-height panel, everything else below the fold. Most cinematic, strongest for new/lapsed users; risky for daily ones who now scroll for the review card. |
| Lessons | **1d Travelled trail** — the illustration stays the hero and the trail carries the state. Reads in well under a second, needs no new art beyond splitting the trail. | **1e Atlas + street** — collapses the map into a horizontal level rail and puts the node path on the same screen. Answers "what's next" in zero taps, at the cost of the journey metaphor and most of the island art. | **1f Altitude rail** — a fixed CEFR ladder pinned to the left edge, one island in focus. Clearest "where am I" and most scalable, but it turns a map into a stepper. |
| Profile | **1g Grid with holes** — fixed cells, locked slots always visible, tier rail as filter and ladder. The gaps are the product. | **1h Tier shelves** — one horizontal shelf per tier. The ladder is unmistakable and art gets room, but each tier is its own horizontal scroll, so it hides as much as the strip it replaces. | **1i The vault** — Profile shows one trophy (the next one) plus a ten-segment tier meter; the full case is its own screen. Weakest at conveying scale, strongest at conveying desire. |

### 03c · Loading · empty · error

Two rules run through all of it:

1. **Nothing changes size between states** — a skeleton occupies the true final
   height, so the page never reflows under the learner's thumb.
2. **A tier-one element never disappears** — the Continue card and the trophy
   case degrade into a different message inside the same frame, because their
   absence would silently change what the screen is for.

| Screen | Element | Loading | Empty | Error |
|---|---|---|---|---|
| Нүүр | Hero stat pills | Pills at final width, value as a 28×14 skeleton. Never collapse. | Not possible — a new account is 0 / 0 / 5 hearts. | Last cached values + a 10pt textMuted dot. No error copy over artwork. |
| Нүүр | Continue card | Full-height purple card with skeleton title, meta and bar. | No lesson started → "Эхний хичээлээ эхлүүлье", same gradient, CTA to A1. **Never hidden.** | Same card, title "Дахин оролдоно уу", button "Дахин ачаалах". Gradient retained. |
| Нүүр | Daily goal row | Indeterminate bar, label visible, value hidden. | Ghost "Зорилтоо сонго" opening the 20/50/100 sheet. | Row hides entirely — a broken readout is noise. |
| Нүүр | Review tile | Skeleton number, real caption. | 0 due → "Бүгд дууссан" + success tick, tile drops to surfaceAlt. Tapping still opens the deck. | "—" + caption "Дахин оролдох". |
| Нүүр | Assignments tile | Skeleton number, real caption. | No teacher → replaced by "Ангид нэгдэх" → `/join`. Learners without a class must never see an empty teacher slot. | As review tile. |
| Нүүр | Skill grid | Four gradient tiles at full colour with skeleton counts (gradients are static). | Count 0 → "Тун удахгүй" + coming-soon treatment. | Counts drop away; tiles stay tappable. |
| Хичээл | Island progress | Label cards keep their size with skeleton done/total and an empty track; islands and trail render immediately from bundled assets. | New account → A1 current, everything above locked, no travelled segment. | Level code + name only; the map stays navigable. |
| Хичээл | Whole map | Sky + islands + trail paint instantly; only labels are async. **No full-screen spinner on this route.** | Not possible. | Full-bleed EmptyState + retry, only if the bundled art itself fails. |
| /level | Node path | 7 skeleton nodes at true positions with the connector drawn — the path shape is known before the data is. | Chapter with no lessons → "Энэ бүлэг бэлтгэгдэж байна" between the dividers. | Header retained, body becomes an in-card EmptyState with retry. |
| Профайл | Status card | Avatar skeleton, ring at 0, name/username as bars; frame and crown gradient render immediately. | No avatar → initials on primarySoft. No org → the place chip is omitted, not blank. | Cached identity, stats become "—", **Share disabled while stale** so nobody shares wrong numbers. |
| Профайл | Trophy case | 12 skeleton cells, tier rail as 3 skeleton pills. Fixed-size cells so the PNGs cause no reflow. | 0 earned → all 12 cells locked, next-goal promotes the easiest starter trophy. **Never hidden at zero — that is exactly when it matters most.** | In-card EmptyState + retry; tier rail and the 38/100 count still render from cache. |
| Профайл | Next-trophy hook | Skeleton title and bar inside the real card frame. | All 100 earned → celestial-tier congratulation, bar replaced by a completion date. | Card hidden — a wrong next-goal is worse than none. |

---

## 04 · Motion & reward choreography

**The rule that keeps this premium rather than toy-like:** utility motion never
bounces; only a reward may overshoot, and only once. Everything triggered dozens
of times a day uses a flat ease-out. Springs are reserved for the four moments
that are supposed to feel like something — XP landing, streak advancing, quiz
complete, trophy unlocked. Every celebration is skippable by tapping anywhere,
and every one respects `AccessibilityInfo.isReduceMotionEnabled` by collapsing
to a 150ms cross-fade **with the haptic retained**.

| Moment | Timing | Choreography |
|---|---|---|
| Press feedback | 90ms in · 140ms out | scale to .97 (.94 for the centre tab) + fill swap to primaryPressed. **Never opacity** — on a gradient it shows the background through. Light haptic on press-in, nothing on release. |
| Screen push | 280ms | Incoming slides 24pt from the right, fades 0→1; outgoing shifts −12pt and fades to .6. No scale. The tab bar never animates between tabs. |
| Tab change | 200ms | Cross-fade only — 5 tabs sliding is disorienting. The active pill translates over the same 200ms; icon colour lerps. |
| Sheet present | 300ms in · 220ms out | Translate from +100%, scrim 0→.62 over the first 180ms. Drag-to-dismiss is 1:1 with the finger, snaps back with the reward spring above 40%. |
| Progress-bar fill | 600ms, delayed 120ms | Width animates **from the previous value, not from 0** — animating from 0 on every mount makes returning to Home feel like losing progress. |
| XP count-up | 180ms travel + 400ms count | RewardBurst carries "+15 XP" to the pill, the pill counts with an ease-out, then pulses to 1.08 for 140ms. Tabular numbers so the pill never changes width mid-count. |
| Streak flame | 2.4s ambient loop · 520ms advance | Ambient scale 1→1.03, opacity .92→1, sine, infinite. On advance: 520ms reward spring to 1.18 with a glow ring expanding 0→24pt. **At streak 0 the loop stops entirely and the flame renders in lockedInk — the absence of motion is the message.** |
| Heart loss | 420ms | Lost heart scales to 1.25 (120ms), the fill drains top-to-bottom into an outline (200ms), then a 4pt shake at 100ms. Error haptic once at the start. The remaining hearts do not move. |
| Hearts empty | 300ms | Row tints dangerSoft, refill CTA slides up 8pt, regen timer starts. **No modal — a modal here reads as punishment.** |
| Quiz complete | ~2.2s, skippable | (1) 0ms heavy haptic + Confetti; (2) 120ms score ring draws over 700ms while accuracy counts up; (3) 700ms XP row slides up 16pt and counts; (4) 900ms combo "3 дараалан!" springs in and the multiplier chip flips; (5) 1400ms Continue fades in, immediately tappable. Tapping anywhere jumps to step 5. |
| Trophy unlock | 900ms | The plate lights from lockedSurface to its tier colour (240ms), the silhouette cross-fades to real artwork (300ms), then one glow ring expands 0→32pt. Success haptic **on the cross-fade, not the start**. |
| Island / node tap | 160ms then push | Island scales to 1.04, glow doubles, label lifts 4pt, then push. Selection haptic. **The trail does not animate — it is a map, and maps hold still.** |

**Haptics map:** `selectionAsync` tab change, chip select, island tap, swipe
commit · `impactAsync(Light)` primary button press-in, node tap ·
`notificationAsync(Success)` correct answer, goal met, trophy unlock ·
`notificationAsync(Error)` heart lost (once, not per wrong tap) ·
`impactAsync(Heavy)` quiz-complete burst, frame 1 only. Muted entirely when
Settings → Haptics is off. **Never fire two haptics inside 120ms.**

**Curves:** `standard` = `Easing.bezier(.2,0,0,1)` (everything utility) · `enter`
= `Easing.out(Easing.cubic)` · `exit` = `Easing.in(Easing.cubic)` · `reward` =
`withSpring({ damping: 14, stiffness: 170, mass: .9 })`, max overshoot ≈ 6%.
All of it Reanimated 3 on the UI thread — no `Animated` +
`useNativeDriver: false` on anything that runs during a scroll.

---

## 05 · Migration note — what is a value swap, what is code

### ✅ Landed: pure token-value swap (`theme.ts` only)

Every surface / text / border / glass / brand / semantic value in both
`appThemes` variants; all `premiumThemes` values in both; every `tints.*`,
`skillGradients.*`, `progressGradients.*`, `islandMap.*` value; the typography
scale (families unchanged, so no `useFonts` change and no new assets); the
radius scale.

> "Ship this half alone and the app is already ~70% of the redesign, with zero
> component risk. It is a genuinely safe first PR."

Two deliberate deviations from the spec text:

- **`spacing` was not renamed.** The spec's scale is the current names shifted
  one step up (`lg` 16 → 24), so writing it in would silently resize every
  existing call site. Do it as its own mechanical codemod PR.
- **`elevation` landed dark-only.** Making it theme-aware is component code
  (below); it is not a regression today because the static palette is dark-pinned.

Additive helpers that landed alongside: `tintThemes`, `islandMapThemes`, and the
new `PremiumPalette` keys — so migrating screens have a light value to read.

### ⬜ Requires component code

- **Home restructure** — the Continue card must overlap the hero
  (`marginTop: -28`, hero `overflow: visible`), the goal card becomes an inline
  row, IELTS/Idioms move into a horizontal browse rail. This is an `index.tsx`
  rewrite, not a token change.
- **heroScrim** — a new `LinearGradient` layer over the sky image. ~15 lines in
  the hero component.
- **Trail state on Lessons** — the golden trail is currently one static
  `line.webp`. Travelled-vs-ahead needs it split into six per-segment images (or
  one image masked by an absolutely-positioned overlay). Cheapest version: keep
  the single image and lay a background-coloured 55%-opacity rect over the
  un-travelled portion.
- **TrophyCase** — a new component. The current horizontal strip cannot express
  tiers, locked plates or the next-goal hook.
- **Locked states** — everywhere locking is `opacity: 0.4` it must become
  `lockedSurface` + `lockedInk`. Opacity multiplies through and silently breaks
  the contrast guarantees in §1.10.
- **Shadow → glow split** — `elevation.*` must return a theme-aware object, not
  a constant, so dark emits `shadowColor: glow` and light emits a neutral shadow.

### ⚠️ The ~56-file static-palette debt

Roughly 56 files still `import { colors }` from the static dark palette instead
of reading the active theme, so they are frozen dark and ignore the toggle.
Three things in this design silently break without finishing that migration:

1. **Light mode on Lessons and Profile is not optional here.** The islands ship
   `*_light` variants and the day-sky backdrop exists; if the chrome stays
   frozen dark, light mode shows dark glass pills on a bright sky — the
   worst-looking state in the app. Files: the Lessons map, the island label
   card, the node-path screen, TopBar.
2. **The new `*Text` tokens only work theme-aware.** A static import pins them
   to the dark value and every reward label in light mode fails AA at ~1.7:1.
   This is the one place where not migrating is an actual accessibility
   regression, not just an ugly screen.
3. **Glow-vs-shadow is theme-conditional by definition.** A violet glow on a
   white light-mode card looks like a rendering bug.

**Suggested order:** (1) land the token values with the static palette still
pointing at `appThemes.dark` — every frozen file gets the new dark look for free
and nothing regresses ← **done**; (2) migrate the ~14 files behind these three
screens and turn on light mode for them; (3) codemod the rest —
`colors.x → useTheme().x` is mechanical for ~90% of call sites; (4) delete the
static export so it cannot be re-imported. Add an ESLint `no-restricted-imports`
rule at step 2 so the debt cannot grow while you pay it down.

### Open questions (for the client / design)

- Is the day-sky backdrop light enough to carry white-on-glass pills, or does
  light-mode Lessons need a scrim too?
- Trophy PNGs are ~2MB each and the case shows 12 at once. Are Cloudflare Image
  Transformations in place yet, or should the case load tier-by-tier?
- Streak now advances on daily-goal completion. Should Home's goal row become
  the streak's home, rather than having both a flame pill and a goal bar?
- Pick one direction per screen from §03b so the spec can collapse to a single
  resolved layout.
