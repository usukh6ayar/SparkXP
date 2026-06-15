# EnglishXP (SparkXP) — Product Brief & Plan/Cost Guardrails

> **Эх сурвалж:** Hustle Hive LLC-ийн IT Team Brief + Strategy Recommendations +
> 34,000₮ / 56,000₮ plan cost breakdown (5 docx, 2026-06). Энэ файл нь тэдгээрийн
> **нэгтгэсэн товч** — хоёр dev-ийн Claude session-ийн нийтлэг лавлах. Дэлгэрэнгүй
> код дүрэм: `CLAUDE.md` · Роль: `ROLES.md` · Mobile: `MOBILE_ROADMAP.md` ·
> Backend: `ROADMAP.md` · Admin: `ADMIN_ROADMAP.md`.

---

## 1. Алсын хараа

Монгол сурагч/сургуульд зориулсан **геймжүүлсэн англи хэлний платформ**. Бүтэцтэй
хичээл + AI buddy + үгийн сан + speaking/listening + сургуулийн даалгавар + прогресс
+ шагнал. Зорилго: уламжлалт ангиас илүү **орчин үеийн, дадал болгодог, практик**.
Ялгарал: **мэргэжлийн AI Buddy дүрүүд** (цагдаа, эмч, хуульч, программист, бизнес...)
— roleplay/interview-ээр англи дадлага + career exploration.

**AI-г болгоомжтой:** өндөр сурах үнэ цэнэ, хатуу cost хяналт, богино interactive
яриа (урт monologue биш).

---

## 2. Роль (товч — дэлгэрэнгүй `ROLES.md`)

| Role | Гол үүрэг |
|---|---|
| **Student** | Үг/дүрэм/speaking/listening/reading сурах; XP/Sparks; AI buddy; даалгавар гүйцэтгэх |
| **Teacher** | Класс үүсгэх/удирдах, даалгавар явуулах, **прогресс/сул сэдэв/гүйцэтгэл/quiz оноо** харах |
| **School/Admin** | Класс/багш/захиалга/төлбөр/сурагчийн хандалт/тайлан удирдах |
| **Content/Admin** | Хичээл/үг/listening/quiz/зураг/audio оруулах |
| **Super Admin** | Хэрэглэгч/plan/AI limit/moderation/revenue/систем тохиргоо |

> ⚠️ Шийдвэр: **teacher эрхийг зөвхөн admin/super_admin олгоно** (`PATCH /users/:id`).
> Public register-ээр багшаар өөрөө бүртгүүлэхийг хаана (role = student default).

---

## 3. MVP хамрах хүрээ (IT Brief §3)

| Priority | Features |
|---|---|
| **Must** | Student account, **placement/level сонголт**, vocabulary, grammar micro-lesson, basic listening, quizzes, XP, **teacher class dashboard + даалгавар явуулах**, admin panel, basic **text** AI buddy |
| **Should** | Double-tap dictionary, хязгаартай AI **voice** speaking, progress analytics, streaks, basic Sparks, school subscription |
| **Later** | AI buddy marketplace, card battle, audiobook library, secure exam mode, creator buddies, profession scenario games, live teacher platform |

**Passive learning бүрд "proof of understanding"** (quiz/task/short answer) байж байж
бүтэн XP өгнө — зүгээр дэлгэц нээгээд XP авахгүй (anti-abuse).

---

## 4. Plan tier + хязгаар (cost docs)

| Plan | Үнэ/сар | AI voice | AI dictionary | Buddy memory | Нэмэлт | Operating cost target |
|---|---|---|---|---|---|---|
| **Free** | 0 | маш бага | бага | — | хязгаартай lesson/AI | < ~1,000₮ |
| **Standard** | **34,000₮** | **25 мин** | **300 үг** | **100MB** | mass market | ~12,850₮ (<13k) |
| **Premium** | **56,000₮** | **50 мин** | **700 үг** | **250MB** | premium buddy, **1.5× Sparks**, premium grammar/listening | ~20,000₮ |
| Premium Plus | дараа | 80–100+ мин | — | — | licensed teacher voice, deeper IELTS/profession | later upsell |

- **STT (user speech):** Standard ~75 мин · Premium 100–120 мин/сар (VAD-аар чимээгүй секунд тооцохгүй).
- **Marketing:** "50 мин AI voice" биш, "**3+ цаг speaking practice experience**" гэж байршуулна — гэхдээ backend дээр бодит cap хатуу.
- **Бүх limit-ийг app update-гүйгээр admin/DB-ээс өөрчилнө** (CLAUDE.md core rule).

---

## 5. AI / Voice стратеги + cost guardrails (ХАТУУ дүрэм)

- **Text AI** (buddy brain): богино reply, 1–2 өгүүлбэр, нэг correction. GPT-4-mini-class / Claude Haiku-class.
- **Voice AI** (TTS): ElevenLabs Flash/Turbo. AI reply **8–15 секунд**, үргэлж сурагчийг ярихад түлхэнэ.
- **Voice cap зан төлөв:** 80% ба 95%-д warning → cap хүрмэгц **voice зогсоно, text үргэлжилнэ**, **reset timer + upgrade** сонголт харуулна.
- **AI Dictionary** (Gemini 2.5 Flash-Lite, 4-section): эхлээд **DB/cache**-аас; Gemini-г зөвхөн шинэ үг / context / гүн тайлбар. `max_output_tokens ≈ 450–500`, Google Search grounding OFF. Ижил үгийг дахин генерэйт хийхгүй (cache).
- **Buddy memory:** бүх memory-г LLM-д явуулахгүй — store → retrieve → **short summary (50–200 token)** л context-д орно.
- **Media:** 4K asset stream хийхгүй — compressed + CDN cache.
- **Payment:** боломжтой бол **QPay / web / school invoice** (Apple/Google IAP 15–30% margin-д аюултай).
- **Fallback:** ElevenLabs унавал text mode үргэлжилнэ; Gemini унавал normal DB dictionary хариу.

### Per-user usage metering (backend заавал track)
`voice_seconds_used` · `stt_seconds_used` · `dictionary_ai_count` · `dictionary_cache_hit` ·
`ai_input_tokens` / `ai_output_tokens` · `memory_storage_mb` · `memory_retrieval_count` ·
`payment_status` · `abuse_flag`.

> Дүрэм: **usage metering + cap enforcement-ийг AI фичерээс дутуугүй чухал** гэж үзнэ.
> Limit байхгүй бол paid plan ашиггүй болно.

---

## 6. Core модулиуд (IT Brief §4) + одоогийн төлөв

| Module | Тайлбар | Backend төлөв |
|---|---|---|
| Auth & Profiles | login, profile, **level**, school/class, **English name**, avatar | ✅ (level/avatar/eng-name ⬜) |
| Learning Home | daily tasks, streak, XP, Sparks, level, **"Continue Learning"** | ⚠️ placeholder (streak/level/daily-XP tracking ⬜) |
| Vocabulary | word card, example, image, swipe, SRS, common meaning | ✅ (image/common-meaning ⬜) |
| Grammar | A1–B1 micro-lesson, mastery test, "ойлгохгүй" тайлбар | ⚠️ lesson type бий, mastery ⬜ |
| Listening | богино 1–3 мин passage, transcript, dict tap, дараа quiz | ⬜ |
| Speaking / AI Buddy | богино AI reply, voice cap, profession buddies | text ✅ · voice ⬜ (coming soon) |
| Teacher Dashboard | class, assignment, **progress, weak topics, completion, quiz score** | ✅ class/assignment/XP-progress · ⬜ completion/weak/score |
| Admin Panel | content/user/school/plan/AI monitor/report | ✅ (Bishrelt web) |
| Payments & Plans | monthly plan, pilot, school bundle | ✅ QPay stub |
| Gamification | XP(насан туршийн) · Sparks(зарцуулагддаг) · streak · badge · leaderboard | ✅ XP/Sparks/leaderboard · streak/badge ⬜ |

---

## 7. Data entity нэмэлт чиглэл (одоогийн 14 entity дээр)

- **User:** `level` (placement), `plan`, English name, avatar, usage meter талбарууд.
- **Organization** = School/company (бэлэн). **Class/Assignment** бэлэн; Assignment-д **completion data** нэмэх шаардлагатай (хэн дуусгасан).
- **AiUsage:** voice/stt секунд, dictionary count, token, memory — §5 metering.
- **Payment/Plan:** plan type, period, limit, status (бэлэн, өргөтгөнө).

---

## 8. Хөгжүүлэлтийн фаз (IT Brief §13-тай нийц)

- **Phase 1 — MVP:** student app, vocab, grammar, богино listening, quiz, XP, **teacher dashboard**, admin, **text** AI. *(backend бэлэн; mobile-д teacher + alignment үлдсэн)*
- **Phase 1.5:** хязгаартай **voice AI**, Sparks, streaks, basic payment, school pilot tool, analytics.
- **Phase 2:** AI buddy marketplace, richer speaking, audiobook/listening library, vocab battle, advanced grammar.
- **Phase 3:** secure exam mode, creator buddies, **live teacher platform**, profession scenario games, international.

---

## 9. Энэ brief-ээс үүдэх дараагийн ажил (хэн)

- **Mobile (Усухбаяр):** teacher role-based section (§6 Teacher) → student alignment (level/placement, English name, avatar, "Continue Learning" home, оноосон даалгавар харах, plan/limit badge). Дэлгэрэнгүй: `MOBILE_ROADMAP.md` Phase M5/M6.
- **Backend (хамт, coordinate):** Assignment **completion tracking** + per-student **quiz score** + **weak topics**; User `level`/`plan`; §5 **usage metering** талбарууд; AI Dictionary (Gemini) module; voice AI cap. Дэлгэрэнгүй: `ROADMAP.md` "Doc-aligned backlog".
- **Admin (Бишрэлт):** plan cap config (app update-гүй), AI cost dashboard (хэсэгчлэн бэлэн), school/teacher management, reports.
