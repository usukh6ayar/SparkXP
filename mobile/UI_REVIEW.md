# SparkXP — Comprehensive UI Review

> **Reviewer lens:** Staff Product Designer · UI Designer · Design-Systems lead
> (Apple / Material 3 / Linear / Stripe / Duolingo quality bar).
> **Scope:** the *visual & component* layer of the SparkXP mobile app (Expo /
> React Native) — design tokens, color, typography, components, icons, states,
> consistency, accessibility, and premium feel. Grounded in the actual code in
> `mobile/app/*`, `mobile/src/components/*`, and `mobile/src/theme/theme.ts`.
> **This is analysis only — no redesign, no code changes.**
>
> **Companion docs:** `UX_REVIEW.md` (product / IA / flow), `DESIGN_REVIEW.md`
> (motion / haptics), `UX_CRITICAL_SPEC.md` (C1–C4 build spec). This file
> deliberately does **not** re-litigate IA/flow — it audits the pixels, tokens,
> and components. Where a UI issue has a product twin (e.g. Home hierarchy),
> it is cross-referenced, not repeated.

---

## 0. Executive Summary

SparkXP has a **genuinely strong visual foundation**: a single documented design
system (`theme.ts`), a coherent purple "magical night-sky" brand, a fox mascot, a
semantic type scale, a real text primitive (`AppText`), spacing/radius/elevation
tokens, motion with reduce-motion support, and haptics. This is well above the
median RN app and the *intent* is clearly premium.

**The gap between the system on paper and the system on screen is where the app
loses its premium edge.** The problems are not "ugly screens" — they are
**fragmentation and drift**: two parallel color palettes rendering adjacent tabs
on different backgrounds, two competing button systems, three visual icon
languages sharing one screen, a `Card` primitive that only ~15% of screens
actually use, and ~45 hardcoded colors sitting inside screens the token system
was built to eliminate. Individually minor; together they read as "assembled by
three people over time" rather than "one product."

| Dimension | Score /10 | One-line verdict |
| --- | --- | --- |
| Visual Design | 7 | Cohesive, on-brand, distinctive mascot — undercut by mixed icon styles |
| Layout | 7 | Clean 4pt scale; hero relies on fragile magic numbers |
| Visual Hierarchy | 6 | "Everything is a card" → weak single focal point (see `UX_REVIEW` C1) |
| Typography | 7 | Good semantic scale + high `AppText` adoption; legacy scale still leaks |
| Components | 6 | Strong primitives, **low reuse** — most screens re-implement cards inline |
| Consistency | 5 | **Weakest axis** — dual palettes, dual buttons, mixed icons, hardcoded hex |
| Accessibility | 5 | No Dynamic Type; borderline muted-text contrast; text-over-image |
| Delight | 8 | Mascot, confetti, haptics, spring motion, reduce-motion respected |
| Professionalism | 7 | Documented tokens + clean components; drift/stale comments pull it down |
| Premium Feel | 7 | Glassmorphism + glow + gradient; Android shadow gap + inconsistency cap it |
| **Overall** | **6.5** | **A premium design system that the screens don't yet honor consistently** |

**The single highest-leverage UI fix is consolidation, not addition:** collapse
the two palettes into one, the two button systems into one, and route every
screen through the shared `Card`/`AppText`/token layer. That one refactor moves
Consistency, Professionalism, and Premium Feel together.

---

## 1. Design System Analysis

### 1.1 What exists (and is good)

`mobile/src/theme/theme.ts` is a real, documented single source of truth:

| Token group | Coverage | Quality |
| --- | --- | --- |
| **Color** | `colors` + `appThemes.{light,dark}` | Good — brand, semantic, gamification, glass |
| **Spacing** | `spacing` (4pt: `xs`4 → `xxxl`48) | Excellent — clean, consistent scale |
| **Radius** | `radius` (`sm`12 / `md`16 / `lg`20 / `xl`28 / `full`) | Good — restrained, premium |
| **Typography** | `typography` (`display`→`overline`, size+lh+weight paired) | Excellent — intent-based |
| **Elevation** | `elevation.{sm,md,float}` (purple glow shadows) | Good idea, **iOS-only** (see 4.6) |
| **Tints** | `tints` (8 bg/fg pairs for chips/tiles) | Good |
| **Motion** | `SPRING`, `useReduceMotion` (`src/lib/motion`) | Excellent — accessibility-aware |

The `AppText` primitive (`src/components/Text.tsx`) forces text through semantic
*roles* (`h1`, `body`, `caption`) rather than ad-hoc size+weight — adoption is
high (**28 files**, only **1** raw `<Text>` left in `app/`). This is the single
best thing about the current UI foundation and should be the model for how every
other primitive is enforced.

### 1.2 Design-system inconsistencies (the core problem)

| # | Inconsistency | Evidence | Impact |
| --- | --- | --- | --- |
| DS-1 | **Two parallel color palettes** | `appThemes` (via `useColors()`, `bg #191040` / `surface #2A1E5C`) vs `premiumThemes` (via `useTheme()`, `bg #0C0918` / `card #171231`). Profile + Settings use the premium palette; the other **34 screens** use `useColors()`. | Adjacent tabs render on **different background colors** — the app feels like two apps stitched together |
| DS-2 | **Two type scales** | Semantic `typography` *and* legacy `fontSize` (`xs`12→`xxl`28) both exported and both in use (e.g. `TextField.tsx` uses `fontSize.sm`/`fontSize.md`) | Undermines the "pick a role" discipline; two ways to size text |
| DS-3 | **No `borderWidth` token** | Border widths in the wild: `1` (`Card`), `1.5` (`Button` secondary, `TextField`), `2` (tab chip), `2.5` (`foxBig`) | Hairline inconsistency across identical-looking outlines |
| DS-4 | **Gradient direction not tokenized** | `Button` primary uses `start(0,0)→end(1,1)`; `AuthButton` filled uses `(0,0)→(1,0)`; `continueCard` `(0,0)→(1,1)` | The same brand gradient tilts differently on different CTAs |
| DS-5 | **Overlapping color sub-systems** | `tints`, `levelColor`, `islandMap`, `skillGradients`, `primaryGradient` are five separate color sets with near-duplicate hues (e.g. `tints.green #34D399` vs `islandMap.green #22C55E` vs `skillGradients.reading #2BA86A`) | Green means three different greens depending on the screen |
| DS-6 | **Stale design intent in code** | `CustomTabBar.tsx` header comment describes a *"Liquid-Glass floating frosted capsule… active tab slightly magnified"* but the code is a **flat, full-width, square-cornered Duolingo bar with no magnify**. `theme.ts` still frames dark as "the DARK default" though light is fully shipped. | Documentation drift → future edits chase the wrong mental model |

> **Verdict:** the tokens themselves are good. The failure is **governance** — the
> system was extended (premium palette, island map, skill gradients) faster than
> it was consolidated, so there are now several "sources of truth."

---

## 2. Color System

**Palette:** deep-purple night-sky. `primary #6C3BFF` with a `#7A4DFF→#5A28F0`
gradient; gamification accents gold `xp #FFC93C`, blue `sparks #4FC3F7`, orange
`streak #FF8A3D`; semantic `success #34D399`, `danger #F87171`, `warning #FF8A3D`.

**Strengths**
- Brand is distinctive and emotionally right for a gamified learner (magical,
  reward-forward). Gamification colors are semantically consistent (gold always =
  XP, blue always = gems).
- Glassmorphism tokens (`glassBg/glassBorder`) and glow give real premium texture.
- Light/dark overrides are thoughtfully scoped (brand/semantic stay constant).

**Weaknesses**

| # | Issue | Detail |
| --- | --- | --- |
| C-1 | **`warning` === `streak`** | Both are `#FF8A3D`. A validation warning and a streak reward are visually identical — semantics collide |
| C-2 | **Muted-text contrast is borderline** | `textMuted #8E80BC` on `background #191040` is ≈3.5:1 — **below WCAG AA (4.5:1)** for the 12px `caption`/`overline` roles that use it. Captions carry real info (word counts, hints) |
| C-3 | **Text-over-image legibility** | Home hero badges sit on `HERO_PILL rgba(18,10,40,0.45)` — a translucent pill over the *variable-brightness fox artwork*. Over the bright island, white/lavender text loses contrast (also flagged as `UX_REVIEW` C3) |
| C-4 | **Green ambiguity** | Three greens (`success`, `tints.green`, `islandMap.green`, `skillGradients.reading`) — success vs "reading skill" vs "map tier" are not visually distinguishable |
| C-5 | **`navy` is a misnomer** | `colors.navy = #FFFFFF` (white). A semantic name meaning its literal opposite is a trap for the next developer |

**Recommendation:** split `warning`/`streak`, lift `textMuted` to ≥4.5:1 on the
darkest background, add a solid (non-translucent) scrim behind hero text, and
collapse the green family to one token per meaning.

---

## 3. Typography

The semantic scale is well-constructed (each role pairs `fontSize` +
`lineHeight` + `fontWeight`):

| Role | Size / LH / Weight | Use |
| --- | --- | --- |
| `display` | 30 / 36 / 800 | Hero numbers |
| `h1` | 24 / 30 / 800 | Screen title |
| `h2` | 19 / 25 / 700 | Section header |
| `h3` | 16 / 22 / 700 | Card / row title |
| `body` | 15 / 22 / 400 | Body |
| `bodyStrong` | 15 / 22 / 600 | Button labels |
| `label` | 13 / 18 / 600 | Chips / field labels |
| `caption` | 12 / 16 / 500 | Hints / metadata |
| `overline` | 11 / 14 / 700 | Eyebrow |

**Strengths:** clear hierarchy by intent; strong `AppText` adoption; sensible
line-heights; restrained (only two heading weights, 700/800).

**Weaknesses**

| # | Issue | Detail |
| --- | --- | --- |
| T-1 | **Legacy `fontSize` scale still leaks** | `TextField.tsx` uses `fontSize.sm`/`fontSize.md` + a raw `<Text>` instead of `AppText`+`typography` — the input label/text bypass the semantic system |
| T-2 | **Weight double-specification** | `Button` label is `bodyStrong` (600) but then overridden to `700` in `styles.label`; `AuthButton` does the same. Button weight is defined in two places |
| T-3 | **No custom font loaded** | System font only (SF/Roboto). Brand doc references Onest/Inter but neither is loaded — a purple, mascot-forward brand reads more generic than it should on the type layer |
| T-4 | **`overline` 11px + `caption` 12px are small** | Below comfortable for Cyrillic at a distance; combined with C-2 (contrast) they are the least legible text in the app |
| T-5 | **No `allowFontScaling` strategy** | Nothing opts into or governs Dynamic Type (see Accessibility) |

---

## 4. Components

### 4.1 Reuse is the headline problem

| Primitive | Exists? | Adoption |
| --- | --- | --- |
| `AppText` | ✅ good | **High** (28 files) — the model to follow |
| `Card` | ✅ good (`flat`/`raised`/`filled`, press state) | **Low — only 6 of 41 screens import it** |
| `Button` | ✅ good | Medium — but auth screens ship a *second* button (`AuthButton`) |
| `TextField`, `EmptyState`, `Skeleton`, `IconButton`, `Pill` | ✅ | Varies |

**`Card` is the clearest miss.** `Home` (`app/(tabs)/index.tsx`) re-implements
**four** card variants inline (`continueCard`, `reviewCard`, `joinCard`, `task`)
— each hand-rolling `borderRadius + padding + elevation + backgroundColor` — the
exact duplication `Card` was built to remove (see its own docstring). Result:
padding drifts (`reviewCard`/`joinCard` use `spacing.md`, `continueCard` uses
`spacing.lg`), and radii diverge (`lg` vs `xl`) with no rule for which.

**Quantified:** 29 hardcoded hex + 16 hardcoded `rgba()` values live in 6
`app/` screen files, despite the project rule "no hardcoded hex in screens."

### 4.2 Buttons — two systems

| | Standard `Button` | Auth `AuthButton` (login.tsx) |
| --- | --- | --- |
| Height | 52 (`lg`) / 44 (`md`) | **58** |
| Radius | `md` (16) | **`xl` (28)** |
| Gradient | diagonal `(0,0)→(1,1)` | horizontal `(0,0)→(1,0)` |
| Glass variant | ✗ | ✅ (`BlurView` + tint + highlight) |
| Glow | `elevation.md` | custom `shadow*` block |

The first screen a user sees (welcome/login) uses a **taller, rounder, differently
-lit** button than the rest of the app. First impression sets the quality bar and
then the bar visibly moves.

### 4.3 Inputs

`TextField` is solid (label, left icon, password reveal, 52px height, focusable
target). Gaps: **no visible focus state** (border doesn't change on focus), **no
error state** (`FormError` is a separate component, so validation styling isn't
built into the field), and it bypasses the type tokens (T-1).

### 4.4 Bottom navigation

Flat full-width 5-tab bar (Duolingo-style), icon-only, active = purple-outline +
14%-fill chip, press-down spring, haptic tick, screen-reader labels present. This
is clean and well-built. Issues: (a) the **center AI-buddy tab is a wordless fox
disc** — its meaning isn't discoverable (a UX/IA point, see `UX_REVIEW`); (b) the
code contradicts its own "Liquid-Glass / magnify" comment (DS-6); (c) `chipStyle`
/`foxStyle` are dead aliases of `iconStyle`.

### 4.5 Icons — three visual languages on one screen

| System | Style | Where |
| --- | --- | --- |
| **Ionicons** | Flat 2px line/solid vector | `alarm`, `chevron`, `clipboard`, tab fallbacks, everywhere |
| **`appIcons`** | Glossy **3D-rendered PNG** | Home skill tiles, tab bar, Soril games |
| **Mascot images** | Illustrated fox | Empty states, center tab, hero |

On the **Home screen alone**, the 4 skill tiles use 3D PNG icons while the
Review/Assignments cards directly beside them use flat Ionicons — two different
rendering styles, weights, and perspectives sitting inches apart. This is the most
visible consistency break in the app. A premium bar (Linear/Stripe) uses **one**
icon language; Duolingo uses 3D *consistently*. SparkXP should pick one lane per
context and hold it.

### 4.6 Elevation / shadows — platform split

`elevation.{sm,md,float}` is a **purple glow** on iOS (`shadowColor #9D7BFF`) but
compiles to a **gray Material elevation** on Android (`elevation: N`) — Android
cannot render a colored ambient shadow this way. So the signature "cards float on
a violet glow" premium cue **only exists on iOS**; Android sees flat gray lift or
nothing. This should be a deliberate, tested cross-platform decision, not an
accident of the API.

### 4.7 States

| State | Component | Verdict |
| --- | --- | --- |
| **Empty** | `EmptyState` (fox + icon badge + title + hint + optional action) | ✅ Excellent — warm, on-brand, actionable |
| **Loading (skeleton)** | `Skeleton` (opacity pulse) | ✅ Good — used on Home grid |
| **Loading (spinner)** | `Loading` (centered `ActivityIndicator` on `c.surface`) | ⚠️ Two paradigms coexist; the spinner sits on a **solid surface color**, seaming against gradient screens |
| **Error** | `FormError` / `Toast` | ⚠️ Present but not integrated into inputs; no standardized inline field error |
| **Pressed** | `PressableScale` + `pressed` opacity/scale | ✅ Consistent where used |

**Loading inconsistency:** some screens skeleton (premium), others show a bare
centered spinner (generic). Pick skeletons as the default for content screens.

---

## 5. Layout & Spacing

**Strengths:** 4pt scale is respected in most screens; `spacing.lg`(16) is a
consistent gutter; generous white space; `SafeAreaView` used correctly.

**Weaknesses**

| # | Issue | Detail |
| --- | --- | --- |
| L-1 | **Magic-number hero** | Home hero is driven by hardcoded constants: `HEADER_RESERVE 106`, `GRASS 0.6`, `SCENE_RATIO`, `continueIcon 60×72`. Layout math (not tokens) positions the fox — fragile across device sizes/notches |
| L-2 | **Card padding drift** | `spacing.md` vs `spacing.lg` chosen per-card with no rule (4.1) |
| L-3 | **Radius chosen per-instance** | `lg`(20) vs `xl`(28) on peer cards; tab chip hardcodes `16` instead of `radius.md` |
| L-4 | **Density mismatch across tabs** | Home is dense (hero + 5 modules) while other tabs are sparse — no shared "screen rhythm" (section header spacing, first-card offset) |

---

## 6. Accessibility

| # | Issue | Severity | Detail |
| --- | --- | --- | --- |
| A-1 | **No Dynamic Type / font scaling strategy** | High | Fixed `fontSize` in `typography`; no `allowFontScaling` governance. Users who enlarge system text get no benefit (or uncontrolled breakage) |
| A-2 | **Muted text below AA** | High | `textMuted #8E80BC` on dark bg ≈3.5:1 for 11–12px captions (C-2) |
| A-3 | **Text over variable-brightness image** | Medium | Hero badge legibility depends on the artwork behind it (C-3) |
| A-4 | **No input focus state** | Medium | `TextField` border unchanged on focus — hard for low-vision / switch users to see the active field |
| A-5 | **Icon-only tab bar** | Medium | Labels removed; relies solely on recognition + a11y labels. Screen-reader labels *are* present (good), but sighted low-recognition users lose wayfinding |
| A-6 | **Touch targets — mostly OK** | Low | `IconButton` 44px, tabs use `flex` full-height, eye toggle has `hitSlop:8`. Generally meets 44×44. Verify small `countPill`/chip taps aren't interactive-too-small |

**Positives:** reduce-motion is genuinely respected (`useReduceMotion` gates every
animation), haptics are wired, and tab/icon buttons carry `accessibilityLabel` +
`accessibilityState`. The a11y *scaffolding* is present — contrast and Dynamic
Type are the real gaps.

---

## 7. Delight & Premium Feel

**Strong.** Fox mascot with contextual icon badges, `Confetti`, `CountUp`,
`StreakFlame` pulse, `AchievementModal`, spring press feedback, haptics, and a
glassmorphic sign-in sheet. Reduce-motion is honored throughout. This is the app's
best axis and a real competitive asset versus generic learning apps.

**What caps it:** the delight is undercut by the consistency issues — a beautiful
confetti moment loses impact when the button that triggered it is styled
differently from every other button, or when the reward screen sits on a different
background color than the tab you came from (DS-1). **Polish is present; coherence
is what's missing.**

**Opportunities:** unify motion durations into tokens (currently per-component
`650/850ms`), add a shared success-moment component, and give the AI-buddy tab a
subtle idle animation so the center action feels alive without a label.

---

## 8. Consistency Review (master list)

| ID | Inconsistency | Where |
| --- | --- | --- |
| DS-1 | Two color palettes (`appThemes` vs `premiumThemes`) | Profile/Settings vs rest |
| DS-2 | Two type scales (`typography` vs `fontSize`) | `TextField` + legacy screens |
| DS-3 | Four border widths, no token | Card / Button / TextField / tab |
| DS-4 | Gradient direction varies | Button vs AuthButton vs continueCard |
| DS-5 | 5 overlapping color sets, duplicate hues | tints/levelColor/islandMap/skillGradients |
| DS-6 | Stale "Liquid-Glass/magnify" intent vs flat bar | `CustomTabBar` |
| 4.1 | `Card` used by 6/41 screens; inline cards elsewhere | Home + most screens |
| 4.2 | Two button systems (52/r16 vs 58/r28) | App vs auth |
| 4.5 | Three icon languages (Ionicons / 3D PNG / mascot) | Home, Soril |
| 4.6 | Glow shadow iOS-only, gray on Android | All elevated surfaces |
| 4.7 | Two loading paradigms (skeleton vs spinner) | Content screens |
| C-1 | `warning` === `streak` color | Semantic collision |
| C-5 | `navy` token = white | theme.ts |
| 45× | Hardcoded hex/rgba in screens | 6 files in `app/` |

---

## 9. Benchmark

| Product | What they do that SparkXP hasn't locked in | Takeaway for SparkXP |
| --- | --- | --- |
| **Duolingo** | One consistent 3D icon language; loud, single, always-styled primary CTA; labeled tabs | Commit to 3D icons *everywhere* or vectors *everywhere* — not both; label the center tab |
| **Linear** | Ruthless token discipline; one surface color; near-zero inline styling | Kill DS-1/DS-5; route every color through one palette |
| **Stripe** | One button, one input, obvious focus/error states | Merge the two button systems; add focus + inline error to `TextField` |
| **Material 3** | Tonal elevation that works cross-platform; documented state layers | Fix the iOS-only glow (4.6); define pressed/focus/disabled state layers |
| **Apple HIG** | Dynamic Type as a first-class citizen | Adopt an `allowFontScaling` strategy (A-1) |
| **Notion / Airbnb** | Consistent card system as the app's spine | Make `Card` mandatory; delete inline card styles |

SparkXP's brand and delight are **already at or above** several of these on
personality. It trails purely on **systemic consistency and accessibility** —
the "invisible" craft layer that separates premium from nice.

---

## 10. Modern UI Score — reasoning

| Dimension | /10 | Reasoning |
| --- | --- | --- |
| **Visual Design** | 7 | Distinctive, cohesive brand + mascot; docked for three icon styles and green ambiguity |
| **Layout** | 7 | Solid 4pt scale + white space; docked for magic-number hero and per-instance padding/radius |
| **Hierarchy** | 6 | Beautiful but flat — "everything is a card," weak single focal point (see `UX_REVIEW` C1) |
| **Typography** | 7 | Excellent semantic scale + high `AppText` adoption; docked for legacy scale leak + no brand font + small captions |
| **Components** | 6 | Great primitives, **low reuse** (Card 6/41), two button systems, missing input states |
| **Consistency** | 5 | Dual palettes, dual buttons, mixed icons, 45 hardcoded colors, stale intent — the weakest axis |
| **Accessibility** | 5 | Good scaffolding (reduce-motion, a11y labels) but no Dynamic Type + borderline contrast |
| **Delight** | 8 | Mascot, confetti, haptics, spring motion, reduce-motion — a real strength |
| **Professionalism** | 7 | Documented tokens + clean primitives; drift + stale comments pull it down |
| **Premium Feel** | 7 | Glass + glow + gradient read premium; Android shadow gap + inconsistency cap it |
| **Overall** | **6.5** | A premium *system* the *screens* don't yet honor — consolidation, not addition, is the unlock |

---

## 11. Prioritized Improvements

Each item: **Problem · Why it matters · Recommendation · UX impact · Effort (S/M/L/XL)**.

### 🔴 Critical

| # | Problem | Why it matters | Recommendation | Impact | Effort |
| --- | --- | --- | --- | --- | --- |
| CR-1 | **Two color palettes** (DS-1) — Profile/Settings on `#0C0918`, rest on `#191040` | Adjacent tabs look like different apps → kills "one product" premium feel | Collapse `premiumThemes` into `appThemes`; expose one `useColors()`; migrate Profile/Settings | Instant cohesion across the whole app | **L** |
| CR-2 | **Muted-text contrast < AA + text-over-image** (C-2, C-3, A-2, A-3) | Fails accessibility and hurts legibility of real content (counts, hints, hero stats) | Lift `textMuted` to ≥4.5:1 on darkest bg; add a solid scrim behind hero badges | Legible for all users; unblocks a11y compliance | **S** |
| CR-3 | **Icon language fragmentation** (4.5) — 3D PNG + flat vector on the same screen | Most visible consistency break; reads as unfinished | Pick one icon system per context (recommend 3D for feature tiles, vector for utility) and apply app-wide | Immediately more polished/premium | **M** |

### 🟠 High Priority

| # | Problem | Why it matters | Recommendation | Impact | Effort |
| --- | --- | --- | --- | --- | --- |
| H-1 | **Two button systems** (4.2) — auth 58/r28 vs app 52/r16 | First impression uses a different button than the whole app | Merge `AuthButton` into `Button` (add a `glass` variant + size); delete the duplicate | Consistent CTA from first screen on | **M** |
| H-2 | **`Card` used by 6/41 screens; 45 hardcoded colors inline** (4.1) | DRY intent unrealized; padding/radius drift; theme can't re-skin these | Make `Card` mandatory for boxed surfaces; refactor Home's 4 inline cards first; lint against hex in `app/` | Uniform surfaces; one place to restyle | **L** |
| H-3 | **No input focus/error state** (4.3, A-4) | Users can't see the active/invalid field; a11y gap | Add focus border + integrated error styling to `TextField` | Clearer, more accessible forms | **S** |
| H-4 | **No Dynamic Type strategy** (A-1) | Excludes low-vision users; App Store review risk | Decide + document `allowFontScaling` policy; test at 1.3× | Accessibility + store readiness | **M** |

### 🟡 Medium Priority

| # | Problem | Why it matters | Recommendation | Impact | Effort |
| --- | --- | --- | --- | --- | --- |
| M-1 | **Glow shadow iOS-only** (4.6) | Signature premium cue missing on Android | Add a cross-platform elevation strategy (tonal surface + subtle border on Android) | Premium parity across platforms | **M** |
| M-2 | **Two loading paradigms** (4.7) | Inconsistent perceived performance | Standardize on skeletons for content screens; retire bare `Loading` spinner or restyle its bg | Smoother, more premium loads | **S** |
| M-3 | **Overlapping color sets + duplicate greens** (DS-5, C-4) | "Green" means 3 things; hard to maintain | Consolidate to one token per meaning; derive map/skill tints from the core palette | Cleaner system, fewer bugs | **M** |
| M-4 | **`warning` === `streak`** (C-1) | Warnings and rewards look identical | Give `warning` a distinct hue (e.g. amber, not orange) | Clearer semantics | **S** |
| M-5 | **Legacy `fontSize` scale + weight double-spec** (DS-2, T-1, T-2) | Two ways to size/weight text | Migrate `TextField` + legacy screens to `typography`; drop `fontSize`; single-source button weight | Tighter type discipline | **M** |

### 🟢 Low Priority

| # | Problem | Why it matters | Recommendation | Impact | Effort |
| --- | --- | --- | --- | --- | --- |
| L-1 | **Stale comments / dead aliases** (DS-6, 4.4) | Misleads future edits | Update `CustomTabBar` comment to match the flat bar; remove `chipStyle`/`foxStyle` | Maintainability | **S** |
| L-2 | **`navy` = white misnomer** (C-5) | Trap for new devs | Rename to `ink` / `textPrimary` | Clarity | **S** |
| L-3 | **No `borderWidth` token** (DS-3) | Hairline drift | Add `border.{hairline,thin,thick}` tokens | Subtle consistency | **S** |
| L-4 | **Magic-number hero** (L-1) | Fragile across devices | Extract hero constants to a small, commented layout config; test on small/large devices | Robust layout | **M** |
| L-5 | **No brand font loaded** (T-3) | Type reads generic | Load Onest/Inter (per brand doc) via `expo-font` | Stronger brand on the type layer | **M** |
| L-6 | **No motion tokens** (§7) | Per-component durations | Extract durations/easings into `motion` tokens | Motion consistency | **S** |

---

## 12. Recommended Sequence

1. **Consolidation sprint (CR-1, CR-3, H-1, H-2)** — one palette, one icon
   language, one button, `Card` everywhere. This single sprint moves Consistency,
   Professionalism, and Premium Feel together and is the highest ROI.
2. **Accessibility pass (CR-2, H-3, H-4)** — contrast, focus/error states,
   Dynamic Type. Required for a credible App Store submission.
3. **Cross-platform + polish (M-1…M-5)** — Android elevation, loading paradigm,
   color-set cleanup, type migration.
4. **Housekeeping (all Low)** — comments, tokens, brand font, motion tokens.

> **Bottom line:** SparkXP does *not* need a redesign. It needs its already-good
> design system **enforced** — collapse the duplicates, route every screen through
> the shared primitives, and close the contrast/Dynamic-Type gaps. Do that and the
> app jumps from "nice and on-brand" (6.5) to genuinely premium (8+), without
> drawing a single new screen.
