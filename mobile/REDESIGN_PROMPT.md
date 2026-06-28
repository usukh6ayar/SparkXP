# SparkXP — Figma Make Redesign Prompt

> Goal: **elevate the existing brand** (purple #6C3BFF · Spark Fox · "SparkXP")
> to App-Store-featured polish — NOT a new brand. Built for Figma Make.
> Based on `DESIGN.md` + `DESIGN_PROMPT.md` + `SCREEN_SPECS.md`.
>
> **How to use:** Figma Make works best when you build in batches. Paste
> **Prompt 0** first (design system + components), then paste each screen
> prompt one at a time, telling it to reuse the system. Don't paste all 13
> screens at once — quality drops.

---

## PROMPT 0 — Design system & shared components (paste this FIRST)

```
Build a premium mobile design system for "SparkXP", a gamified English-learning
app for Mongolian students. Target: iPhone 16 Pro frame, light theme,
production / App-Store-featured quality. All UI copy is in Mongolian (Cyrillic)
— use a Cyrillic-safe font.

Design language: combine Duolingo motivation, Quizlet clarity, Apple
cleanliness, Linear polish, and Superhuman premium feel. Spacious, soft,
friendly but not childish.

COLORS
- Primary purple 500: #6C3BFF · 600: #5A28F0 · 700: #4B1ED8
- Primary gradient: #7A4DFF → #6C3BFF → #5A28F0 (use for CTAs, XP, progress, active states)
- Success green: #22C55E (completed, reading category)
- Info blue: #3B82F6 (writing category, statistics)
- Warning orange: #FF8A00 (streak, daily missions)
- XP gold accent: warm gold. Gem accent: cyan. Streak: flame orange.
- Background: #F8F8FC · Cards: #FFFFFF · Secondary surface: #F2F3FA
- "Ink" dark hero card: near-black (#16151D) for hero/CTA cards with white text.

TYPOGRAPHY (Inter / SF Pro)
- H1 36 Bold · H2 28 Bold · H3 22 SemiBold · Body 16 Medium · Caption 13 Medium
- Strong hierarchy, high contrast. Never light-gray text on white (WCAG AA min).

RADIUS: small 12 · medium 20 · large 28 · hero cards 32 · avatars 999.
SHADOWS: cards 0 8 24 rgba(0,0,0,0.06) · floating 0 12 30 rgba(108,59,255,0.20).
Never use harsh borders. Soft shadows only.
SPACING: 8px base — 8/12/16/20/24/32. Generous white space.
MOTION: 200–300ms, scale/fade/slide. Premium, no bounce overload.

COMPONENTS to define as reusable:
1. Button — Primary (purple gradient, white text, radius 18), Secondary (white bg,
   purple border), Ghost (transparent, purple text). Min hit area 44x44.
2. Card — white, radius 24, soft shadow, no border.
3. Hero/XP card — dark "ink" or gradient bg, radius 32, holds title + progress
   bar + Spark Fox mascot.
4. StatCard — icon tile + big number + label (variants: XP gold, Gem cyan, Streak flame).
5. Pill / Tag — CEFR level (A1–C2), skill type, price; small rounded chips.
6. ProgressBar — rounded, purple gradient fill on light track.
7. SectionHeader — H3 title + optional action link.
8. ListRow — icon + label + chevron (for settings).
9. Floating bottom navigation — height 88–96, white, floating with soft shadow,
   5 slots: Нүүр · Хичээл · [center Spark Fox button, larger, raised] · Сорил · Профайл.
10. Empty / loading / error states — friendly, mascot-led.

MASCOT — "Spark Fox": orange fox, purple hoodie, headphones. Always smiling,
friendly, confident. High-quality 3D illustration style, bright colors, soft
lighting, premium gradients (modern Duolingo-level rendering). Use in home hero,
AI friend, lesson completion, empty states.

Output the full token sheet + a component library page showing every component
in its states.
```

---

## SCREEN PROMPTS (paste one at a time; tell it "reuse the SparkXP design system")

### 1. Home / Dashboard (highest priority)
```
Design the Home screen reusing the SparkXP system. Light theme, iPhone 16 Pro.
- Top bar: streak chip (🔥 + count) left-ish, Sparks/gem badge top-right.
- Greeting: H1 "Сайн уу, {нэр} 👋" + a small body subline.
- HERO card (dark "ink", radius 32): streak chip + daily-goal title +
  subline + primary CTA button ("Давтаж эхлэх" or "Үг сурах"), Spark Fox mascot
  peeking on the right.
- Stat row: 3 StatCards — XP (gold) · Очир (cyan gem) · Цуврал (flame streak).
- SectionHeader "Юу сурах вэ?" then a 2-column grid of 4 skill cards:
  Сонсгол · Унших · Нөхөх · Бичих (each: colorful icon tile + label).
- "Үргэлжлүүлэн сурах" (Continue learning) card with progress.
- AI Найз teaser card with Spark Fox + "Дадлага хийх" CTA.
Visual priority: Daily Goal > Continue Learning > AI Friend. Spacious, premium.
```

### 2. Lessons list
```
Design the Lessons list. Top bar with back + title (skill name or "Хичээлүүд").
Optional row of CEFR level chips (A1–C2). A vertical list of lesson cards:
numbered tinted thumbnail + H3 title + caption description + level Pill +
either a 🔒 lock with Sparks price Pill, or "Үнэгүй" + chevron. Include
loading skeleton, friendly empty state ("...удахгүй нэмэгдэнэ 🦊"), error.
```

### 3. Lesson detail
```
Design the Lesson detail screen. Hero illustration header + H1 title + level
Pill + skill-type Pill. Content area (audio player "тун удахгүй" for listening,
text blocks for reading, fill-in exercise for fill). A locked variant: bottom
unlock sheet showing price + Sparks balance + "Нээх" button (disabled if
insufficient). Bottom primary CTA "Тест өгөх". CTA must dominate.
```

### 4. Quiz + result
```
Design the Quiz flow. Top bar with back + progress bar (question x/n) + small
XP reward indicator. Question card (H2). Answer cards for multiple_choice
(radio style) with 4 states: default, selected (purple), correct (green),
incorrect (red) — strong feedback. fill_blank uses a text field. Bottom
"Дараах" / "Дуусгах" button. Then a RESULT screen: big score + percentage +
passed badge + "+XP" reward + per-question breakdown + "Дахин" / "Хичээл рүү".
```

### 5. Swipe (learn words, Tinder-style)
```
Design the word-swipe screen. Top bar: back + progress bar + "{known} мэдсэн ·
{left} үлдсэн". A card stack: front card (draggable, rotates) shows the English
word large; tap to flip to Mongolian + example sentence; a peek of the next
card behind. Swipe right shows green "МЭДНЭ" badge, left shows red "МЭДЭХГҮЙ".
Three buttons below: ✗ (don't know) · ↺ (flip) · ✓ (know). Empty/done state:
"Бүх үгийг мэдлээ! 🎉" + count + "Нүүр рүү".
```

### 6. Review (SRS / spaced repetition)
```
Design the Review screen. Top bar: back + progress bar (reviewed/total). A word
card: front = English (large), tap to flip → Mongolian + example. After flip,
show 4 rating buttons: Again (red) · Hard (amber) · Good (green) · Easy (indigo).
Done state: "Өнөөдрийн давталт дууслаа 🎉" + XP/count + "Нүүр рүү".
```

### 7. AI Найз (chat)
```
Design the AI tutor chat screen (Spark Fox as English tutor). Top bar "AI Найз"
+ badge. Horizontal buddy selector: Спарк 🦊 (active) + others locked
("тун удахгүй"). Chat bubbles: AI = light surface bubble on the left with fox
avatar; user = purple bubble on the right. Empty state: fox + "Сайн уу! Би
Спарк 👋". Input bar at bottom: 🎤 mic (тун удахгүй) + multiline text field +
send (↑). Typing indicator "Спарк бичиж байна...". Feel like ChatGPT Voice /
Duolingo Max.
```

### 8. Soril / Games
```
Design the Soril (games) screen. H1 "Сорил & тоглоом" + subline. A 2-column
grid of game cards (icon tile + H3 + caption + XP Pill): Үг таах · Сонсох ·
Дүрэм · Хурдан хариулт · Холбох · Дүүргэх. A dark "Өдрийн сорил" daily-challenge
card with a progress bar (x/3) + bonus XP. Friendly "тун удахгүй" affordance.
```

### 9. Leaderboard
```
Design the Leaderboard. Top bar "Тэргүүлэгчид" + back. Segmented control for
period (Долоо хоног / Сар / Бүх цаг). Scope chips (Глобал / Аймаг / Дүүрэг). A
dark "Миний байр" card: rank + name + XP. Then a ranked list: rank badge (top 3
= gold/silver/bronze) + avatar + name + ⚡XP; highlight the current user's row
with a "(Та)" marker. Empty + loading states.
```

### 10. Profile
```
Design the Profile screen. Top bar "Профайл" + badge. Header card: fox avatar +
name + email + level Pill + edit button. Stat row: XP · Очир · Цуврал
(StatCards). "Мэдэх үг" card (known count) → links to Swipe. Dark Leaderboard
banner. Horizontal achievements strip (earned vs locked badges, rich 3D icons).
Settings ListRows: Хэл · Мэдэгдэл · Тусламж · Бидний тухай · Гарах. Plus a
Premium upsell card.
```

### 11. Onboarding + Auth
```
Design 3 onboarding slides (Spark Fox illustration + H1 + body, dots + "Дараах"
→ final "Эхлэх", "Алгасах" top-right):
  1 "Англи хэлийг тоглож сур"  2 "XP цуглуул, түвшингээ ахиул"  3 "AI найзтайгаа дадлага хий".
Then Login (logo + H1 "Тавтай морил" + identifier field + password field with
eye toggle + primary "Нэвтрэх" + link "Бүртгэлгүй юу? Бүртгүүлэх") and Register
(H1 "Бүртгүүлэх" + full name + email + password + province/district selects +
primary "Бүртгүүлэх"). Premium, spacious, mascot-led.
```

---

## Reminders for Figma Make
- Keep the **light theme** and **iPhone 16 Pro** frame consistent across screens.
- Always include **loading / empty / error** states (mascot-led, friendly).
- Cyrillic text must wrap cleanly — long Mongolian words should not clip.
- Reuse the Prompt-0 components; don't redefine styles per screen.
- When happy, use Code Connect / dev-mode to hand off to React Native.
```
