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
| **Boju** (mobile — buddy/games + store) | `C3` buddy scaffold (starter prompt + voice-минут үлдэгдэл + limit→текст); real gamification data (placeholder → бодит); **IELTS Plan 3b — Writing/Speaking практик дэлгэц** (model-answer reveal); **splash + App Store material** (screenshot/description/privacy/data-safety) — *icon ✅ хийгдсэн* |

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
| C2 | Quiz асуулт-бүрийн шууд feedback | ✅ дууссан | BE `POST /quizzes/:id/check` (`quizzes.controller.ts:138`) + FE check→continue урсгал, ✓/✗ өнгө, зөв хариу задлах, combo haptic (`app/quiz/[id].tsx:199–232`, commit `52b3a5a`) |
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

#### ✅ Choi — Retention багц + зүрхний UI (2026-07-29) · ДАВХАРДУУЛАХГҮЙ

Өсөхбаярын өгсөн retention жагсаалтын **№1 · №2 · №4** бүрэн, **№3** хэсэгчлэн.
Нэмээд **зүрхний (hearts) бүх mobile тал** — энэ нь жагсаалтад байгаагүй ч
Өсөхбаяр backend-ээ нэгтгэсэн тул mobile тал дутуу үлдсэн байсан.
**Дахин хийх шаардлагагүй:**

| Ажил | Юу хийгдсэн | Шинэ файл |
| --- | --- | --- |
| **Өдрийн зорилт + XP цагираг** (№1) | Home дээр Apple Fitness маягийн цагираг («Өнөөдөр 30/50 XP»), дарвал зорилт сонгох (Хөнгөн 20 / Дунд 50 / Ширүүн 100 → `PATCH /gamification/goal`). Байгаа `ProgressRing`-ийг ашигласан — шинээр зураагүй | `DailyGoalCard` · `DailyGoalSheet` |
| **Streak freeze** (№2) | Home hero-гийн streak badge дарагдана → Sparks-аар мөстөлт авах (`POST /gamification/streak-freeze`), дэд мөрөнд `❄ N мөстөлт` | `StreakFreezeSheet` |
| **Офлайн тэсвэр** (№4) | GET кэшийг AsyncStorage-д хадгална (7 хоног TTL · 60 бичлэг · 256KB хязгаар · 1.5с debounce). Cold start дээр хоосон дэлгэц гарахаа больсон. ⚠️ Кэш process-ийг даван үлддэг тул **нэвтрэх үед ч** `clearApiCache()` дуудна (өмнөх хэрэглэгчийн дата гоожихоос сэргийлэв) | `persistCache.ts` |
| **Push** (№3) | API давхарга бэлэн: `registerPushToken` / `deletePushToken` / `setPushPrefs` + token regex. ⛔ Цааш нь **блоклогдсон** — доор | — |
| **Зүрх (hearts) — бүх mobile тал** | Quiz толгойд + Home hero-д зүрх; буруу хариултад бүдгэрч сэгсэрнэ; дарвал дэлгэрэнгүй (үлдсэн тоо · дараагийн сэргэлт · бүгд дүүрэх · Sparks-аар дүүргэх); 0 болбол блоклох цонх; сэргэхэд автоматаар хаагдана | `hearts.ts` · `HeartsRow` · `HeartsSheet` · `countdown.ts` |
| **Дундын цонхны бүрхүүл** | 3 цонх ижил backdrop/card давхардуулсныг `SheetModal` болгож гаргав (`dismissable` prop = блоклох горим). *(`BuddyUnlockSheet` мөн ижил давхардалтай — Boju-гийн файл тул хөндөөгүй)* | `SheetModal` |

**Засварласан бодит алдаанууд** (кодоос батлагдсан, таамаг биш):

1. **Home зөвхөн mount дээр л ачаалдаг байсан** (`useEffect`) → дасгалаас буцахад
   XP · streak · зүрх · цагираг бүгд хуучин хэвээр үлддэг. `useFocusEffect` болгов.
2. **`ProgressBar`-ын дотоод `width:'100%'`** нь `flex:1`-тэй зөрчилдөж зүрхийг
   дэлгэцний гадна түлхэж байсан → wrapper-т оруулав.
3. **Quiz `/check` унавал чимээгүй `proceed()` дуудаж байсан** → сүүлийн асуулт
   дээр feedback огт үзүүлэлгүй шууд дүн рүү үсэрдэг. Одоо алдааг хэлээд зогсоно.
4. **Reading-ийн явцын зурвас** (`progressTrack`) 0% үед саарал зураас болж,
   буцах товч ба cover зургийн хооронд «хуваагч» мэт харагддаг байв → ил тод болгов.
5. **Флашкартын XP хуурамч байсан** — `swipe.tsx` `+10`/`+2` гэж дотооддоо тоолж
   «+300 XP» харуулдаг атал `POST /reviews/:wordId` **XP огт олгодоггүй**.
   Хуурамч тоог устгаж, бодит үзүүлэлт (үзсэн карт) тавив.

**Quiz урсгал өөрчлөгдсөн (Boju АНХААР — доор):** буруу хариулсан асуулт эгнээний
ард буцаж **дахин ирнэ**; эхний удаад зөв хариу **задрахгүй** (зөвхөн «дахин ирнэ»
сануулга); **2 дахь** удаад хариу гараад асуулт хасагдана → цааш / тест дуусна.
Ингэснээр зүрх утга учиртай болж (давталтыг зүрх хязгаарлана), мухардах эрсдэлгүй.
Тохируулга: `REVEAL_AFTER_TRIES = 2`.

> ⛔ **Өсөхбаярт 4 хүсэлт** — `docs/REQUEST_choi_*.md` (тус бүр кодын хэсэгтэй):
> 1. `push_notifications` — `expo-notifications` + `expo-device` dependency,
>    `app.json` plugin, dev-client build. Expo Go нь SDK 53-аас хойш remote push
>    дэмждэггүй тул Choi шалгаж ч чадахгүй.
> 2. `review_xp_and_streak` — (a) `POST /reviews/:wordId` XP олгодоггүй
>    (`XpSource.WORD_REVIEW` enum байгаа ч ашиглагдаагүй) → флашкарт XP ч streak ч
>    өгөхгүй; (b) streak нь **өдрийн зорилтоос хамаардаггүй** — 1 XP олоход ахина.
> 3. `streak_freeze_cost` — `GET /gamification` нь үнэ/дээд хязгаарыг буцаадаггүй
>    (зүрхний `HeartsState` нь `refillCost` буцаадаг — freeze дээр л дутуу).
>    Mobile тал optional талбараар бэлэн, ирвэл автоматаар хэрэглэнэ.
> 4. `hearts_regen_tuning` — 4 цаг хэт удаан. **Илэрсэн цоорхой:** `plans` модуль
>    ч, admin-д багцын хуудас ч байхгүй тул зүрх/freeze-ийн эдийн засгийг
>    **deploy-гүйгээр тааруулах боломжгүй** (CLAUDE.md-ийн дүрэмтэй зөрчилддөг).

⚠️ **Boju АНХААР** — энэ багцад чиний эзэмшлийн файл орсон:
**`app/quiz/[id].tsx`** (зүрх + давтуулах урсгал — дээрх тайлбар харна уу).
Merge хийхээсээ өмнө заавал pull хий. Мөн `soril.tsx`-д `DAILY_GOAL_FALLBACK = 50`
гэсэн хиймэл тоо **үлдсэн** — чиний файл тул Choi хөндөөгүй, зассан нь дээр.

ℹ️ **Өсөхбаярт тэмдэглэл:** Soril табын 4 тоглоом (`/game/*`) нь `/quizzes/:id/check`
ашигладаггүй тул **зүрх огт зарцуулдаггүй** — сурагч хязгааргүй тоглох боломжтой.
Backend-ийн зохиомж, бүтээгдэхүүний хувьд зөрчилтэй эсэхийг шийдэх шаардлагатай.

#### ✅ Choi — redesign v2-ийн regression засвар (2026-07-30) · ДАВХАРДУУЛАХГҮЙ

Boju-гийн Home redesign (`main` #190) hero хэсгийг бүхэлд нь дахин бичсэн
(`heroTop`/`streakBadge` → `heroStatsRow`/`statCard`). Тэр явцад **streak freeze
урсгал бүхэлдээ тасарсан** байсныг сэргээв — `app/(tabs)/index.tsx`:
`StreakFreezeSheet` import, `freezeSheet` state, streak картын `onPress`,
sheet-ийн render. Дизайныг хөндөөгүй; мөстөлтийн тоог картын буланд ❄ badge-ээр
харуулна (`freezeBadge`, absolute → stat row-ийн өргөн өөрчлөгдөхгүй).

**Home-ийн icon-ууд → брэндийн 3D asset.** Redesign нь "Юу сурах вэ?"-гийн 4
чадварыг `AppIcon`-оос flat Ionicons руу буулгасныг буцаав (`task.appIcon`,
size 34) — `TASKS`-аас хэрэггүй болсон `icon: IconName` талбар + `IconName`
төрлийг цэвэрлэв. Бусад Ionicons (үг давтах/даалгавар/IELTS/хэлц үг/play/
refresh/offline/snow) — `assets/icons`-д тохирох зураг **байхгүй** эсвэл өөр
tile-тай давхардана, тиймээс зориуд үлдээв.

**Бүтэн regression аудит хийсэн — өөр хассан зүйл алга.** Шалгасан арга:
`fbdebd1..HEAD` хооронд mobile-ийн 15 дэлгэцийн `onPress`/`router.push` олонлогийг
харьцуулсан (Home-ийн 12 handler одоо яг тэнцүү), orphan component + дуудагдаагүй
API scan, `tsc --noEmit` + eslint. `lessons.tsx` / `level/[code].tsx` / `quiz/[id].tsx`
дээрх өөрчлөлт бүгд **нэмэлт** (island states, "ЭНД БАЙНА" waypoint, wrong-answer
shake + sound) — юу ч хасаагүй.

ℹ️ Аудитаар илэрсэн, **regression биш** хуучин dead code (засаагүй, зориуд):
`AchievementModal` (хэзээ ч холбогдож байгаагүй → Update 1-ийн Boju-гийн Badge
ажил), `reviews.getReviewStats` (2026-06-ны redesign-д унасан → Update 3-ын
"Vocabulary статистик"-д хэрэгтэй болно), `lessons.tsx`-ийн `byLevel` state.

#### ✅ Choi — Update 3-ын эхний багц + lint эрүүлжүүлэлт (2026-07-30) · ДАВХАРДУУЛАХГҮЙ

**1. Аудио дагаж унших (Update 3 → "Reading шинэчлэлт") ✅.** Backend аль хэдийн
өгүүлбэр тус бүрт аудио үүсгэдэг байсныг эцэст нь FE-д холбов.
`mobile/src/lib/useReadAlong.ts` (шинэ hook) — өгүүлбэрүүдийг дараалан тоглуулж,
`didJustFinish`-ээр дараагийнх руу шилжинэ; аудиогүй өгүүлбэрийг **алгасна**
(admin бүрэн үүсгэж амжаагүй байхад ч ажиллана). Reader дээр play/pause +
өмнөх/дараах + "N/нийт" тоолуур; аудиогүй материалд удирдлага **огт гарахгүй**.
`SelectableText`-д нэмэлт optional `highlightRange` prop — яригдаж буй өгүүлбэр
`successSoft`-оор тодорно (хэрэглэгчийн өөрийн сонголтын ягаанаас **ялгаатай**
өнгө, ингэснээр хоёул хольж ойлгогдохгүй). Шинэ түлхүүр: `readAlong`,
`readAlongPause`, `sentenceCount`.

⚠️ **Чухал:** эхний хувилбар нь `hasAudio` байвал л товч гаргадаг байсан тул
**хаана ч харагдахгүй** байсан (admin ганц ч материалд аудио үүсгээгүй). Одоо
аудиогүй өгүүлбэрийг **төхөөрөмжийн TTS**-ээр уншина (`expo-speech`, `saved.tsx`-ийн
адил) → товч **үргэлж** гарна, бичигдсэн ElevenLabs дуу байвал түүнийг илүүд үзнэ.
Байрлал: "Үсгийн хэмжээ" мөрийн доор, эхийн шууд дээр.

**2. Vocabulary статистик ✅ (нийлбэр хэсэг).** `reviews.getReviewStats` нь
2026-06-ны redesign-аас хойш **хаанаас ч дуудагдахгүй** байсныг сэргээв.
`mobile/src/components/VocabStats.tsx` (шинэ) — "Миний үгсийн сан": нийт
тааралдсан үг, мэдсэн/сурч байгаа задаргаа, эзэмшилтийн хувь + `ProgressBar`.
`app/saved.tsx`-ийн жагсаалтын толгойд суулгав (хадгалсан үг 0 байсан ч харагдана).
Stats унавал үгийн жагсаалт **хэвээр ажиллана** (тусад нь `.catch`).
⚠️ `/saved` дэлгэц рүү **зөвхөн Profile → "Хадгалсан үг"**-ээр ордог байсан тул
хэн ч олохгүй байсан → `app/swipe.tsx`-ийн толгойд ⭐ товч нэмж хоёр дахь хаалга
гаргав (үг давтаж байгаа хүн яг тэр мөчид үгсийн сангаа хармаар байдаг).

**3. Lint эрүүлжүүлэлт — 84 → 4 warning.** Гол шалтгаан нь код биш, **тохиргоо**:
`eslint.config.js` дээр TS-ийг уншиж чаддаггүй **base `no-unused-vars`** асаалттай
байсан тул функцийн *төрлийн* зарлалт доторх параметрийн нэр бүрийг (`(id: string) => void`)
"ашиглагдаагүй" гэж заадаг байсан — ~70 хуурамч дохио. Base-ийг унтрааж
`@typescript-eslint/no-unused-vars`-ыг ижил `^_` дүрэмтэйгээр үлдээв.
Үлдсэн жинхэнэ dead code-ыг цэвэрлэв: `lessons.tsx`-ийн `byLevel` (+ хэрэггүй
болсон `getLessons` дуудлага — **бүх хичээлийг татаад хаядаг байсныг** зогсоов),
`saved.tsx`/`swipe.tsx`/`ProgressRing`/`Toast`/`ClassCard`/`AchievementModal`/
`MascotCircle`-ийн ашиглагдаагүй import, `forgot.tsx` + `AssignmentRow`-ийн
өнгө хэрэглэдэггүй `makeStyles(c)` → энгийн `StyleSheet.create` (per-render
дахин бүтээхээ болино).

**Dead code одоо 0 (2026-07-30, Choi-гийн хүсэлтээр Boju-гийн файлыг ч оруулав).**
`leaderboard.tsx` (`Ionicons`), `BuddySelector` (`makeStyles(c)` → энгийн
`StyleSheet.create`, дагаад `BuddyCard`/`UnlockCTAButton`-ийн хэрэггүй `colors`
prop), `BuddyChatSheet`/`BuddyHistorySheet`-ийн `open` → `open: _open`
(**зориуд ашиглагддаггүй** — эцэг нь mount-оор удирддаг, тайлбар бичсэн).
Мөн давхардсан import (`game/[mode].tsx`, `LeaderboardRow`, `PeriodTabs`) нэгтгэв.
`react/no-unknown-property`-г зөвхөн `BuddyAvatar.tsx`-д унтраав — тэр нь
react-three-fiber (`<ambientLight intensity>`), React-DOM-ын дүрэм мэдэхгүй.
⚠️ Boju: эдгээр нь чиний файл — merge хийхээсээ өмнө pull хий.

**Үлдсэн 21 warning = `react-hooks/exhaustive-deps` — ЗОРИУД хөндөөгүй.** Эдгээрийг
"засах" нь dependency нэмэх гэсэн үг бөгөөд `useEffect` давталтад орох эрсдэлтэй
(жинхэнэ ажиллагааны өөрчлөлт). Файл эзэмшигч тус бүр өөрөө шалгах ёстой.

ℹ️ **Өсөхбаярт 2 BE хүсэлт:** `docs/REQUEST_choi_vocab_mastery.md` — (1) `LearnWord`-д
SM-2 төлөв (`repetitions`/`dueAt`/`intervalDays`) нэмэх → үг тус бүрийн mastery
заалт, (2) `PUT /reading/:id/progress` → унших ахиц хадгалах (одоо зөвхөн
"дуусгасан эсэх", өөр төхөөрөмж дээр алга болно). Эдгээр ирэх хүртэл Update 3-ын
"Ахиц хадгалах, номын сан" + "mastery indicator" **дуусахгүй**.

#### ✅ Choi — QA багц #2 (2026-07-30, 8 ажил) · ДАВХАРДУУЛАХГҮЙ

1. **Ахицын hero нэгдсэн** (хамгийн чухал нь). Унших/Хэлц үг нь цагаан
   `ProgressRing` карттай, Сонсгол/Ярих/Бичих нь gradient banner-тай — нэг апп
   мөртлөө хоёр өөр бүтээгдэхүүн шиг харагдаж байсан. Шинэ
   `src/components/ProgressHero.tsx` — gradient + том %, `doneCountLabel`,
   `ProgressBar`, дугуй icon. **Гурвуулан** (`skill/[key]`, `reading/index`,
   `idioms/index`) үүнийг хэрэглэнэ; тус бүрийн давхардсан style/hero код устсан.
2. **Хадгалсан үг — хажуу тийш чирж устгах.** `src/components/SwipeToDelete.tsx`
   (ReanimatedSwipeable). **Бүтэн чирэлтээр устгахгүй** — зөвхөн Устгах товч
   гаргаж, дарж баталгаажуулна (үгсийн сан санамсаргүй арчигдах эрсдэл).
3. **Settings → "Апп хуваалцах"** нь `soon` alert байсан → `/invite` рүү холбов
   (route аль хэдийн байсан). OS share биш invite — найзад нөхөх код өгдөг.
4. **Soril "Амжилтын зам" → "Өнөөдрийн зам".** Өмнө нь `gam.progress × 5` буюу
   level-ийн XP-ийн зүсэм байсан тул нэг дасгал хийхэд бараг хөдөлдөггүй байв.
   Одоо **өнөөдөр дуусгасан дасгалын тоо** (`src/lib/dailyTasks.ts`, өдөр
   солигдоход өөрөө 0). `quiz/[id].tsx` `res.passed` үед `markDailyTask()`.
   ⛔ Дуусгасны **шагнал хараахан алга** — BE endpoint байхгүй
   (`docs/REQUEST_choi_daily_path.md`). Байхгүй шагналыг байгаа мэт үзүүлээгүй.
5. **Home daily goal** — ProgressRing 78→56, padding lg→sm/md, доод margin-ыг
   бүр авч `nextRow`-д үлдээв (хоёр margin нийлж нүх үүсгэдэг байсан).
6. **Buddy unlock** — Sparks сонголт **streak-ийн улбар шар галын** icon-той
   байсныг Sparks очир болгов; premium нь алтан од. `buddyUnlockFor` →
   "500 **Sparks**-аар нээх" (нэгж байхгүй тул "Unlock for 500…" ойлгомжгүй байв).
7. **Зүрх** — BE дээр `maxHearts: 5` **хэвээр** (7 болоогүй). Choi-гийн шийдвэрээр
   зөвхөн UI: Home дээрх 2 мөрийн блокийг **1 мөр** болгож, `marginTop` xxl→sm
   (үнэгний зургийн голд өлгөөтэй байсныг stat row-ийн доор татав).
8. **🐛 Офлайн кэшийн ЖИНХЭНЭ алдаа зассан.** `persistCache` нь дискэнд бичдэг
   мөртлөө `apiRequest` нь **хэзээ ч буцааж уншдаггүй** байсан — `fetch` унамагц
   алдаа шидээд бүх дэлгэц error төлөв рүү ордог байв (`getCached`-ыг зөвхөн
   `useSWR` ашигладаг, дэлгэцүүдийн ихэнх нь шууд `apiRequest` дууддаг).
   Одоо GET-ийн **сүлжээний** алдаанд кэшлэгдсэн утга буцаана. HTTP 4xx/5xx нь
   сервэрийн бодит хариу тул хэвээр шиднэ; **бичих** хүсэлт ч хэвээр унана
   (чимээгүй "амжилттай" болох нь илүү аюултай).

ℹ️ **Зураг алга болдог нь код биш — Expo Go.** Lesson background, spark/streak
icon зэрэг нь бүгд `require()`-ийн **локал** asset. Expo Go / dev горимд эдгээр
нь Metro сервэрээс дамждаг тул офлайнд алга болно; бодит build (APK/OTA) дээр
binary дотор шигтгээстэй. Алсын зураг (`AppImage`) нь `cachePolicy="memory-disk"`
-тэй, зөв ажиллаж байна. Тиймээс энэ хэсэгт код өөрчлөөгүй.

⚠️ **Boju АНХААР** — энэ багцад чиний файл орсон: `app/(tabs)/soril.tsx`
(Өнөөдрийн зам), `app/quiz/[id].tsx` (`markDailyTask` нэг мөр),
`src/components/BuddyUnlockSheet.tsx` (icon + бичвэр), `app/settings.tsx`
(share → invite). Merge хийхээсээ өмнө pull хий.

ℹ️ Soril-ын "Өнөөдрийн challenge"-ийг **зориуд хөндөөгүй** — Home-ийн daily
goal-тэй ижил өгөгдөл ч гэсэн үнэгний banner-тай хэлбэр нь таалагдсан (Choi).

#### ✅ Choi — Home hero + "Юу сурах вэ?" дизайн (2026-07-30) · ДАВХАРДУУЛАХГҮЙ

**1. "Юу сурах вэ?" → wrap-гүй нэг эгнээний 4.** 2×2 сүлжээ нь Унших/Сонсгол
хоёрыг Ярих/Бичихээс дээгүүр зэрэглэлтэй мэт харуулж байсан — 4 чадвар эрх тэгш
тул нэг эгнээ. `skillWrap` нь хувь (`48.5%`) биш **`flex: 1` + `minWidth: 0`**,
ингэснээр 320pt SE дээр ч, tablet дээр ч мөрөө яг хуваана. Нарийссан tile-д
тохируулж: icon-ы ард **frosted disc** (цайвар icon өөрийн gradient дээр
угаагдаж, өөр өөр хэлбэртэй icon-ууд ижил оптик жинтэй болсон), бүх зүйл
төвлөрсөн, нэр/тоо `adjustsFontSizeToFit` (жижиг утсанд текстэнд ~58pt үлддэг тул
"Сонсгол"/"12 дасгал" тасрахын оронд бага зэрэг жижигрэнэ).
Хэмжээ нэг эх сурвалжтай: `SKILL_ART = s(54)` → `SKILL_ICON` (0.74×) →
`SKILL_TILE_H` (`SKILL_ART + 64`). Disc томсгоход tile дагаад өндөрсөх тул
халихгүй. Icon 30 → **40pt** (375 baseline; SE 34, tablet 50) — эх PNG 210–400px
тул 3x дээр ч бүдгэрэхгүй.

**2. Hero-гийн 4 үзүүлэлт — зүүн 1 / баруун 3.** Өмнө streak/XP/Sparks гурав
хүрээтэй карт, зүрх нь тэдний доор тусдаа хөвж, L хэлбэр үүсгэж байв. Одоо:
зүүнд ганц **streak**, баруун талд **зүрх → Sparks → XP** босоо. Баруун багана нь
`alignItems: "flex-end"` + агуулгын өргөнтэй — баруун ирмэг тэгш, зүүн ирмэг
тэгш бус, ингэснээр 3 pill нэг цул хавтан шиг харагдахгүй. Голд үнэг чөлөөтэй
(320pt дээр ч 74pt зай).
Шинэ `StatPill` локал component — 4 үзүүлэлт нэг л удаа бичигдсэн. 44pt дүүргэсэн
icon tile-ыг **хассан**: өнгийг pill өөрөө үүрнэ (tint hairline + тэр өнгөөр
зөөлөн halo), ингэснээр масс 40% буурч үнэгийг таглахаа больсон.
Зүрх нь **"5/5" биш жинхэнэ 5 icon** — зарцуулагдсан нь бүдгэрч жижгэрэхийг
харуулдаг, бутархай тоо түүнийг харуулж чаддаггүй. `HeartsRow` **огт
өөрчлөгдөөгүй** (эхний оролдлогод нэмсэн `compact`/`iconOnly` prop-ыг бүрэн
буцаасан) — shake-on-loss ба lazy regen tick хэвээрээ.
Хэмжээ: pill 44pt, icon 28pt, зүрх 22pt, тоо `h3`. 24pt-аас доош бол 3D icon-ууд
өнгөт толбо болж гал/эрдэнэ/аянга гурав ялгарахаа больдог.

**3. 🐛 `HEADER_RESERVE` шидэт тоо → томъёо.** `= 200` гэж бичээстэй байсан тул
stat блокийн өндөр өөрчлөгдмөгц үнэг картны ард ордог байв (энэ дизайны явцад
2 удаа тохиолдсон). Одоо:
```js
const STAT_STACK_H = STAT_PILL_H * 3 + spacing.sm * 2;
const HEADER_RESERVE =
  SAFE_TOP_EST + HEADER_ROW_H + spacing.xs + spacing.sm + STAT_STACK_H + spacing.md
  - Math.round(SCENE_H * FOX_EARS);
```
`FOX_EARS = 0.16` нь зурган доторх үнэгний чихнээс дээших хоосон тэнгэр — pill
түүн рүү орж болно (тэнд юу ч зураагүй). Pill нэмэх/хасах/томсгоход reserve
өөрөө дагаж тохирно. Шалгасан: 320/375/412/430pt × safe-area 24/44 бүх
хослолд үнэгний чихнээс **+12pt зай**; hero 504 → 497pt болж доорх карт
дээшилсэн.

**4. 🐛 `eslint.config.js` бүхэлдээ унасныг зассан.** `@typescript-eslint/no-unused-vars`
дүрмийг **`files`-гүй** блокт бичсэн байв. `eslint-config-expo` тэр plugin-ыг
`files: ['**/*.ts(x)']`-ээр хязгаарласан блокт бүртгэдэг тул `.js` файл дээр
(жишээ нь config өөрөө) "could not find plugin" гээд **бүх lint ажиллагаа**
зогсдог байсан. Блокт `files: ['**/*.ts', '**/*.tsx']` нэмэв → 0 error,
21 warning (бүгд өмнөх `exhaustive-deps`).

#### ✅ Choi — Hero stat нэр + AI buddy таб (2026-07-30) · ДАВХАРДУУЛАХГҮЙ

**1. Hero-гийн 3 үзүүлэлтэд нэр нэмсэн.** 3D icon дангаараа тухайн тоо ЮУ гэдгийг
хэлж чадахгүй (шинэ сурагч эрдэнэ vs аянгыг ялгахгүй) тул `StatPill`-д `label`
prop нэмэв: **Дараалал · Очирхон · XP**. Шинэ i18n түлхүүр нэмээгүй — `streak`/
`sparks`/`xp` аль хэдийн байсан. Зүрхэнд нэр өгөөгүй (5 зүрх өөрөө тайлбар).
`caption` (12/400) биш **`label` (13/600) + цагаан** — caption жинд нэр нь
үсэрхийлж, зурган дэвсгэр дээр алга болдог. Pill өргөсөх тул `statRight`-д
`flexShrink: 1` (320pt SE дээр frame-ээс халихгүй, нэр нь тасарна).

**2. AI buddy таб → өргөгдсөн avatar + брэндийн градиент цагираг**
(`src/components/BuddyTabButton.tsx`, шинэ файл; `CustomTabBar`-аас хуучин `foxBig`
disc хассан).

> ⚠️ **Хийж үзээд ТАТГАЛЗСАН хувилбарууд — дахин бүү оролд:** эргэлдэх галактик ·
> Doctor Strange-ийн mandala · Siri-маягийн шингэн blob · Interstellar «Gargantua»
> хар нүх · Clea-гийн урагдсан портал · Minecraft блок. Техникийн хувьд бүгд
> ажилласан; **асуудал нь дизайн**: таб бар бол байнга харагддаг chrome, хажууд нь
> 4 хавтгай icon байхад төв дээр нь үзвэр тавихаар (а) контентоос анхаарал сарниулж,
> (б) мэргэжлийн бус харагдаж, (в) апп нээлттэй байх бүх хугацаанд compositor ажиллана.

- **Тайван байдал = зорилго.** Idle үед юу ч хөдлөхгүй. Товч нь хөдөлснөөрөө биш,
  доод талын **цорын ганц дугуй, өргөгдсөн, бүрэн өнгөт** зүйл байснаараа
  анхаарал татна.
- **Бүх амьдрал нь дарахад** — чимэглэл биш **эргэх холбоо**: avatar 0.93 хүртэл
  суугаад пүрш болон буцаж (1.06 → 1), нэг удаагийн цагираг гадагш тэлж алга болно
  (`Ripple`, 420ms), `haptics.medium()`.
- **Градиент нь өөрөө цагираг** — `border` биш. Avatar нь дээр нь суудаг тул
  доорх градиент 2.5pt зурвас болж үлдэнэ; өргөн нь хаана ч жигд.
- **Идэвхтэй/идэвхгүй**: идэвхгүй үед градиент `opacity 0.55` + сүүдэр сул,
  идэвхтэй үед бүрэн ханалт + илүү өргөн сүүдэр. Хажуугийн табуудын
  chip-active хэв маягтай нэг эгнээнд.
- **Икон 46 → 60pt.** `buddy-menu.webp` нь **цагаан дэвсгэртэй** наалт (ягаан дугуй
  нь файлын дундах ~71%, төв нь 3% дээшээ) — тиймээс зургийг **1.42×** зурж
  тайрсан, цагаан хүрээ бүрэн алга. Ард нь `#241250` (theme-ээс хамаарахгүй —
  light theme дээр цагаан дугуй гарахаас сэргийлнэ).
- **Таб барын өндөр өөрчлөгдөөгүй**: avatar нь absolute, layout-д зөвхөн үл үзэгдэх
  48pt anchor эзэлнэ. `bar`-аас `overflow: hidden` хассан (эс бөгөөс өргөгдсөн
  товч барын дээд ирмэг дээр тэгш зүсэгдэнэ). `TabButton`-оос `c` prop хассан —
  buddy таб theme-ийн өнгө ашиглахаа больсон.

⚠️ **Boju АНХААР** — `CustomTabBar.tsx` бол shared файл (buddy таб = чиний хэсэг).
Хуучин `foxBig`/`foxBigImg` style устсан, оронд нь `<BuddyTabButton>`.

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
| **Push Notification** | Өсөхбаяр (BE) + Choi/Boju (FE) | BE + cron ✅ · Choi-гийн API давхарга ✅ · ⛔ dependency + dev-client build хүлээж байна (`docs/REQUEST_choi_push_notifications.md`) |
| Streak сайжруулалт | Choi | Freeze ✅ · өдрийн зорилго ✅ (2026-07-29, дээрх багц) · сануулга = push-тай хамт · ⛔ streak-ийн дүрэм BE-д (`docs/REQUEST_choi_review_xp_and_streak.md`) |

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
