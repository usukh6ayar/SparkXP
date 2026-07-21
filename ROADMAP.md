# SparkXP — ROADMAP (хэн юу хийх + Launch + Update давалгаанууд)

> Шинэчилсэн: **2026-07-21**. Дэлгэрэнгүй бүтээгдэхүүн/зардал/ирээдүйн төлөвлөгөө:
> **`docs/FUTURE_PLAN.md`**. Багийн дүрэм: **`CLAUDE.md`**.
>
> **Гол огноо (шинэчилсэн):** анхны 07.09 target **хойшилсон** (UI/UX өнгөлгөө +
> store setup дуусаагүй). Шинэ target: `~08.05` — TestFlight/Play internal · `08.15`
> — бүрэн дуусгах. Store-д гаргах бодит blocker-уудыг §3-т жагсаав.
> **Push:** өөрийн branch → PR → `main` (GitHub `origin`). Task бүрийн өмнө `main` pull.

---

## 1. Хэн юу хийх (owners)

| Dev | Хариуцах хэсэг | Branch | Гол ажил |
| --- | --- | --- | --- |
| **Өсөхбаяр** (lead) | `/backend` + `/admin` | `usukhbayar` | Endpoints, DB, migration, admin panel, prod deploy (Railway), `API.md` |
| **Choi** | `/mobile` learning core | `choi` | Auth, Home, Lessons (list+detail), Reading, Review/SRS, Swipe + Saved |
| **Boju** | `/mobile` games & social | `boju` | Quiz/Soril, AI chat, Idioms, Leaderboard, Profile/Avatar/Assignments, Teacher, Join |

**Дүрэм:** Choi/Boju нь `/backend` шууд засахгүй → endpoint-ийг Өсөхбаяр-аас
хүсэн авна. Shared mobile файл (`theme.ts`, `components/`, `_layout.tsx`) →
эхлээд CLAUDE.md-д зарлаад, жижиг PR-аар оруулна.

---

## 2. Одоо хэрэгжсэн (baseline — 2026-06-30)

Дэлгэрэнгүйг `docs/FUTURE_PLAN.md → §1`. Товчоор:
- **Mobile:** Auth, Home (XP/Streak/Continue), Lessons + видео + дараах тест,
  Дасгал, Swipe үг + SRS, Reading (tap-to-translate), Idioms, Сорил, AI text chat,
  Leaderboard, Profile/Avatar, Багшийн хэсэг (анги/QR/батлах/даалгавар).
- **Admin:** Хичээл/Үг/Сорил/Reading/Idiom/Дасгал контент + AI үүсгэлт (Gemini
  текст, OpenAI зураг, ElevenLabs дуу), CSV/Bulk, Хэрэглэгч/Анги/Байгууллага,
  Төлбөр/багц, AI статистик, Push, Leaderboard.

---

## 3. App Store-д гаргахаас ӨМНӨ хийх ажил (launch blocker) 🚀

> Энэ бол **launch блокер** жагсаалт. Анхны 07.09 target хойшилсон. UI/UX
> өнгөлгөөний ихэнх нь хийгдсэн (доор ✅), гэхдээ **store setup + хэдэн критик
> зүйл дутуу** (fonts, app icon PNG, EAS init, taste-task onboarding).

### 🧑‍🤝‍🧑 Launch ажлын хуваарь (2026-07-21)
> **Choi → AI buddy бүхэлдээ.** Үлдсэнийг **Өсөхбаяр (backend/infra/store) ↔ Boju
> (mobile UX)** хоёр хуваана.

| Хэсэг | Owner | Ажил |
| --- | --- | --- |
| **Store + infra** | **Өсөхбаяр** | Railway Hobby + prod migration бүх table; EAS `init` (projectId); **app icon 1024 PNG + splash** (`app.json`); eas.json submit creds; Apple($99)/Google($25) account; App Store material (screenshot/description/privacy/data-safety) |
| **Backend endpoint** | **Өсөхбаяр** | `C1-BE` lesson progress %; `C2-BE` `POST /quizzes/:id/check`; `C4-BE` public sample endpoint + guest→user migration |
| **Mobile UX** | **Boju** | `C1` Home нэг primary hero; `C2` quiz асуулт-бүрийн шууд feedback; `C4` taste-task онбординг + guest mode; **фонт (Onest/Inter) ачаалах** (`_layout.tsx` — shared, зарлаад PR); real gamification data (placeholder → бодит); regression pass (learning-core + games) |
| **AI Buddy** | **Choi** | 3D avatar дуусгах (optimize GLB <5MB → R2 → admin `avatarAssetUrl`); `C3` buddy scaffold (starter prompt + voice-минут үлдэгдэл + limit→текст зөөлөн шилжих) |

> ⚠️ `C1`/`C4` анх Choi-д байсан → одоо **Boju** авна (Choi buddy-д). `_layout.tsx`
> (фонт) shared учир Boju эхлээд зарлаж, жижиг PR-аар оруулна.

### ✅ UI/UX өнгөлгөө — хийгдсэн (2026-07-21, кодоос баталсан)
- [x] **Responsive** — бүх дэлгэц утасны хэмжээнд тохирно (`src/theme/responsive.ts`,
      commit `a564d6c`).
- [x] **Delight давхарга** — haptics, motion, Button glow, tab/progress animation
      (Stage 1/2/3).
- [x] **Skeleton loading** — Home + гол дэлгэцүүд (0-оос үсрэхгүй).
- [x] **Tab bar** — Duolingo-style flat, AI buddy төв таб **шошготой** (`aiBuddyShort`).
- [x] **Онбординг redesign** — full-bleed artwork + frosted glass (⚠️ taste-task/guest
      хувилбар БИШ — доорх C4 харна уу).
- [x] **Chat** — frosted-glass bottom sheet, typing indicator, олон-thread түүх,
      buddy selector, voice stage.
- [x] **Quiz** — үр дүнгийн **баяр (Confetti + haptics + combo)**. ⚠️ асуулт бүрийн
      шууд feedback БИШ — доорх C2.
- [x] **Notification center** + header bell, content progress, account hub.
- [x] **Asset perf** — PNG→WebP (46MB→5MB), expo-image + Cloudinary.
- [x] **Reading** — олон-үг span сонголт → орчуулга.
- [x] **Referral/invite** систем.

### ⚠️ Critical UX (C1–C4) — `mobile/UX_CRITICAL_SPEC.md` төлөв
| # | Item | Төлөв | Дутуу |
| --- | --- | --- | --- |
| C1 | Home нэг primary hero | 🔶 хагас | 4 skill tile primary хэвээр; real progress (C1-BE) алга |
| C2 | Quiz асуулт-бүрийн шууд feedback | 🔶 хагас | баяр ✅, гэхдээ `POST /quizzes/:id/check` (C2-BE) байхгүй |
| C3 | Buddy tab уншигдахуйц + scaffold | 🔶 хагас | таб шошго ✅, starter prompt + voice-min remaining алга |
| C4 | Auth-аас өмнө үнэ цэн (taste-task) | ❌ эхлээгүй | guest mode + public sample endpoint (C4-BE) хэрэгтэй |

### Өсөхбаяр (Backend + Admin)
- [ ] **Прод migration бүрэн гүйцэх** (`DB_SYNCHRONIZE=false` дээр гараар):
      `reading_passages`, `translations`, `idioms` table + `synonyms`/`antonyms`
      багана + `reading` enum утга. (`src/migrations/` шалгах.)
- [ ] **AI Buddy voice (branch `feature/ai-buddy-backend`)** — прод migration
      `CreateAiBuddyVoice1782400000000` (шинэ `buddy_sessions`/`buddy_memories`/
      `buddy_voice_cache`/`safety_events` table + `messages`/`ai_buddies` багана).
      Шинэ env: `STT_PROVIDER`/`LLM_PROVIDER`/`TTS_PROVIDER`/`AI_BUDDY_LOG_RAW_AUDIO`/
      `AI_BUDDY_AUDIO_RETENTION_DAYS`. Дэлгэрэнгүй: `docs/AI_BUDDY_PLAN.md`.
      Дараагийн: admin UI (Part 2), mobile+3D avatar (Part 3/4 — Boju).
- [ ] Prod дээр бүх шинэ endpoint ажиллаж буйг шалгах (Railway).
- [ ] `.env.example` бүрэн (бүх шаардлагатай key placeholder-тэй); real key
      commit хийгдээгүйг баталгаажуулах.
- [ ] AI usage limit / rate-limit prod дээр асаалттай эсэхийг шалгах.
- [ ] Admin бүх list page pagination + bulk ажиллаж буйг шалгах.
- [ ] `API.md`-г одоогийн endpoint-уудтай тааруулж шинэчлэх.

### Choi (Mobile — learning core)
- [ ] Auth → Home → Lesson → Quiz → Review бүх урсгалыг **гараар турших**, алдаа засах.
- [ ] Placement / level сонголтын урсгал (A1–B1) шалгах.
- [ ] Reading tap-to-translate + audio prod дээр ажиллаж буйг шалгах.
- [ ] Loading / empty / error state-үүд бүх дэлгэц дээр байх.
- [ ] Жагсаалт + зураг performance (FlatList, image cache).

### Boju (Mobile — games & social)
- [ ] Quiz/Soril, Idioms, Leaderboard, Profile, Teacher, Join урсгалыг турших, алдаа засах.
- [ ] AI chat prod endpoint-той холбогдож буйг шалгах (limit warning харагдана).
- ⚠️ **AI Buddy mobile UI-г Choi аль хэдийн барьсан (branch `choi` / PR) — ДАВХАР ХИЙХГҮЙ.**
      Хийгдсэн: buddy сонголт (`BuddySelector`), voice stage (`BuddyVoiceStage`),
      бичгийн чат + **ChatGPT маягийн олон-thread түүх** (`chat.tsx` + `TopBar`
      history товч + `ChatHistoryPanel`), `api/ai.ts` (`resumeBuddyTextSession`
      opts, `listBuddyTextSessions`), i18n. Backend: `resumeTextSession` opts +
      `GET /ai/buddy/text-sessions` (Өсөхбаяр review-д). Өөрчлөх бол эхлээд Choi-той ярь.
- 🔄 **3D AI Buddy avatar — Choi ХИЙЖ БАЙНА (in progress, 2026-07-21).** Код орсон
      (`01d5312` Meshy GLB + procedural lip-sync), гэхдээ дуусаагүй: optimize хийсэн
      rigged GLB (<5MB) → R2 → admin `avatarAssetUrl` үлдсэн (`docs/LAUNCH_FROM_SCRATCH.md`
      §7). ⚠️ Store rebuild ШААРДЛАГАГҮЙ (three/expo-gl аль хэдийн bundle-д орсон) →
      OTA-гаар нэмнэ. Boju зөвхөн limit-warning тестээр үргэлжилнэ. Boju/Choi давхардуулахгүй.
- [ ] Багшийн урсгал (анги үүсгэх → QR/код → сурагч батлах → даалгавар) бүрэн тест.

### 🚨 Store setup — бодит blocker (шинэчилсэн 2026-07-21)
- [x] **EAS холбогдсон** — `eas init` (2026-07-21). Expo project үүссэн
      (`@usukh6ayar/englishxp`), `app.json` `extra.eas.projectId` =
      `d5b190dd-0fb6-4684-8aff-4648fb0f0357`.
- [ ] **App icon 1024 PNG (альфагүй)** — fox-badge (`buddy-menu`)-аас туршиж үзсэн
      боловч **зөвшөөрөгдөөгүй** → зохих icon дизайн шаардлагатай (1024×1024 PNG,
      альфагүй). `app.json` одоо `logoSparkXP.webp` руу заасан (түр).
- [ ] **Splash screen** — `assets/splash.png` + `expo-splash-screen` тохиргоо (fox/logo
      on `#191040`). Store blocker биш ч launch-д хэрэгтэй.
- [ ] **Cyrillic фонт (Onest/Inter) ачаалагдаагүй** — `assets/fonts/` алга,
      `useFonts` дуудлага алга. `_layout.tsx`-д ачаалах (Boju).
- [ ] **eas.json iOS submit блок** — Apple creds алга байсан тул түр **хассан**
      (`appleId`/`ascAppId`/`appleTeamId` хоосон байвал `eas` validation унадаг).
      Apple account гарахад буцааж нэмнэ. Android `google-service-account.json` алга.
- [ ] Apple Developer ($99) + Google Play ($25) бүртгэл.
- [ ] App Store material: **Icon, Screenshots (MN/EN), Description, Privacy Policy URL**,
      Play **Data Safety** форм (mic/camera зөвшөөрөл).

### Хамтын (launch bundle)
- [ ] Бодит gamification өгөгдөл (streak/level/progress placeholder-ийг солих).
- [ ] Бүх hardcoded content DB-рүү (Core Rule) — шалгах.
- [ ] Regression pass: гол урсгалуудыг бодит утсан дээр турших.

### ➕ Нэмэлт ажил — Critical UX-ийн дутууг дуусгах (§3 дээрх C1–C4)
- [ ] **C1** Home — 4 skill tile-ийг compact quick-row болгож, нэг primary "Continue/
      Start" hero гаргах (Choi). **C1-BE:** lesson-ийн бодит ахиц гаргах endpoint
      (Өсөхбаяр — одоо `/lessons/:id/complete` л байна, progress %-гүй).
- [ ] **C2** Quiz асуулт бүрийн шууд feedback (ногоон/улаан + зөв хариу) — Boju.
      **C2-BE:** `POST /quizzes/:id/check` (нэг хариу шалгах, бүх хариу задлахгүй) —
      Өсөхбаяр (одоо зөвхөн `/submit` байна).
- [ ] **C3** Buddy эхний-нээлт scaffold: 3–4 starter prompt + voice-минут үлдэгдэл
      харуулах, limit → текст рүү зөөлөн шилжих — Boju.
- [ ] **C4** Taste-task онбординг (auth-аас өмнө +XP) + guest mode — Choi.
      **C4-BE:** JWT-гүй public sample endpoint + guest→user progress migration — Өсөхбаяр.

---

## 4. Launch-ийн ДАРАА — Update давалгаанууд 📦

> Бүх update `main` → Railway (backend/admin) + App Store update (mobile) руу
> шат дараатай гарна. Хугацаа = `docs/FUTURE_PLAN.md → §3`.

### 🌊 Update 1 — Payments & Engagement (07.09 – 08.15)
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| **QPay төлбөр** | Өсөхбаяр | Premium багцын бодит төлбөр (Payment entity + QPay webhook + багц config) |
| Багц/plan limit config | Өсөхбаяр | Voice/token/dictionary/Sparks limit-ийг admin/DB-ээс (апп шинэчлэлгүй) |
| **Badge & Achievement** | Boju | Achievement badge систем + Profile дээр харуулах |
| **Push Notification** | Өсөхбаяр (BE) + Choi/Boju (FE) | Streak сануулга, даалгавар, шинэ контент push |
| Streak сайжруулалт | Choi | Streak freeze/reminder, өдрийн зорилго логик |

### 🌊 Update 2 — Speaking & Voice AI (2026 оны 8-р сар)
> ⚠️ Хамгийн өндөр зардалтай хэсэг → **AI Gateway + guardrail** заавал (FUTURE_PLAN §4).
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| **AI Найз Voice Chat** | Өсөхбаяр (BE) + Boju (FE) | ElevenLabs TTS, богино reply (8–15 сек), voice minute cap + 80/95% warning |
| **Speaking Practice / STT** | Өсөхбаяр (BE) + Boju (FE) | ElevenLabs Scribe STT + VAD, дуудлага шалгах, нэг correction |
| Төрөлжсөн AI багш | Өсөхбаяр + Boju | Мэргэжлийн buddy persona (эхний хувилбар) |
| AI Gateway limit/logging | Өсөхбаяр | Per-user limit, cost tracking, Message history — voice гарахаас өмнө |

### 🌊 Update 3 — Reading & Content 2.0 (2026 оны 8-р сар)
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| **Reading шинэчлэлт** | Choi | Ахиц хадгалах, номын сан, шинэ үгийн статистик, аудио дагаж унших |
| Vocabulary статистик | Choi | Сурсан үгийн тоо, mastery indicator |
| Контент нэмэлт | Өсөхбаяр (admin) | Илүү олон хичээл/үг/reading (A1–B2) |

### 🌊 Update 4 — Teacher Panel 2.0 (deep) (08.10 → цаашид)
> Дэлгэрэнгүй: `docs/FUTURE_PLAN.md → §6`. Language center/school-д зарах гол feature.
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| Teacher Dashboard | Boju (FE) + Өсөхбаяр (BE) | Total/Active students, avg progress, speaking this week |
| Class Detail | Boju + Өсөхбаяр | Weakest topic, performance graph, top mistakes |
| Student Progress | Boju + Өсөхбаяр | Skill breakdown, common mistakes + AI suggestion, feedback |
| Assign Task 2.0 | Boju + Өсөхбаяр | Task types, due date, submission tracking (`assignment_submissions`) |

### ♾️ Тогтмол — Performance & Stability
- Cache (Redis), server optimization, error monitoring, crash logs.
- Leaderboard-д Redis ZSET (scale хэрэгтэй болвол).
- Speaking AI-г queue/worker-т (BullMQ) тусгаарлах.

---

## 5. Дараагийн давалгаа (Later — тодорхой огноогүй)
`docs/FUTURE_PLAN.md → §3 (Later)`: AI Buddy marketplace, Duolingo-style lesson
path, card battle / rare-epic pack, profession scenario games, secure exam mode,
full audiobook library, live teacher platform, creator AI buddies, олон улсын өргөтгөл.

---

## 6. Timeline (нэг харцаар)

```
07.21 ──────────── ~07.28 ──── ~08.05 ──────────── 08.10 ──── 08.15
  │                   │            │                    │          │
  UI/UX ихэнх ✅      store setup  TestFlight/         бүрэн     production
  store blocker       (EAS/icon/   Play internal       дуусгах   тогтвортой
  + C1–C4 дутуу       font/accts)  анхны хувилбар
```
> Анхны 07.09 target хойшилсон. Одоогийн байдал: UI/UX өнгөлгөө хийгдсэн, store
> setup (EAS init, icon PNG, фонт, Apple/Google account) + Critical UX C1–C4 дутуу.
