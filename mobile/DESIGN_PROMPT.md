# SparkXP — UI Design Generation Prompts

Use these with an AI design tool (Midjourney, v0.dev, Figma AI, Galileo, DALL·E,
etc.). Paste the **Master style block** first, then append one **Screen** block.
Based on the hand-drawn sketches + SparkXP brand.

---

## 🎨 Master style block (prepend to every screen prompt)

```
Mobile app UI design, portrait, 1080x2340 (9:19.5). Modern, playful, gamified
language-learning app in the style of Duolingo — friendly, rounded, colorful,
encouraging.

App: "SparkXP", an English-learning app for Mongolian students.
Mascot: a cute running orange fox with a sparkle (energetic, friendly).

Brand colors:
- Primary orange #F47B20 (buttons, XP, highlights)
- Deep navy #182547 (text, headings)
- Cream #FBF4E6 (warm surfaces)
- Amber #FFB020 (Sparks/coins)
- White #FFFFFF background, light grey #F6F7FB cards

Style: big rounded corners (16–24px), soft shadows, thick friendly rounded
sans-serif (like Feather/Nunito), bold headings, generous spacing, large
tappable buttons with a 3D "pressed" bottom edge (Duolingo button style),
flat cheerful illustrations, progress rings, XP/streak/coin badges.
All UI text in MONGOLIAN (Cyrillic). High quality, clean, professional, no
clutter. Flat vector style, not photorealistic.
```

---

## 📱 Screen 1 — Home / Нүүр

```
Home screen. Top: SparkXP logo (running orange fox) on the left, a streak flame
badge "🔥 5" and Sparks coin "✨ 120" on the right. Greeting "Сайн уу, Бат! 👋".
A big progress bar / progress ring showing daily goal ("Өнөөдрийн зорилго").
Below: a 2-column grid of large rounded category cards, each with a flat icon
and label: "Хичээлүүд" (lessons, book icon), "Үг давтах" (review, cards icon),
"Сорил" (quiz), "AI Найз" (fox/chat icon). A primary orange CTA button "Суралцаж эхлэх".
Bottom tab bar with 4 icons: Нүүр (home), AI Найз (center, raised fox button),
Quiz, Профайл. Cheerful, lots of orange and navy.
```

## 📱 Screen 2 — Lessons list / Хичээлүүд

```
Lessons list screen. Header "Хичээлүүд". A vertical scrolling list of lesson
cards, each card rounded with: a colorful thumbnail/illustration on the left,
lesson title (e.g. "Амьтад", "Хоол хүнс", "Аялал") in navy bold, a short
subtitle, a small level tag (A1/A2), and a progress bar or a lock icon for
locked lessons (with a Sparks price "✨ 50"). Completed lessons show a green
check. Duolingo-style learning-path feel. Clean white background.
```

## 📱 Screen 3 — Lesson detail / Хичээл

```
Lesson detail screen. Header with back arrow "‹" and lesson title, plus prev/
next arrows "‹ 1/1 ›". A vertical list/path of 4 numbered lesson units (1, 2, 3,
4) shown as rounded step nodes connected like a path (Duolingo skill path), each
with an icon and a state (done = green check, current = orange highlight, locked
= grey). Bottom: two big rounded buttons side by side — secondary "Буцах" and
primary orange "Тест өгөх". Caption "Тест өгөх эсвэл дараагийн хичээл".
Encouraging, game-like.
```

## 📱 Screen 4 — Сорил & games / Сорил

```
Сорил & games screen ("Quiz & games" in MN = "Сорил"). Header "Сорил & тоглоомууд". A 2-column grid of large
rounded game-mode cards, each with a fun flat icon and label: "Үг таах",
"Сонсох", "Дүрэм", "Хурдан хариулт", "Холбох", "Дүүргэх". Each card a different
bright brand-tinted color, with an XP reward badge "⚡ 10". Playful, arcade-like
but clean. Fox mascot peeking in a corner.
```

## 📱 Screen 5 — AI buddy / AI Найз

```
AI buddy screen. Header "AI Найз". Top: a row of friendly character avatars
(the orange fox + a few other cute tutors) to choose from, with a "Бүгдийг
харах" (see all) link. Below: a chat interface — assistant message bubbles on
the left (cream), user bubbles on the right (orange), a text input at the bottom
"Мессеж бичнэ үү..." with a send button. Warm, friendly, conversational.
Speech bubbles rounded.
```

## 📱 Screen 6 — Profile / Профайл

```
Profile screen. Header "Профайл". Top: large circular avatar, name "Бат Болд",
location "Улаанбаатар, Сүхбаатар". A row of stat cards: "⚡ 1240 XP",
"✨ 120 Очирхон", "🔥 5 өдөр". A leaderboard rank badge. A list of settings rows
("Профайл засах", "Хэл", "Тусламж", "Гарах"). Achievements/badges row with
fox-themed medals. Clean, rounded, brand colors.
```

---

## 💡 Зөвлөмж

- **Midjourney/DALL·E:** master block + 1 screen-ийг нийлүүлж нэг нэгээр нь өг.
  Төгсгөлд `--ar 9:19.5 --style raw` (Midjourney) нэмж болно.
- **v0.dev / Figma AI:** энэ prompt-уудыг шууд өгвөл бодит React/Figma frame
  гаргана (код хүртэл). Манай brand theme (`src/theme/theme.ts`)-той тааруулна.
- **Galileo AI / Uizard:** скетч зургаа + master block-ийг оруулж "Duolingo
  style" гэж нэм.
- Бүх дэлгэцэд **ижил мaccот (үнэг), өнгө, фонт** хадгалуулахын тулд master
  block-ийг үргэлж эхэнд нь тавь.
```
