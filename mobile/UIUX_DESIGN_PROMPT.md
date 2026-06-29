# SparkXP — UI/UX Design Generation Prompt

> Энэ файлыг AI design tool-д (Figma Make, v0, Galileo AI, Uizard, эсвэл
> ChatGPT/Claude-ийн дизайн горим) хуулж тавиад мобайл UI/UX гаргуулна.
> Доорх **MASTER PROMPT** нь бүх апп-ыг, дараагийн **PER-SCREEN** хэсэг нь
> дэлгэц тус бүрийг гаргуулах. Англиар бичсэн — дизайн tool-ууд англиар илүү
> сайн ажилладаг. (Брэнд эх сурвалж: `DESIGN.md`, `SCREEN_SPECS.md`.)
>
> ✅ **Чиглэл БАТЛАГДСАН (2026-06-29): ягаан `#6C3BFF`** — индиго хувилбар
> цуцлагдсан. Доорх токенуудыг яг хэвээр ашигла.
>
> **Mobile хуваарь:** эхлээд **design system + component sheet**-ийг хамт
> гаргуулж баталгаажуулна. Дараа нь дэлгэцээ тус тусдаа гаргуулна —
> **Choi:** Onboarding · Login · Register · Home · Lessons list · Lesson detail ·
> Review (SRS) · Swipe. **Boju:** Quiz · Soril · AI Найз chat · Leaderboard ·
> Profile. (Дугаарлалт доорх "SCREENS TO DESIGN" жагсаалттай тааруулсан.)

---

## MASTER PROMPT (paste this first)

You are a senior product designer. Design a **mobile app UI** (iOS + Android,
React Native) called **SparkXP** — a gamified English-learning app for
**Mongolian** students, university students and adult learners.

### Product feel
Blend **Duolingo's motivation**, **Quizlet's clarity**, **Superhuman's premium
feel**, and **Apple's cleanliness**. It must feel friendly and gamified but
**premium, not childish**. Easy to study, generous white space, soft and
spacious. Mascot: a cute purple **fox** named SparkXP (friendly, modern, not
cartoonish-cheap).

### Audience & language
- **Mongolian-first** UI text (Cyrillic), English secondary. Use a
  **Cyrillic-safe** font. Keep labels short.
- Works for kids, students, and adults — clean and respectful, not babyish.

### Design tokens (use exactly)
**Colors**
- Primary (purple): `#6C3BFF` · 600 `#5A28F0` · 700 `#4B1ED8`
- Primary gradient: `#7A4DFF → #6C3BFF → #5A28F0` (CTAs, progress, XP, active)
- Success/green `#22C55E` (completed, reading) · Warning/orange `#FF8A00`
  (streak, daily missions) · Info/blue `#3B82F6` (writing, stats)
- Background `#F8F8FC` · Cards `#FFFFFF` · Secondary surface `#F2F3FA`
- Gamification accents: **XP = gold**, **Gem/Sparks = blue**, **Streak = orange flame**

**Typography** — Inter / SF Pro. H1 36 Bold · H2 28 Bold · H3 22 SemiBold ·
Body 16 Medium · Caption 13 Medium.

**Radius** — small 12 · medium 20 · large 28 · hero cards 32 · avatars 999.

**Shadows** — cards `0 8 24 rgba(0,0,0,0.06)` · floating
`0 12 30 rgba(108,59,255,0.20)`.

**Spacing** — 8px base (8/12/16/20/24/32). Avoid cramped layouts; large white
space encouraged.

### Components (build a small reusable kit)
Primary/secondary/ghost buttons (pill, gradient on primary), text & select
fields, cards, progress bars & rings, XP/gem/streak chips, skill category tiles
(Listening / Reading / Fill-in / Writing), lesson row with lock + progress,
bottom tab bar with a **center floating AI-buddy avatar**, top app bar with
streak + XP + gem counters, modals/sheets, toasts, empty states, skeleton
loaders.

### Navigation
Bottom tabs: **Home · Lessons · (center) AI Найз · Leaderboard · Profile**.
The center tab is a floating circular AI-buddy avatar.

### Deliverable
- A cohesive **design system** (color, type, spacing, components) +
  **high-fidelity mockups** of every screen listed below.
- Show **light mode** (primary). Optional dark mode as a bonus.
- 1080×2340 (or 390×844 pt) phone frames. Consistent spacing & alignment.
- Clean, production-ready, pixel-aligned. No lorem-ipsus gibberish — use
  realistic Mongolian copy (examples below).

Confirm the design system first, then output the screens.

---

## SCREENS TO DESIGN

1. **Onboarding** (3 slides) — fox mascot, value props, "Эхлэх" CTA.
2. **Login** — username/email + password, "Нэвтрэх", social/optional, link to register.
3. **Register** — name, username, email, password; province/school optional.
4. **Home / Dashboard** — greeting + streak, "Үргэлжлүүлэх" continue-learning
   card, daily mission, XP/level ring, 4 skill tiles (Сонсгол·Унших·Нөхөх·Бичих),
   leaderboard peek.
5. **Lessons list** — filter by skill type; lesson rows with lock + progress + XP reward.
6. **Lesson detail** — header, content blocks (audio/text), progress, "Эхлүүлэх".
7. **Review (SRS)** — spaced-repetition card flow, "Мэдсэн / Дахих".
8. **Swipe (vocabulary)** — Tinder-style word cards (word, image, meaning, audio), swipe save/skip.
9. **Soril / Games** — game/quiz hub tiles.
10. **Quiz** — multiple-choice, progress bar, instant correct/incorrect feedback, XP reward screen.
11. **AI Найз (chat)** — chat with the buddy avatar, message bubbles, suggestions, voice "coming soon".
12. **Leaderboard** — XP ranking, scope tabs (Global/Province/Class), top-3 podium, your rank chip.
13. **Profile** — avatar, level, XP/streak/gem stats, achievements, settings.

For each screen show: full mockup, key states (loading/empty/error where
relevant), and note the components used.

---

## PER-SCREEN PROMPT (template)

> Design the **<SCREEN NAME>** screen for SparkXP using the design system above.
> Goal: <one-line purpose>. Must include: <key elements>. Mongolian copy.
> States: default + <loading/empty/error>. Keep it premium, spacious, on-brand
> (purple `#6C3BFF`, gold XP, orange streak, blue gem, fox mascot).

Example (Home):
> Design the **Home / Dashboard** screen for SparkXP. Goal: motivate the user to
> continue today's learning at a glance. Include: top bar with streak 🔥, XP gold
> chip and gem 💎 chip; a big gradient "Үргэлжлүүлэх" card showing the current
> lesson + progress; a daily-mission card (orange); an XP/level ring; four skill
> tiles (Сонсгол · Унших · Нөхөх · Бичих) with category colors; a small
> leaderboard peek with the user's rank. Mongolian copy, premium and spacious.

---

## TIPS
- Generate the **design system + component sheet first**, then screens — keeps
  everything consistent.
- Ask for an **8px grid** and **auto-layout/components** so it's dev-handoff ready.
- Keep the fox mascot consistent (same character) across onboarding, chat, empty states.
- If the tool supports it, request **a Figma file with shared styles + variants**.
