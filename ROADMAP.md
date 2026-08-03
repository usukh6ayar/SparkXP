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
> **🔄 2026-08-03 шинэчлэл.** `splash` ✅ **хийгдсэн** (доор). Кодын 3 өндөр
> эрэмбийн олдвор ч бүгд ✅ зассан (`@nestjs/throttler` + helmet `main.ts`,
> `JWT_SECRET` fail-fast `auth/jwt-secret.ts`, `CreateAssignmentCompletions1785550000000`)
> — `docs/CODE_AUDIT.md §0` харна уу; IELTS admin authoring ч
> `admin/src/pages/ielts/IeltsPage.tsx` дээр бэлэн.
> **Үнэхээр үлдсэн store блокер:** iOS/Android **bundle ID зөрүү** (шийдвэр
> хүлээж байна) · eas.json submit creds хоосон · Apple/Google бүртгэл.
> Кодын талын бүрэн олдвор → **`docs/CODE_AUDIT.md`**.

### 🧑‍🤝‍🧑 Launch ажлын хуваарь (шинэчилсэн 2026-07-21 — 3-талт тэнцүү)
> Ажлыг **3-уулаа тэнцүү** хуваав. **3D AI buddy avatar-ыг хамгийн СҮҮЛД, 3-уулаа
> хамт** хийнэ (доор). `C2` ✅ дууссан. Regression-ыг хүн бүр өөрийн хэсэгт хийнэ.

| Owner | Ажил (тэнцүү 3 багц) |
| --- | --- |
| **Өсөхбаяр** (backend/admin/infra) | Railway Hobby + **бүх prod migration** (reading/idioms/translations/ai-buddy-voice/**IELTS**); ~~`docs/CODE_AUDIT.md`-ийн 3 өндөр эрэмбэ~~ ✅ (#178/#179) · ~~IELTS Plan 2 admin authoring~~ ✅; `C1-BE` ✅ · `C2-BE` ✅ · `C4-BE` ✅; **splash** ✅ (2026-08-03); **үлдсэн:** Apple($99)/Google($25) account + EAS submit config + bundle ID шийдвэр |
| **Choi** (mobile — learning + IELTS L/R) | ✅ бүгд дууссан (2026-07-22): `C1` Home hero (FE) · `C4` taste-task онбординг (FE) · **IELTS Plan 3a — `/ielts` hub + L/R runner (band)** · фонт (Manrope/Inter). Үлдсэн: бодит утсан дээрх regression тест |
| **Boju** (mobile — buddy/games + store) | `C3` buddy scaffold (starter prompt + voice-минут үлдэгдэл + limit→текст); real gamification data (placeholder → бодит); **IELTS Plan 3b — Writing/Speaking практик дэлгэц** (model-answer reveal); **App Store material** (screenshot/description/privacy/data-safety) — *icon ✅ · splash ✅ (Өсөхбаяр 2026-08-03, native config тул lead хийв — ДАВХАРДУУЛАХГҮЙ)* |

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
- [x] **`lower(username)` / `lower(email)` expression index ✅ (2026-08-03)** —
      migration `AddLowerUsernameEmailIndexes1786400000000`. Хайлт нь
      `LOWER(...) =` тул түүхий утган дээрх unique index-ийг ашиглаж чаддаггүй,
      нэвтрэх оролдлого болгонд users бүтнээрээ уншигдаж байв. **Unique биш**
      — прод дээр том/жижиг үсгийн давхардал байвал unique index босохгүй,
      migration нь boot дээр унана (шалгах query нь migration-ий тайлбарт).
- [x] **Нэвтрэх нэр/имэйл том-жижиг үсэг ялгахгүй болов ✅ (2026-08-03)** —
      `assertUsernameFree` анхнаасаа case-insensitive байсан тул апп нь `Bataa`
      ба `bataa`-г нэг хүн гэж амласаар, гэтэл login яг тэр үсгийг шаардаж
      хэрэглэгчийг өөрийнх нь данснаас гаргадаг байв. Имэйл дээр ч мөн адил
      (бүртгэлд `A@x.com` + `a@x.com` 2 данс болж чадна). `findByEmail` /
      `findByUsernameOrEmail` одоо `LOWER(...)` — яг тэр үсгээр бичсэн хүн
      эхэлж таарна (`ORDER BY CASE`), тул одоо байгаа ямар ч нэвтрэлт утгаа
      алдахгүй. E2E 3 тестээр бэхэлсэн.
- [x] **`test/app.e2e-spec.ts` ✅ засав (2026-08-03) — 43/43 ногоон.** Гурван
      бодит алдаа: (1) `npm run test:e2e` **огт ажиллахгүй** байсан — Jest 30
      дээр `--testPathPattern` → `--testPathPatterns` болсон; (2) ажиллуулсан ч
      Redis/TypeORM handle-ууд нээлттэй үлдэж jest дуусахгүй өлгөнө → `--forceExit`;
      (3) тестийн имэйл/username нь тогтмол байсан тул 2 дахь удаа бүх register
      409 өгч, token `undefined` болж 9 тест унана — одоо `RUN` id-гаар
      namespace хийсэн (дараалан 2 удаа ажиллуулж баталсан). Мөн анги нэгдэх нь
      багшийн зөвшөөрөлтэй болсныг тусгав: request → хараахан элсээгүй → approve.
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
- [x] **`.env.example` ✅ (2026-08-03)** — кодод ашиглагддаг ч тэнд байхгүй 3
      key нэмэв: `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`BootstrapPlansAdmin` migration
      эдгээр **хоёул** тавигдсан үед л анхны super_admin үүсгэдэг — үгүй бол
      шинэ прод DB-д нэвтрэх арга үлдэхгүй) + `BACKFILL_CONCURRENCY`. Жинхэнэ
      түлхүүр байхгүйг дахин шалгав (`sk-`/`AIza`/`re_`… загвараар — цэвэр).
- [ ] AI usage limit / rate-limit prod дээр асаалттай эсэхийг шалгах.
- [ ] Admin бүх list page pagination + bulk ажиллаж буйг шалгах.
- [x] **`API.md` ✅ шалгав (2026-08-03) — засвар шаардлагагүй байв.** Апп-ыг
      асааж `RouterExplorer`-ийн бүртгэсэн **166 route**-ыг API.md-тай
      программаар тулгахад **дутуу нэг ч зам олдсонгүй**. ⚠️ Энэ нь зөвхөн
      *зам* байгаа эсэхийг шалгасан — параметр/эрхийн тайлбар зөв эсэхийг
      баталаагүй.

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

#### ✅ Choi — Home хоёр карт бүтэн урт + Reading «Дагаж унших» засвар (2026-07-31) · ДАВХАРДУУЛАХГҮЙ

**1. Home: «Давтах үгс» + «Миний даалгавар» → бүтэн урт, дээр доор нь**
(`mobile/app/(tabs)/index.tsx`). Redesign v2-т эдгээрийг нэг эгнээнд тал талаар нь
(`nextRow`/`nextTile`, `flex: 1`) тавьсан байсныг **95ce551-ийн өмнөх бүтэн өргөнтэй
хувилбар руу** буцаав. Шалтгаан: хагас өргөнд монгол шошго (`Давтах үгс` /
`Миний даалгавар`) нэг мөрөнд шахагдаж, давталтын CTA нь дан icon болж жижгэрдэг;
мөн анги нэгдээгүй сурагчид «Давтах» ганцаараа сунжирч эвгүй байсан.
- `reviewCard` — 52pt нил ягаан icon chip + гарчиг/тайлбар + баруунд due тоо, доор
  нь бүтэн өргөнтэй **«Давтаж эхлэх»** `<Button>` (`size="md"`).
- `joinCard` — icon chip + текст + баруун chevron, зөвхөн `enrolled` үед.
- Style: `nextRow`/`nextTile`/`nextIcon`/`dueBadge` устаж, `reviewCard`/`reviewHead`/
  `reviewIcon`/`reviewBody`/`reviewDueBadge`/`joinCard`/`joinIcon`/`joinBody` сэргэв.
- `<Button>` дотроо `PressableScale`-аар haptic өгдөг тул давхар `haptics.tap()`
  дуудаагүй (дараагийн хүн бүү нэм).

**2. Reading «Дагаж унших» дунд замаасаа чимээгүй болдог алдаа**
(`mobile/src/lib/useReadAlong.ts`). 3 бодит шалтгаан байсан, гурвуулаа зассан:
- **(a) `didJustFinish` React-ийн state ирмэгээр барьж байсан.** Хуучин код
  `useEffect(..., [status.didJustFinish])`. Төрөлх player энэ талбарыг **latch**
  болгож дараалсан хэд хэдэн status update-д `true` хэвээр илгээдэг ба React тэдгээрийг
  нэг render болгон нэгтгэдэг → dep өөрчлөгдөхгүй → **гинж тасарч чимээгүй болно**
  (яг «1–2 өгүүлбэр уншаад зогсох»). Одоо `player.addListener('playbackStatusUpdate')`-
  ээр **шууд төрөлх event дээр** дараагийн өгүүлбэр рүү шилждэг.
- **(b) Android TTS-ийн `stop()` → `speak()` уралдаан.** `Speech.stop()` асинхрон тул
  мөн tick дотор дуудсан `speak()`-ийг хүлээгдэж буй stop нь угаадаг → өгүүлбэр
  1–2 үг уншаад тасардаг. Шийдэл: `silence()` **зөвхөн TTS үнэхээр ярьж байгаа
  үед** `Speech.stop()` дуудна (`speakingRef`). Өгүүлбэр `onDone`-оор хэвийн
  дуусахад юу ч зогсоох шаардлагагүй тул өгүүлбэр→өгүүлбэрийн замаас уралдаан
  бүрмөсөн арилна. **Timer/delay ашиглаагүй.**
- **(c) `replace()` + `play()` уралдаан.** Шинэ эх ачаалагдаж амжаагүй байхад
  `play()` очвол хаягддаг → ачаалагдсан ч чимээгүй player үлдэнэ. Listener дотор
  `isLoaded && !playing && !startedRef && !pausedRef` бол **мөн тэр player-ыг**
  дахин түлхэнэ. Хоёр дахь хоолой үүсгэхгүй тул давхцах эрсдэлгүй.
- `useAudioPlayerStatus` хассан (өөрийн listener-ээс `filePlaying` авах нь 500ms
  тутмын шинэ object-оос цөөн render).
- Unmount цэвэрлэгээ `useEffect(() => () => stopRef.current(), [])` — **хоосон
  deps**. Өмнө нь `[stop]` байсан нь тэр callback-ийн identity өөрчлөгдөх бүрд
  дуудагдаж өгүүлбэрийг дундуур нь тасалж болзошгүй байв.
- **Дүрэм:** аудио гинжин урсгалыг React state-ийн ирмэгээр бүү бар — төрөлх event
  дээр сонс. Гэхдээ **чимээгүй өгүүлбэрийг хоёр дахь эх сурвалжаар «аварч» болохгүй**
  (доорх регрессийг үз).

> 🔁 **Регресс — 2026-07-31 дотор нь ЗАССАН, дахин бүү нэмээрэй.** Эхний оролдлогод
> `FILE_START_TIMEOUT_MS = 6000` watchdog нэмсэн байсан: 6 секунд дотор дуу
> гарахгүй бол өгүүлбэрийг төхөөрөмжийн хоолойгоор давхар уншина гэсэн санаа.
> Бодит үр дүн — Choi-гийн тайлан: «1–2 үг хэлээд гацаад, тэгээд дуу буцаж ирээд
> **ихсэнэ**». Учир нь watchdog-ийн «эхэлсэн үү?» таамаг буруу гарахад файл болон
> TTS **зэрэг** уншиж, хоёр дуу давхцаж чангарч байв. Мөн `SPEAK_DELAY_MS = 60`
> хойшлуулалт нь «гацаж байгаа» мэдрэмж нэмсэн. Хоёуланг нь **бүрмөсөн хассан**.
> **Зарчим: нэг өгүүлбэр = нэг хоолой. Нэг чимээгүй өгүүлбэр нь давхарласан хоёр
> уншлагаас хамаагүй дээр.** Үүний хариуд ачаалагдахгүй URL-ийн үед гинж зогсох
> магадлал үлдсэн (хуучин зан төлөв) — үүнийг timeout-аар БУС, доорх backend
> хүсэлтээр шийдэх нь зөв.

**(d) Аудио session — «эхний үг уншаад дуу багасаад чимээгүй болох».** Дээрх
(a)–(c)-ийг зассаны дараа ч үлдсэн шинж. Хоёр бодит шалтгаан олдож зассан:
- **`player.pause()` сул player дээр.** TTS салаанд өгүүлбэр бүрийн өмнө болзолгүй
  `player.pause()` дуудагддаг байв. expo-audio-д pause хийхэд аудио session
  **татан буугддаг** ба тэр татан буулгалт нь `Speech.speak()` эхэлсний ДАРАА
  бууж, шинэ уншлагыг дарж/тасалдаг. Одоо `filePlayingRef`-ээр **үнэхээр файл
  тоглож байсан** үед л pause хийнэ (`stop()`-д мөн адил).
- **AI buddy record горимоо буцааж өгдөггүй.** `startRecording` нь бүх аппыг
  `allowsRecording: true` болгодог ба зөвхөн `playAudio` буцаадаг. Mic барьчихаад
  таб сольж гарвал **бүх апп record горимд үлдэж**, iOS дээр дуу нь чихэвчний
  (earpiece) сувгаар гарч «дуу нь бүдгэрч алга болсон» мэт сонсогддог — reading,
  хадгалсан үгс, flashcard бүгд. Одоо `chat.tsx`-ийн blur дээр
  `setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })`.
- `useReadAlong` нь эхлэхийн өмнө session-оо өөрөө бас баталгаажуулна
  (`startFromIdle` → **`await primeAudioSession()`**). `await` заавал хэрэгтэй:
  session солилтыг эхний `Speech.speak()`-тэй зэрэг явуулбал үг дундуур бууж
  яг л таслах эрсдэлтэй.

> 🔍 **Дараа нь энэ шинж дахин гарвал ЭХЛЭЭД үүнийг шалга** (hook-ийг бүү сэжиглэ):
> Хадгалсан үгс эсвэл Swipe дэлгэц дээр үгийн 🔊 товч дар. Тэр зам нь `Speech.speak`
> дангаараа, read-along-той огт холбоогүй. Хэрэв **тэнд ч мөн адил тасарвал**
> асуудал нь `useReadAlong`-д биш, **төхөөрөмжийн/глобал аудио session**-д байна.

⚠️ Шалгаагүй зүйл: эдгээрийг **төхөөрөмж дээр туршаагүй** (tsc + eslint цэвэр).
Expo Go дээр `npm install` хийсний дараа Reading passage нээж дагаж уншаад бүтэн
уншиж дуусгаж байгааг батал.

#### ✅ Choi — Buddy мэндчилгээ · Сорилын алдааны тойм · Үгсийн сангийн тоо (2026-07-31) · ДАВХАРДУУЛАХГҮЙ

**1. AI buddy — орохдоо НЭГ УДАА мэндчилдэг, гарахад тэр дороо чимээгүй болдог.**
`aac2f54` нь auto-speak-ийг **бүхэлд нь** хассан байсан (учир нь swipe бүрт
дуудагдаж карусель өөрөө дээрээ ярьдаг байсан). Одоо хоёрыг нь салгав:
- `BuddySelector.tsx` — `greetedRef` + `focused` state. Дэлгэц **focus авахад
  ганц удаа** төвд байгаа buddy-гийн motto-г уншина; swipe хийхэд `centerBuddy`
  солигдоно ч `greetedRef.current === true` тул дахин уншихгүй.
- Blur (өөр таб руу шилжих) дээр `Speech.stop()` + `setSpeakingSlug(null)` +
  `greetedRef` дахин зэвсэглэнэ (буцаж ирэх = дахин "орж ирсэн").
- `app/(tabs)/chat.tsx` — `useFocusEffect` дээр blur болоход `Speech.stop()` +
  `player.pause()`. **Таб бол unmount болдоггүй** тул хариулт нь дуусаагүй байхад
  Home руу шилжвэл цаанаас ярьсаар байдаг байв. Voice → select буцах товч дээр
  мөн адил зогсооно (карусель өөрөө мэндчилэх гэж байгаа).

**2. Сорил дуусгасны дараа «ямар юман дээр алдсанаа» харах** (`app/quiz/[id].tsx`).
Өмнө нь зөвхөн `1 ✓ 2 ✗` chip байсан — улаан ✗-ээс юу ч сурахгүй.
- **Өгөгдөл хаанаас гардаг вэ (энэ л гол нь):** `GET /quizzes/:id` хариултын
  түлхүүрийг **зориудаар илгээдэггүй**, `/submit`-ийн `breakdown` нь зөвхөн
  correct: true/false. Түлхүүр гарч ирдэг **цорын ганц газар** нь буруу
  хариултын үед ирдэг `/check` → `correctAnswer`. Тиймээс шинэ `mistakes`
  state-д **өнгөрөх агшинд нь барьж авдаг** болгов. **Backend өөрчлөх шаардлагагүй.**
- Асуулт бүрийн **ХАМГИЙН АНХНЫ** алдааг л хадгална (дараагийн оролдлогууд нь
  хариулт руугаа ойртсоор байдаг тул сургамжгүй). Дахин оролдоод зөв болгосон
  асуулт ч жагсаалтад **үлдэнэ** — «эцэст нь олсон» асуулт яг л дахин унших
  ёстой асуулт.
- Дүнгийн дэлгэцэд `Алдсан асуултууд` хэсэг: асуултын дугаар + текст +
  🔴 Таны хариулт + 🟢 Зөв хариу. Алдаагүй бол `resultNoMistakes` баннер.
- `formatAnswer()` — MC индексийг `B. london` болгож, word_match-ийн JSON-г
  `left → right` мөрүүд болгож харуулна (нүцгэн `1` эсвэл JSON blob уншигдахгүй).
- `open_response` (IELTS Writing/Speaking) **алдаанд тооцогдохгүй** — сервер
  түүнийг хэзээ ч auto-grade хийдэггүй (үргэлж `correct: false`) тул алдаа
  гэж бүртгэвэл худал болно.
- Шинэ i18n: `resultMistakesTitle/Hint`, `resultQuestionNo`, `resultYourAnswer`,
  `resultCorrectAnswer`, `resultNoMistakes`.

**3. Хадгалсан үгс → «Миний үгсийн сан» картын тоонууд ойлгомжтой болов**
(`src/components/VocabStats.tsx`). Гомдол: «мэдсэн 103, сурч байгаа 5 — яг юуны
5 вэ? тэгээд 95% нь юу вэ?». Тоонууд нь **математикийн хувьд зөв байсан**
(103/(103+5) = 95%), асуудал нь **аль нь юуг тоолж байгааг хаана ч бичээгүй**
байсан явдал.
- Хувийг мөрийнх нь дээр `Мэдсэн 103 / 108 үг` гэж **гарчиглав** — хувь нь энэ
  харьцаа болохоос тусдаа "оноо" биш.
- Legend-ийн зүйл бүрд серверийн **бодит дүрмийг** доор нь бичив:
  Мэдсэн = «дор хаяж нэг удаа зөв сануулсан» (`repetitions >= 1`),
  Сурч байгаа = «тааралдсан ч хараахан сануулаагүй» (`repetitions = 0`).
  «5» гэдэг тоог утгатай болгож байгаа зүйл яг энэ.
- Subtitle: «**Апп дээр** нийт {n} үгтэй тааралдсан» — доорх ⭐ жагсаалтын тоо
  гэж уншигдахаас сэргийлэв (карт нь Хадгалсан үгс дэлгэц дээр сууж байгаа).
- `total === 0` тохиолдол: 0% мөр + хоёр тэг харуулахаа болиод «хараахан
  эхлээгүй» гэдгийг хэлнэ (`vocabEmpty` / `vocabEmptyHint`). Өмнө нь энэ нь
  «чи бүтэлгүйтсэн» гэж уншигддаг байв.
- ⚠️ **«Mastery» гэж НЭРЛЭЭГҮЙ** — `known` нь ганц удаа зөв сануулахад л тоологддог
  тул хувь нь бараг үргэлж 100%-д ойрхон сууна. Энэ бол **coverage**, mastery биш.

> 📮 **Өсөхбаяр — backend хүсэлт (яаралтай биш).** `GET /reviews/stats` одоо
> зөвхөн `{ known, learning }` буцаадаг ба `known = repetitions >= 1`. Ганц зөв
> swipe = «мэдсэн» учраас mastery bar эхний өдрөөсөө 95%+ дээр тогтож, ямар ч
> мэдээлэл дамжуулахаа больдог. Хүсэлт: жинхэнэ SRS түвшнүүд нэмэх —
> `{ new, learning, young, mature, dueNow }` (жишээ нь `intervalDays` 1–21 =
> young, 21+ = mature). Ирвэл `VocabStats`-ыг үнэхээр ахиц харуулдаг болгоно.
> Mobile тал одоохондоо байгаа 2 хувинг **шударгаар** нэрлэж шийдсэн.

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
      (`@usukh6ayar/sparkxp` — slug солигдсон), `app.json` `extra.eas.projectId` =
      `d5b190dd-0fb6-4684-8aff-4648fb0f0357`.
- [x] **App icon холбогдсон** (2026-07-23) — `assets/icon-ios.png` **1024×1024**
      (iOS) + `assets/icon.png` **1254×1254** (Android adaptive, bg `#191040`).
      `app.json` эдгээр рүү зааж байна.
- [x] **Cyrillic фонт (Manrope/Inter) ачаалагдсан** — `@expo-google-fonts/manrope`
      + `/inter` dependency, `useFonts` → `mobile/app/_layout.tsx`, `expo-font`
      plugin `app.json`-д бүртгэлтэй. **2026-07-31: Onest → Manrope** — Onest-д
      `Ө ө Ү ү` глиф байхгүй тул гарчиг дотор системийн фонтоор солигдож
      харагдаж байсан. Шинэ фонт нэмэхээсээ өмнө глиф шалгах дүрэм →
      `mobile/DESIGN.md` § Typography.
- [x] **Splash screen ✅ (2026-08-03)** — `expo-splash-screen` plugin `app.json`-д
      нэмэгдсэн: `assets/splash-icon.png` (үнэгний icon-ыг 1024×1024 тунгалаг
      талбайн голд 2/3 хэмжээтэй байрлуулсан — Android 12-ийн дугуй маск
      таслахгүй), `imageWidth: 200`, `resizeMode: contain`, дэвсгэр нь **theme-ийн
      өнгө** (light `#F6F4FD` · dark `#0B0716`) тул апп нээгдэхэд өнгө үсрэхгүй.
      `app/_layout.tsx` нь `SplashScreen.preventAutoHideAsync()` дуудаж, фонт
      ачаалагдсаны дараа `hideAsync()` хийнэ — эс бөгөөс splash эхний frame дээр
      алга болж, фонт ачаалагдах хүртэл хоосон дэлгэц харагдана.
      ⚠️ Splash нь **зөвхөн native build дээр** харагдана (Expo Go өөрийн
      splash-аа үзүүлдэг) → EAS build-ээр нүдээр батал.
- [x] 🆕 **`englishxp` нэр бүрмөсөн устгагдав → SparkXP (2026-08-03).**
      `bundleIdentifier`/`package` = **`mn.app.sparkxp`** · `scheme` =
      **`sparkxp`** · SecureStore key = **`sparkxp.*`** · dev DB = **`sparkxp`**
      · package нэр = **`sparkxp-mobile`/`-backend`** · AI system prompt дотор
      "SparkXP платформ". Хэвээр үлдсэн нь зөвхөн **бодит дата**: R2 дахь
      `englishxp/...` object key, `cleanup-demo.sql`-ын WHERE email, `owner`
      (Expo бүртгэлийн нэр). Дэлгэрэнгүй → `docs/CODE_AUDIT.md §M7`.
      ⚠️ **Choi/Boju:** pull хийсний дараа `npm install`; аппаас нэг удаа
      автоматаар гарна (дахин нэвтэр); локал DB-гээ
      `ALTER DATABASE englishxp RENAME TO sparkxp;` гэж сольж өг.
- [ ] 🚨 **expo.dev дээр төслийн slug-ийг `englishxp` → `sparkxp` болго —
      EAS build хийхээс ӨМНӨ.** `app.json`-д `slug: "sparkxp"` болсон бөгөөд
      EAS үүнийг `extra.eas.projectId`-тай тааруулж шалгадаг. Одоо ажиллуулбал:
      `Slug for project identified by "extra.eas.projectId" (englishxp) does not
      match the "slug" field (sparkxp)` → **бүх `eas` команд унана**
      (`project:info`-оор баталсан). `eas project:rename` команд байхгүй тул
      **expo.dev → Project settings**-ээс гараар сольно.
      *Хэрэв dashboard slug rename-ийг зөвшөөрөхгүй бол:* `app.json`-ы `slug`-ийг
      `englishxp` болгож нэг мөрөөр буцаа (`projectId` нь төслийг холбогч
      жинхэнэ түлхүүр учир slug нь хэрэглэгчид харагддаггүй). `eas init --force`
      **бүү** ажиллуул — шинэ `projectId` үүсгэж, OTA түүхийг тасална.
      Expo Go (`npm run go`) энэ шалгалтад ороогүй тул Choi/Boju-д саад болохгүй.
      ⚠️ Дараагийн native build-ийн ӨМНӨ: локал `ios/`+`android/` (gitignore)
      хуучин ID-тэй хэвээр → `PRODUCT_BUNDLE_IDENTIFIER` (pbxproj) +
      `namespace`/`applicationId` (`android/app/build.gradle`)-ыг гараар засах
      эсвэл дахин prebuild. iOS-д шинэ App ID + provisioning profile хэрэгтэй
      (EAS өөрөө үүсгэнэ, Apple эрх асууна). → `docs/CODE_AUDIT.md §M7`
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
