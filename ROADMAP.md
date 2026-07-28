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
> өнгөлгөөний ихэнх нь хийгдсэн (доор ✅).
>
> **🔄 2026-07-28 — кодоос дахин баталсан.** Өмнө "дутуу" гэж бичсэн 4 зүйлээс
> **3 нь аль хэдийн хийгдсэн** байсан: фонт (`useFonts` → `_layout.tsx:122`),
> app icon (`assets/icon-ios.png` 1024×1024 + `icon.png` 1254×1254),
> EAS init (`extra.eas.projectId` жинхэнэ). Taste-task онбординг ч ✅ (C4).
> **Үнэхээр үлдсэн store блокер:** `splash` тохируулаагүй · iOS/Android
> **bundle ID зөрүү** · eas.json submit creds хоосон.
> Кодын талын бүрэн олдвор → **`docs/CODE_AUDIT.md`** (migration гинж тасарсан,
> `JWT_SECRET` default, rate limit алга гэсэн 3 өндөр эрэмбийн зүйл багтсан).

### 🧑‍🤝‍🧑 Launch ажлын хуваарь (шинэчилсэн 2026-07-21 — 3-талт тэнцүү)
> Ажлыг **3-уулаа тэнцүү** хуваав. **3D AI buddy avatar-ыг хамгийн СҮҮЛД, 3-уулаа
> хамт** хийнэ (доор). `C2` ✅ дууссан. Regression-ыг хүн бүр өөрийн хэсэгт хийнэ.

| Owner | Ажил (тэнцүү 3 багц) |
| --- | --- |
| **Өсөхбаяр** (backend/admin/infra) | Railway Hobby + **бүх prod migration** (reading/idioms/translations/ai-buddy-voice/**IELTS**); 🆕 **`docs/CODE_AUDIT.md`-ийн 3 өндөр эрэмбэ**: migration гинж засах (`CreateAssignmentCompletions`) · `JWT_SECRET` fail-fast · rate limit (`@nestjs/throttler`) + helmet; `C1-BE` ✅ · `C2-BE` ✅ · `C4-BE` ✅; **IELTS Plan 2 — admin authoring**; Apple($99)/Google($25) account + EAS submit config |
| **Choi** (mobile — learning + IELTS L/R) | ✅ бүгд дууссан (2026-07-22): `C1` Home hero (FE) · `C4` taste-task онбординг (FE) · **IELTS Plan 3a — `/ielts` hub + L/R runner (band)** · фонт (Onest/Inter). Үлдсэн: бодит утсан дээрх regression тест |
| **Boju** (mobile — buddy/games + store) | `C3` buddy scaffold (starter prompt + voice-минут үлдэгдэл + limit→текст); **`C2` FE утас** — `POST /quizzes/:id/check`-ийг асуулт бүрийн шууд feedback-т холбох (BE бэлэн); real gamification data (placeholder → бодит); **IELTS Plan 3b — Writing/Speaking практик дэлгэц** (model-answer reveal); **splash + App Store material** (screenshot/description/privacy/data-safety) — *icon ✅ хийгдсэн* |

> **🟪 3D AI buddy — ХАМГИЙН СҮҮЛД, 3-уулаа хамт:** optimize rigged GLB (<5MB) → R2
> upload → admin `avatarAssetUrl` → mobile wire + procedural lip-sync + утсан дээр тест.
> (Код суурь орсон — `01d5312`. Store rebuild шаардлагагүй, OTA.)

> ⚠️ Тэмдэглэл: `C1`/`C4` FE = Choi, IELTS mobile-ыг Choi(L/R) ↔ Boju(W/S) хуваасан.
> Shared файл (`_layout.tsx`/`Home`/`theme.ts`) → эхлээд зарлаад жижиг PR.

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
| C1 | Home нэг primary hero | ✅ дууссан | skill tile → compact quick-row (`dd7bc3a`); hero нь `GET /lessons/continue`-ийн **бодит** level ахицыг харуулна |
| C2 | Quiz асуулт-бүрийн шууд feedback | 🔶 хагас | **BE ✅ дууссан** — `POST /quizzes/:id/check` (`quizzes.controller.ts:138`). Үлдсэн нь зөвхөн **FE утас** (Boju) |
| C3 | Buddy tab уншигдахуйц + scaffold | 🔶 хагас | таб шошго ✅, starter prompt + voice-min remaining алга |
| C4 | Auth-аас өмнө үнэ цэн (taste-task) | ✅ дууссан | BE ✅ (PR #143) + FE ✅ (2026-07-22): онбординг → `/(auth)/taste` 3 асуулт (public `/words/sample`, локал шалгалт) → register `tasteCompleted` → verify дээр +10 XP |

### Өсөхбаяр (Backend + Admin)

#### ✅ Choi-гийн PR #170-ийн 2 BE хүсэлт — хариу (2026-07-27) · ДАВХАРДУУЛАХГҮЙ

| # | Хүсэлт | Төлөв |
| --- | --- | --- |
| 1 | `UpdateProfileDto`-д `username` + давхардлын 409 | ✅ **Хийгдсэн.** DTO-д `username` нэмсэн (`@IsUsername()`); `UsersService.assertUsernameFree()` 409 шиднэ; өөрийн нэрээ дахин илгээх нь зөрчил биш; unique index-ийн `23505` race-ийг мөн 409 болгож барина |
| 2 | Багшийн roster / ахиц `avatarUrl` буцаах | ✅ **Аль хэдийн буцаадаг байсан — код өөрчлөөгүй.** Доорх бодит шалгалт хар |

**Username солих дүрэм** нэг газар төвлөрсөн: `src/common/validation/username.ts`
(`@IsUsername()` — 3–30 тэмдэгт, `a-zA-Z0-9_`). `RegisterDto` мөн үүнийг хэрэглэнэ,
mobile талын `src/lib/username.ts`-тэй яг тохирно. Шалгалт нь **том/жижиг үсэг
ялгахгүй** болсон (өмнө нь `Bataa` ба `bataa` хоёр өөр данс болж чаддаг байсан) —
register-т мөн үйлчилнэ. Дэлгэрэнгүй: `API.md` §2.

**QA #11 / #15 (сурагчийн зураг багшийн талд гарахгүй) — BE талын алдаа БИШ.**
Локал API дээр бодитоор дуудаж баталсан (сурагч `default:av3` сонгосон):
```
GET /classes/:id            → students[]: {"fullName":"…","avatarUrl":"default:av3"}
GET /classes/:id/students/:sid/progress → {"fullName":"…","avatarUrl":"default:av3"}
```
`sanitizeUser` нь зөвхөн `passwordHash`-ыг хасдаг тул roster · join requests ·
progress бүгд бүтэн `SafeUser` (⊃ `avatarUrl`) буцаана. Тиймээс бодит шалтгаан
хоёрын нэг:
1. Тухайн сурагчдын `users.avatar_url` = `NULL` (зураг тавиагүй) → mobile `Avatar`
   нэрнээс нь сонгосон **бэлэн зураг** руу унана. Гэвч `av1–av6.webp` нь одоогоор
   **ижилхэн placeholder** зураг тул "зураг гарахгүй" мэт харагдана → жинхэнэ
   засвар = 6 өөр аватар зураг тавих (design).
2. Сурагч зураг байршуулсан ч харагдахгүй бол `resolveAvatar()`/URL-ийн асуудал.

➡️ **Choi:** асуудал давтагдвал ганц сурагчийн `avatarUrl` утгыг (`GET /classes/:id`
хариунаас) хуулж ирүүлээрэй — тэр утга аль хувилбар болохыг шууд хэлнэ.

- [ ] **⚠️ MERGE-ЭЭС ӨМНӨ: прод дээр username давхардал шалгах.**
      ```sql
      select lower(username), count(*), array_agg(username)
      from users where username is not null group by 1 having count(*) > 1;
      ```
      Register нь энэ commit хүртэл том/жижиг үсэг ялгадаг байсан тул `Bataa` ба
      `bataa` хоёулаа орших боломжтой (unique index нь түүхий утган дээр). Мөр
      гарвал тэдгээр хүн нэрээ солиж чадахгүй болно (шалгалт нөгөө мөрийг тоолно)
      → гараар нэгтгэ. Мөр гарахгүй бол шууд merge.
- [ ] `username`-ий unique index нь түүхий утган дээр тул `LOWER(...)` хайлт
      индекс ашиглахгүй (одоогийн хэмжээнд асуудалгүй). Хэрэглэгч олширвол
      `lower(username)` дээр expression index нэмэх.
- [ ] **`test/app.e2e-spec.ts` хуучирсан — шинэчлэх.** `POST /classes/join` одоо
      `{ status:'pending', className }` буцаадаг (багшийн зөвшөөрөлтэй болсон) ч
      тест хуучнаар `res.body.students`-ийг шалгасаар байна. Мөн `jest.config.ts`-ийн
      `testRegex` нь `*.e2e-spec.ts` л барьдаг тул `src/**/*.spec.ts` unit тестүүд
      ямар ч script-ээр гүйдэггүй → `test` (unit) + `test:e2e` гэж 2 script болгох.
- [ ] **Бэлэн аватар зургууд (av1–av6) солих** — одоо 6 нь ижилхэн placeholder
      art тул зураггүй сурагчид бүгд адилхан харагдаж, "зураг гарахгүй" мэт
      ойлгогдож байна (QA #11/#15-ийн магадлалтай үндсэн шалтгаан).
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
      (⚠️ Зөвхөн бодит утсан дээр хийнэ — код талаас бэлэн.)
- [ ] Placement / level сонголтын урсгал (A1–B1) шалгах.
- [ ] Reading tap-to-translate + audio prod дээр ажиллаж буйг шалгах.
- [x] Loading / empty / error state-үүд бүх дэлгэц дээр (аудит `dd7bc3a`; шинэ
      дэлгэцүүд (`taste`, `/ielts`) skeleton/fallback-тай).
- [x] Жагсаалт + зураг performance — урт жагсаалтууд аль хэдийн `FlatList`
      (notifications/saved); `CategoryBrowser` level-2 нь сэдэв тус бүрээр богино
      тул ScrollView хангалттай. Алсын зураг бүр **expo-image (`AppImage`)** дээр:
      Home continue thumb + quiz асуултын зураг шилжүүлсэн (disk cache + Cloudinary
      хэмжээ тааруулалт).
- [x] **Багшийн Settings entry нэмсэн (2026-07-23, PR #155).** Багшийн `profile`
      header-т тохиргооны араа → shared `/settings` (хэл MN/EN · харагдац light/dark ·
      аккаунт → имэйл/нууц үг). ⚠️ Багшийн хэсэг = **Boju**-гийн эзэмшил тул shared-UI
      → давхардуулахгүй; `/settings` `/account` `/change-password` дэлгэцүүдийг дахин
      ашигласан (шинэ дэлгэц бичээгүй).

#### ✅ QA хүснэгтийн "A блок" — хийгдсэн (2026-07-27) · ДАВХАРДУУЛАХГҮЙ

QA хүснэгтийн (27 мөр) кодтой тулгасан шалгалт + засвар. **Дахин хийх шаардлагагүй:**

| QA# | Асуудал | Төлөв |
| --- | --- | --- |
| 22 | AI buddy — speak дархад дуу гарахгүй | ✅ `chat.tsx` `playAudio(url, text)` → `audio_url` байхгүй бол **expo-speech** уншина. Speaker icon үргэлж идэвхтэй |
| 24 | Profile-оос username солих | ✅ **mobile тал бэлэн** — `src/lib/username.ts` (нэгдсэн дүрэм, `register.tsx` мөн үүнийг ашиглана), `EditProfileModal`-д талбар + 409 боловсруулалт. ⛔ **BACKEND ХҮЛЭЭЖ БАЙНА** — доор |
| 4 | Стандарт/Premium сонгож болохгүй | ✅ `plan.tsx` бодит багцаа `GET /users/me/plan`-аас уншиж "Идэвхтэй" тагладаг; CTA сонголтыг дагана. Төлбөр QPay хүртэл stub |
| 13 | Сурагчийн гарах товч | ✅ press feedback + `accessibilityRole` |
| 3 | Хадгалсан үгийн зураг гарахгүй | ℹ️ **Кодын алдаа БИШ** — BE `getSaved()` бүтэн `Word` (`imageUrl` орсон) буцаана, mobile зурдаг, `cldUrl()` аюулгүй. DB мөрөнд зураг үүсээгүй нь шалтгаан → **admin: Words → `noImage` шүүлт → bulk generate** |
| 2, 5, 7, 12, 18, 19, 20, 25, 26 | чансаа давхар box · сорилын сонголт · унших чичрэлт · teacher avatar save · teacher icon · баяр хүргэлт · teacher back nav · flashcard speaker | ✅ өмнөх `52b3a5a` QA commit дээр зассан — **зөвхөн re-test** |
| 21, 23 | keyboard avoid · flashcard know/don't know ойлгомж | 🔶 хагас (`keyboardBehavior="interactive"` + swipe legend бий) — бодит утсан дээр шалгах |
| 8, 9, 10 | profile card border давхцал · анги нэгдэх card border · даалгаврын буцах товч | ❓ **screenshot хүлээж байна** — кодоос объектив алдаа олдоогүй |
| 11, 15 | Сурагчийн зураг teacher талд гарахгүй | ⛔ **BACKEND** — mobile бүрэн холбогдсон (`StudentRow`/`PersonRow`/`Avatar` бүгд `avatarUrl` дамжуулна); API `avatarUrl` буцаахгүй байна |
| 6, 14, 16, 17, 27 | контент оруулах · teacher→сурагчийн profile · даалгаврын дүн | ➡️ Boju / admin (27 = SM-2 логик, асуулт — хариулсан) |

> ⛔ **Өсөхбаярт 2 хүсэлт:**
> 1. `UpdateProfileDto`-д **`username`** талбар + давхардлын шалгалт (409). Одоо DTO-д
>    байхгүй тул global `ValidationPipe({ whitelist: true })` уг утгыг чимээгүй арчина.
>    Mobile тал бэлэн бөгөөд серверийн хариуг шалгаад "боломж бэлэн болоогүй" гэж
>    илэн далангүй хэлдэг (хуурамч амжилт харуулахгүй).
> 2. Багшийн roster / сурагчийн ахиц endpoint-үүд **`avatarUrl`** буцаах (QA #11, #15).

⚠️ **Boju АНХААР** — энэ багцад чиний эзэмшлийн файл орсон (давхардуулахгүйн тулд):
`app/(tabs)/chat.tsx`, `app/(tabs)/profile.tsx`, `app/plan.tsx`,
`src/components/BuddyChatSheet.tsx`. Мөн shared `TextField`-д `hint`/`error` prop
**нэмсэн** (нэмэлт, хуучин хэрэглээг эвдэхгүй).

### Boju (Mobile — games & social)
- ⚠️ **Choi `app/quiz/[id].tsx`-д IELTS-ийн жижиг нэмэлт хийсэн (2026-07-22)** —
      merge хийхээсээ өмнө pull хий: (1) `audioUrl` байвал сонсголын play/pause мөр,
      (2) `passageText` байвал уншлагын эх (нээх/хаах), (3) үр дүнд `result.band`
      харуулах, (4) асуултын зураг `Image`→`AppImage`. Бусад quiz логик хөндөгдөөгүй.
      IELTS Writing/Speaking (`open_response`) практик дэлгэц = **Plan 3b, Boju**;
      `/ielts` hub дээр тэр 2 модуль "тун удахгүй" гэж харагдаж байна — дэлгэц бэлэн
      болмогц `src/constants/ielts.ts`-ийн `auto`/route-г солиход л хангалттай.
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

### 🚨 Store setup — бодит blocker (шинэчилсэн 2026-07-28, кодоос баталсан)
- [x] **EAS холбогдсон** — `eas init` (2026-07-21). Expo project үүссэн
      (`@usukh6ayar/englishxp`), `app.json` `extra.eas.projectId` =
      `d5b190dd-0fb6-4684-8aff-4648fb0f0357`.
- [x] **App icon холбогдсон** (2026-07-23) — `assets/icon-ios.png` **1024×1024**
      (iOS) + `assets/icon.png` **1254×1254** (Android adaptive, bg `#191040`).
      `app.json` эдгээр рүү зааж байна.
- [x] **Cyrillic фонт (Onest/Inter) ачаалагдсан** — `@expo-google-fonts/onest` +
      `/inter` dependency, `useFonts` → `mobile/app/_layout.tsx:122`, `expo-font`
      plugin `app.json`-д бүртгэлтэй.
- [ ] **Splash screen** — `app.json`-д `splash` түлхүүр **огт байхгүй** → Expo-ийн
      default цагаан дэлгэц гарна. `assets/splash.png` + тохиргоо (fox/logo on
      `#191040`). Store blocker биш ч launch-д хэрэгтэй.
- [ ] 🆕 **Bundle ID зөрүү — submit хийхийн ӨМНӨ шийдэх.** iOS
      `com.usukhbayar.sparkxp` ↔ Android `com.usukh6ayar.englishxp`, `slug`/`scheme`
      нь `englishxp` хэвээр. EAS credential нь хуучин ID-д уягдсан тул iOS-ийн
      bundle ID солих нь App Store Connect дээр **шинэ апп** үүсгэнэ (шинэчлэл
      биш). Бүрэн rename эсвэл буцаах — хагас байдал хамгийн муу. → `docs/CODE_AUDIT.md §M7`
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
- [x] **C1 ✅ (2026-07-22)** Home — 4 skill tile → compact quick-row, нэг primary
      "Continue/Start" hero (`dd7bc3a`). **C1-BE ✅** `GET /lessons/continue` (PR #142).
      **C1-FE:** `api/lessons.ts` `getContinue` + Home hero нь сервэрийн сонгосон
      дараагийн дуусгаагүй хичээл + тухайн level-ийн **бодит** ахиц (ProgressBar +
      `{done}/{total}`) харуулна; сүлжээгүй үед локал сүүлийн хичээл рүү уначихна.
- [x] **C2 ✅ (2026-07-21)** Quiz асуулт бүрийн шууд feedback + **зөв хариулах хүртэл
      явдаг** (retry-until-correct).
      **C2-BE:** `POST /quizzes/:id/check` — нэг хариу шалгаж `{ correct, correctAnswer? }`
      буцаана (XP олгохгүй, бүх түлхүүр задлахгүй; буруу үед л зөв хариу буцна). grading
      `gradeQuestion` дундын helper. **C2-FE (`quiz/[id].tsx`):** Шалгах→(зөв)Үргэлжлүүлэх /
      (буруу)Дахин оролдох; зөв хариу тодрон харагдана, зөв өгтөл дараагийнх руу орохгүй.
      `api/quizzes.ts` `checkAnswer` client + i18n. API.md шинэчилсэн.
- [ ] **C3** Buddy эхний-нээлт scaffold: 3–4 starter prompt + voice-минут үлдэгдэл
      харуулах, limit → текст рүү зөөлөн шилжих — Boju.
- [x] **C4 ✅ (2026-07-22)** Taste-task онбординг (auth-аас өмнө +XP) — Choi.
      **C4-BE ✅** JWT-гүй public sample endpoint + guest→user XP verify дээр — Өсөхбаяр (PR #143, merged 2026-07-22).
      **C4-FE:** `app/(auth)/taste.tsx` (онбордингийн сүүлийн slide → 3 асуулт,
      `api/words.ts` `getSampleQuestions`, локал шалгалт + confetti), `lib/tasteTask.ts`
      (төлвийг төхөөрөмж дээр хадгална), register нь `tasteCompleted` илгээж, амжилттай
      бол flag-аа цэвэрлэнэ. Sample ачаалагдахгүй бол шууд бүртгэл рүү (хэзээ ч блоклохгүй).
      ⚠️ **Full guest mode (данcгүйгээр апп үзэх) хийгээгүй** — backend дэмжлэг алга;
      "auth-аас өмнө үнэ цэн" зорилгыг taste-task биелүүлж байна.

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
