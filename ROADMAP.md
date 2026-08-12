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

> ✅ **Өсөхбаярт байсан 4 хүсэлт — шийдсэн (2026-08-06):**
> 1. `push_notifications` — `expo-notifications` + `expo-device` dependency,
>    `app.json` plugin орсон. Үлдсэн нь dev-client/native build + APNs/FCM credential.
> 2. `review_xp_and_streak` — `POST /reviews/:wordId` өдөрт нэг удаагийн review XP
>    (`xpEarned`) олгоно; streak нь одоо `todayXp >= dailyGoal` үед л ахина.
> 3. `streak_freeze_cost` — `GET /gamification` нь `streakFreezeCost` +
>    `maxStreakFreezes` буцаана.
> 4. `hearts_regen_tuning` — default regen 30 минут болсон, мөн Redis
>    `hearts:defaults` override-оор deploy/app update-гүй тааруулна.

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

✅ **Өсөхбаярын 2 BE хүсэлт шийдсэн (2026-08-06):** `LearnWord` одоо
SM-2 төлөв (`repetitions`/`dueAt`/`intervalDays`) буцаана; `PUT /reading/:id/progress`
ба `GET /reading/progress` нэмэгдсэн (`reading_progress` хүснэгт + migration).
Update 3-ын "Ахиц хадгалах, номын сан" + "mastery indicator" backend талаасаа бэлэн.

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
   Байхгүй шагналыг байгаа мэт үзүүлээгүй.
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

> ✅ **Өсөхбаяр — backend хүсэлт шийдсэн (2026-08-06).** `GET /reviews/stats`
> одоо `{ known, new, learning, young, mature, dueNow, masteryThresholdDays }`
> буцаана (`mature` = `intervalDays >= 21`). `VocabStats` шинэ талбарууд ирвэл
> mastery-г `mature/total`-аар харуулна, хуучин backend дээр fallback хэвээр.

#### ✅ Choi — Доод навигаци: дэлгэц шахагдаж байсныг зассан (2026-08-03) · ДАВХАРДУУЛАХГҮЙ

**Гомдол:** `#199`-ийн долгионт navbar-ийн дараа таб бүрийн бүтэц эвдэрч,
контент **дээшээ шахагдсан**; buddy хэт өндөрт хөвж, макетаас (реф зураг) зөрсөн.

**Учир нь (нэг мөрөөр):** таб барын view нь **урсгал дотор** (flow) 142 + safe
area өндөртэй байсан. React Navigation таб барыг дэлгэцүүдтэй **нэг flex
багананд** тавьдаг — өөрөөр хэлбэл барын өндөр бүхэлдээ дэлгэцээс хасагддаг.
Гэтэл тэр 142-ын **78 нь тунгалаг** (buddy хөвөх зурвас + давалгаа). Дэлгэц бүр
хоосон агаарт ~80px алдаж байв (өмнөх хавтгай бар ~62 + inset авдаг байсан).

**Засвар — хоёр өндрийг САЛГАВ** (`src/components/tabbar/geometry.ts`):
- `TOTAL_H` (104 + inset) = барын **өөрийн view** — карт + давалгаа + тунгалаг зурвас.
- `tabBarHeight(inset)` (64 + inset) = дэлгэцүүдийн **хоосон үлдээх** зай (зөвхөн цул карт).
- `CustomTabBar`-ийн root → **`position: absolute`** (overlay, урсгалаас гарав) →
  дэлгэцүүд бүтэн өндрөө буцааж авав. Оронд нь `app/(tabs)/_layout.tsx` нь
  `sceneStyle.paddingBottom = tabBarHeight(insets.bottom)` өгнө.
- View нь картаас **өндөр хэвээр**: Android дээр эцэг view-ээсээ гадуур зурагдсан
  хэсэг **дардаггүй** тул buddy заавал дотор нь багтсан байх ёстой (`box-none`
  тул тунгалаг хэсэг дээрх даралт доорх дэлгэц рүү дамжина).

**Дизайныг реф зурагт нийцүүлэв:**
- Buddy 68→**66px** (60 зураг + 3 цагираг), давалгаа 24→**18**, тунгалаг зурвас
  54→**22**. Buddy одоо толгойгоороо ~13px цухуйж, их бие нь карт дотроо суух тул
  "давалгаанаас гарч ирж байгаа" мэт — өмнө нь картаас 73px дээгүүр хөвж байв.
- **Buddy-д шошго нэмэв** (`AI Buddy`, үргэлж ягаан). Өмнө нь `label` зөвхөн
  accessibility-д ашиглагдаж, төв таб нь ганцаараа бичиггүй байв.
- Buddy багана нь **шошгоороо** байрлана (`BUDDY_BOTTOM` = 13) → **таван шошго
  нэг шугам дээр**.
- `cardBottom()` — gesture-nav утсанд (inset ≈ 0) карт ирмэг өөдөө наалдахгүй
  байх 10px доод хязгаар; карт/мөр/дэлгэцийн padding гурав **нэг тоо** уншина.
- Ашиглагдахаа больсон `waveEdgePath()` устгав (градиент шугам `#199`-д хасагдсан).

**Дараа нь (Choi-гийн хүсэлтээр, мөн өдөр):**
- **Дүрснүүд хуучнаараа** — Ionicons → **брэндийн 3D PNG** (`appIcons`):
  `home` · `reading` · `trophy` · `profile`. 3D зургийг будаж болдоггүй тул
  идэвхтэйг **тунгалагшилт** (0.6→1) + 1.06 хэмжээ илэрхийлнэ.
- **«Туяа» = 8px өнгөт ТУУЗ** (нимгэн зураас биш). Макетыг пиксельээр задалж
  хэмжив: тууз 16–18px, картын их бие 127px → макет 2×, тууз ≈ **8dp**; өнгө нь
  `#8D5FFF → #A98CFF → #DE7CF5 → #A9AEFC → #6891FB` (пастель, 55–65% гэрэл).
  Макет дээр туузны дээд ирмэг нь **картын ирмэг** бөгөөд өнгө нь **дотогшоо**
  сууна — нимгэн stroke яагаад ч адилхан харагдахгүйн шалтгаан.
  **Заль:** ижил замыг хоёр удаа дүүргэнэ — градиентаар, дараа нь `surface`
  өнгөөр `dy = BAND`-аар доошлуулж (`wavePath(w, h, dy)`). Clip path/mask/filter
  хэрэггүй, тууз давалгааг дагана. Гадна талд үл мэдэг bloom (7@10% · 3@14%).
- **Давалгаа = макетаас ХЭМЖИЖ гаргасан косинусын эгнээ.** Макетын ирмэгийг
  пиксельээр уншиж, `depth(u) = Σ Aₖ(1 − cos2πk·u)`-г хамгийн бага квадратаар
  тохируулав → `WAVE_COS = [6.26, 6.07, −1.97, 0.36]` (алдаа ≈2dp, энэ нь
  макетын өөрийнх нь зүүн/баруун тэгш бус байдал).
  ⚠️ **Гол нээлт:** макет дээр **хажуугийн товгор нь хамгийн өндөр** (89),
  дунд нь ердөө хагас орчим (80), хотгор нь гуравны нэгд (70). Үнэг оргил дээр
  сууж байгаа юм биш — даруухан өргөлтөөс **21dp дээгүүр хөвж** байна. Дундыг
  хамгийн өндөр болгосон өмнөх бүх оролдлого яг үүнээс болж «огт өөр» харагдсан.
  Косинусын эгнээ нь тэгш хэм ба булангийн хэвтээ шүргэгчийг үнэгүй өгдөг тул
  бүх цэгтээ гөлгөр (`WARP` хэрэггүй болж устав).
- **Buddy 72 → 80px** (макет дээр 79) — үнэг өндөр хөвдөг тул томроход зохилоо.
  `FLOAT_BAND` 16 → 24, `WAVE_H` 20 → 19, `AVATAR` 74.
- **Долгион амьсгална** — зам нь frame бүрт **worklet дотор, UI thread** дээр
  дахин зурагдана (`useAnimatedProps`); JS thread огт оролцохгүй. Хөдөлгөөн нь
  **гармоник бүрийг өөрийн хурдаар нь амьсгалуулах** (`MORPH` 8/11/22%) — хэлбэр
  нь морфлоно, байрлал нь ХӨДӨЛӨХГҮЙ. Давтамж 1×/2×/3× тул давталтын заагт
  үсрэлтгүй; бүгд синус тул **phase 0 = статик** → Reduce Motion тэнд зогсоно.
- 🐞 **Алдаа зассан: захын таб дээр дарахад зай ангайдаг байв.** `drift` нь картыг
  `translateX`-ээр 6px хүртэл гулсуулдаг байсан тул Home дээр дарахад бүхэл карт
  зүүн тийш явж, **баруун захад зай** гардаг байв. Гулсалтыг бүрмөсөн хассан;
  оронд нь таб дарахад долгион **түлхэгдээд буцаж тогтоно** (`SPLASH` 8%,
  `withSequence(timing 160ms → spring)`). Ил гарах ирмэг гэж байхгүй.
- **Долгион намхан, зөөлөн болов** — тохируулгын түүхий тоог **78% болгож,
  гармоник бүрийг улам дарав** (`WAVE_COS = [4.9, 4.0, −0.85]`, далайц 19 → 13.5).
  Түүхий тохируулга утсан дээр «шахагдсан» харагдсан: өндөр гармоникууд гэдэг
  чинь яг тэр богино, огцом ганхалт. `WAVE_H` 19 → 14, `FLOAT_BAND` 24 → 28.
- **Бар нимгэрлээ** (Choi: «бага зэрэг өндөр тарган») — `BAR_H` 70 → **64**,
  `BAND` 8 → **6**, `TAB_ICON` 36 → **34**, `LABEL_BOTTOM` 6 → 5, `TAB_GAP` 2,
  долгион 78% → **66%** (`WAVE_COS = [4.17, 3.4, −0.72]`, далайц 13.5 → 11.5),
  `WAVE_H` 14 → 12. Барын харагдах өндөр **110 → 100** (+ safe area).
- **AI buddy жижгэрлээ** — `AVATAR` 74 → **66** (гадна тал 80 → **72**).
- **Булан дугуйрлаа** — `RADIUS` 34 → **48**. Долгион булан эхлэх цэгтээ хамгийн
  өндөр байдаг тул нарийн булан хад мэт унаж, хоёр үзүүр «арал» шиг харагддаг
  байв (Choi). Сүүдрийн тэгш өнцөгт ижил радиустай тул хэвээрээ нуугдана.
- 🐞 **Алдаа зассан: AI buddy дэлгэц дээр үнэг Apply товчны доод ирмэгт наалддаг
  байв.** Тоогоор шалгахад **үнэг өөрөө хүрдэггүй** (цагирагийн орой товчноос
  11px доор) — буруутан нь **halo-гийн 22px сүүдэр** байсан: `scale 1.20` дээр
  22px радиустай тул үнэгнээс **18px цааш** гэрэлтэж товчин дээр буудаг байв.
  Засвар нь `BuddyTab`-ийн гэрэлтэлтийг агшаах: halo `scale ≤1.13 · radius 6`,
  цагирагийн сүүдэр `radius 10/12` (офсет нь +6 буюу **доошоо** тул дээшээ ердөө
  ~4px хүрнэ). Одоо бүх зай эерэг: цагираг 11 · цагирагийн гэрэл 5 · halo 0.3.
  ⚠️ Эхэндээ `BuddySelector`-ийн `paddingBottom`-д `BUDDY_OVERHANG` (29px) нэмж
  үзсэн нь **буруу** байсан — `wrap` нь `flex:1` тул карусель шахагдаж, тогтмол
  өндөртэй карт нь цэг/нэр рүү цохиж дэлгэцийг эвдсэн (файл дотор нь энэ талаар
  анхааруулга байсан). **Буцаасан — дэлгэцийн layout огт хөндөгдөөгүй.**

- **Бар дахин нарийслаа (−14px, Choi сонгов).** `BAR_H` 64 → **58**, `TAB_ICON`
  34 → **30**, `BAND` 6 → **5**, `LABEL_BOTTOM` 5 → 4, buddy 72 → **68**, мөн
  safe area-гаас **8px эргүүлэн авав** (`cardBottom = max(inset − 8, 12)`;
  шошго дэлгэцийн ирмэгээс 30px дээр — home indicator-оос цэвэр). Барын нийт
  өндөр **98 → 84px**.
- **Хотгорыг хадав (`DIP_U`) → хөдөлгөөн 2 дахин томров.** Гүнийг тухайн агшны
  хотгорын гүнд хуваан нормчилдог тул хотгорууд үргэлж яг `BAR_H` дээр
  (57.97…58.00). Өмнө нь амьсгалалт бүр хотгорыг гүнзгийрүүлж, дүрсний 3px зайг
  иддэг байсан тул хөдөлгөөнийг бараг үл мэдэг байлгах шаардлагатай байв. Одоо
  `MORPH` 16/22/40%, `SPLASH` 16% — дунд хэсэг 3.1px хөдөлнө, зай 3.0px хэвээр.

- **Дахин тохируулсан (Choi, мөн өдөр):** бар хэт намхан болсон тул `BAR_H`
  58 → **64**, `TAB_ICON` 30 → **34**, `BAND` 5 → **6**, `LABEL_BOTTOM` 4 → 5
  (нийт **90px**, эх нь 98). Navbar доторх **AI buddy товч жижгэрлээ: 68 → 60px**
  (`AVATAR` 54).
- **`ROLL` (1.2px) — долгион хажуу тийш найгадаг болов.** Бусад гишүүд тэгш хэмтэй
  тул хөдөлгөөн «машин амьсгалж байгаа» шиг уншигддаг байсан; `ROLL` нь синус
  (тэгш бус) гишүүн учир нэг мөр өргөгдөхөд нөгөө нь суудаг. Үүнийг боломжтой
  болгосон зүйл нь **хоёр хотгорыг хоёуланг нь хадсан** нормчлол (илүү гүнээр нь
  хуваана) — эс бөгөөс найгах бүрд нэг тал нь гүнзгийрч дүрсний зайг иддэг байв
  (хэмжсэн: `ROLL`-гүй 2.9/2.9 → `ROLL 1.2`-той мөн 3.0/3.0, товгорын хөдөлгөөн
  2.0 → 3.2px).

Шалгасан: `tsc --noEmit` цэвэр · `expo export` бүтнээрээ bundle болов ·
макетыг PNG болгож **пиксельээр задлан** (туузны зузаан, өнгө, давалгааны
хэлбэр) хэмжив · шинэ геометрийг жинхэнэ 3D дүрснүүдтэйгээ SVG болгож зурж, таб
бүрийн дүрс өнгөт туузнаас хэр зайтайг тоогоор шалгав. Дэлгэрэнгүй:
`mobile/DESIGN.md` → Bottom Navigation.

#### ✅ Choi — Reading XP хаалт + Толь бичгийн хажуугийн самбар (2026-08-03) · ДАВХАРДУУЛАХГҮЙ

**1. Reading (`app/reading/[id].tsx`, `src/components/ReadingQuiz.tsx`)**
- **Цагийн мэдээлэл бүрмөсөн хасагдав.** Эхлээд секундийг минут болгосон
  (`fmtTime`) боловч Choi «цаг нь ерөөсөө хэрэггүй» гэсэн тул meta мөрөөс
  `time-outline` чипийг бүтнээр нь + `fmtTime` функцийг устгав. Meta-д үлдсэн
  нь: **CEFR · сэдэв · N үг · N өгүүлбэр**.
- **Текст томорлоо.** Биеийн фонтын шат `[13…23]` → **`[16,18,20,22,25,28]`**,
  анхны утга **20** (өмнө 15). Мөрийн өндөр `×1.45` → **`×1.6`**.
- **⭐ «Ерөнхий том хайрцаг» — унших хуудас.** B1/B2 болох тусам эх бичвэр
  хэдэн дэлгэц үргэлжлэх тул өмнөх «фонтын мөр → сонсох мөр → карт» гэсэн
  тасархай зурвасуудыг **нэг `sheet` болгож нэгтгэв**
  (`colors.surface` · `radius.xl` · `overflow: hidden`):
  - Дээд талд нь нимгэн **toolbar** (Дагаж унших pill · ⏮ ⏭ · баруун талд
    A⁻/A⁺ фонтын алхам), доор нь hairline зураас.
  - Дараа нь эх бичвэр өөрөө `paddingHorizontal: lg · paddingVertical: xl`-тэй.
  «N/N өгүүлбэр» тоолуурыг toolbar-аас хассан (meta мөрөнд аль хэдийн бий,
  нарийн утсан дэлгэцэд toolbar шахагдаж байсан).
- **⭐ Скролл → ХУУДАС (`src/components/reading/PagedReader.tsx`).** Урт эхийг
  төгсгөлгүй гүйлгэхийн оронд **ном шиг хажуу тийш эргүүлж** уншина.
  - **Яаж ажилладаг:** эхийг **нэг л удаа** бүтэн өндрөөр байрлуулж, тогтмол
    өндөртэй `overflow: hidden` цонхонд хийнэ; хуудас эргэхэд зөвхөн
    `translateY` шилжинэ. Хуудас бүрт нэг view үүсгэвэл 12 хуудастай B2
    өгүүлэл эхийг 12 удаа дахин байрлуулах байсан — энэ аргаар 1 хуудастай A1
    түүхтэй ижил өртөгтэй.
  - **Хуудасны зааг** нь `onTextLayout`-ийн мөр бүрийн `y`/`height`-аас
    гарна: цонхны ёроолыг давах эхний мөрөөс шинэ хуудас эхэлнэ, тул **мөр
    хагасаар таслагдахгүй**.
  - Хажуу тийш шудрах (`Gesture.Pan`, `failOffsetY` тул босоо гүйлт хэвээр),
    эсвэл доорх `‹ 3 / 12 ›` сумнууд. Фонт томсгоход дахин хуудаслана.
  - **Дагаж унших синк:** ярьж буй өгүүлбэр өөр хуудсанд байвал автоматаар
    эргүүлнэ (мөрийн `text` боломжтой бол тэмдэгтээр нарийн, эс бөгөөс
    хувь тэнцүүлж ойролцоогоор).
  - Дээд талын **явцын зураас одоо хуудсыг** хардаг (өмнө нь гадаад скроллыг —
    хуудаслалттай болсон тул тэр бараг хөдлөхгүй).
  - ⚠️ `measure()` доторх `lastKey` шалгалт нь **заавал хэрэгтэй**:
    `setPages` бүр шинэ объект үүсгэдэг → дахин зурна → `onTextLayout` дахин
    дуудагдана → төгсгөлгүй давталт. Устгаж болохгүй.
- **⭐ Тест олдохгүй байсныг зассан (Choi: «би хаана тест рүүгээ орох вэ?»).**
  Гурван шалтгаан нэг дор нийлж тестийг бүрэн нуучихсан байв:
  1. Товчны шошго «Уншсан» — *юу болохыг* хэлдэггүй.
  2. Хуудаслалт орсноор унших хайрцаг дэлгэцийн 52% эзэлж, товч урсгал дотор
     нэг дэлгэц доор үлдсэн.
  3. Тестгүй материалд товчны доор **юу ч** гардаггүй байсан тул өгөгдлийн
     асуудал уу, UI-ийн уу нь ялгагдахгүй.
  Засвар:
  - Товч **дэлгэцийн ёроолд бэхлэгдэв** (`ctaBar`, absolute + safe-area) —
    гүйлгэхгүйгээр шууд харагдана. Тест нээгдмэгц алга болно (тэрнээс хойш
    хийх зүйл нь тест өөрөө).
  - Шошго нь **«Тест хийж +15 XP авах»** (`readingStartQuiz`) болов —
    асуултгүй материалд л «Уншсан» гэж бичнэ. Хоёр товчийг нэг болгов
    (`readingDone` түлхүүр устав).
  - Дарахад `scrollToEnd`-оор **шууд асуултууд руу** аваачна.
  - Тестгүй бол «Энэ материалд тест ороогүй тул XP олгогдохгүй»
    (`readingNoQuiz`).
  Дараалал: (бэхлэгдсэн товч) → тайлбар → **тест** → баяр хүргэл.

#### 🚨 BLOCKER — Reading-ийн асуултууд BACKEND дээр хадгалагддаггүй (2026-08-03)

**Шинж тэмдэг:** admin дээр «Асуултууд — унших дуусахад» хэсэгт асуулт оруулж
хадгалсан ч, mobile дээр БҮХ материал «Энэ материалд тест ороогүй» гэж
харуулна → XP авах боломжгүй.

**Шалтгаан — `backend/src/reading/reading.service.ts`.** Гинжин холбоос бүгд
байгаа мөртлөө service нь тэр талбарыг **хоёр газарт орхигдуулсан**:

| Давхарга | Төлөв |
|---|---|
| Admin `ReadingPage.tsx:385` | ✅ `comprehensionQuestions`-ыг payload-д илгээдэг |
| `create-reading.dto.ts:136` | ✅ DTO-д зөвшөөрөгдсөн, валидацитай |
| `reading-passage.entity.ts:98` | ✅ `comprehension_questions` jsonb багана бий |
| **`reading.service.ts` `create()` (116-127)** | ❌ `dto.comprehensionQuestions`-ыг **огт assign хийхгүй** → багана `default: []` хэвээр |
| **`reading.service.ts` `update()` (155-168)** | ❌ мөн адил — talbar чимээгүй **хаягддаг** |
| `GET /reading/:id` | ✅ бүтэн entity буцаана (шүүлтгүй) |
| Mobile | ✅ `comprehensionQuestions` уншиж, тест үзүүлэхэд бэлэн |

Өөрөөр хэлбэл DB дэх **бүх мөрийн `comprehension_questions` = `[]`**.

**Засвар — `keyVocab`-ийн яг доор 2 мөр (Өсөхбаяр):**
```ts
// create() — passages.create({...}) дотор
comprehensionQuestions: dto.comprehensionQuestions ?? [],

// update() — keyVocab-ийн мөрийн дараа
if (dto.comprehensionQuestions !== undefined)
  passage.comprehensionQuestions = dto.comprehensionQuestions;
```
Migration шаардлагагүй (багана аль хэдийн бий). Засаад **асуултуудаа admin
дээр дахин хадгалах хэрэгтэй** — өмнөх хадгалалтууд DB-д хүрээгүй.

*Choi backend-ийг хөндөөгүй (ажлын хуваарийн дагуу). Mobile тал бүрэн бэлэн —
энэ 2 мөр орсон даруйд тест шууд ажиллана.*
- **Толгой хэсэг богиноров (текст хэт доогуур байсан).** Өмнө нь зураг → гарчиг
  → meta → гол үгс гэсэн **дөрвөн блок** дараалж, эх бичвэр эхний дэлгэцээс
  гарч байв. Одоо:
  - **Гарчиг + meta нь зурган ДЭЭР** суув (доод талд нь `rgba(10,6,30,0→0.88)`
    scrim — админы оруулсан ямар ч гэрэл зурган дээр гарчиг уншигдана).
    Cover нь `aspectRatio` биш **`minHeight: 168` + `justifyContent: flex-end`**
    — урт гарчиг хайрцгийг тэлнэ, тайрахгүй.
  - **Гол үгс нэг мөр болж хажуу тийш гүйдэг** (`ScrollView horizontal`).
    Өмнө нь wrap хийж 3-4 мөр өндөр болдог байв. Гарчиг + заавар нэг мөр
    caption болов.
  - `Meta` компонент `onCover` prop авдаг болов (scrim дээр цайвар бэх).
  Нийт **~150px** дээшээ ойртлоо.
- **⭐ XP-г тестээр хаалаа (гол өөрчлөлт).** Өмнө нь «Уншиж дууслаа» дарахад
  шууд +15 XP авдаг байсан. Одоо:
  - «**Уншсан**» товч = зөвхөн тэмдэглэгээ, **XP өгөхгүй** → доор нь admin дээр
    зохиосон тест нээгдэнэ.
  - `ReadingQuiz` нь `onPass` дуудлагатай болов: **60%-иас дээш зөв** бөглөвөл
    л дэлгэц `completeReading()` дуудаж +15 XP өгнө. Унавал «Дахин оролдох».
  - **«Уншиж дууслаа (+15 XP)» товч бүрмөсөн устав** (`readingFinish` i18n
    түлхүүр ч хамт). Эхний хувилбарт тестгүй материалд хуучин зан үлдээсэн
    боловч Choi «finish reading хэсэг байсаар л байна» гэсэн тул одоо
    **`award()`-г ЗӨВХӨН тест дуудна** — гүйлгээд доош тулахад XP өгдөг товч
    апп даяар байхгүй. Тестгүй материал XP өгөхгүй (жагсаалтад ✓ л тавина).
- **Гол үгс (keyVocab) дарж болдог болов** → үгийнхээ дээр гарах жижиг popover.

**2. Толь бичиг (`src/components/DictionaryProvider.tsx` + шинэ
`DictionaryButton.tsx`)**
- **⭐ ХОЁР СИСТЕМ БҮРЭН САЛСАН (энэ нь гол бүтцийн шийдэл).** Уншлагын
  «2 дарах» ба толь бичгийн хайлт нь ӨӨР зорилготой тул өөр UI-тай:
  | | Уншлагын gesture | Толь бичиг |
  |---|---|---|
  | Хэрхэн | Эх бичвэрт **2 дарах** / өгүүлбэр сонгох / гол үг дарах | Толгойн **хайх товч** |
  | Юу гарах | Үгийн дээр гарах **жижиг popover**, **ганц** богино утга + дуудлага + хадгалах | **80% самбар**, хайлттай, **4 утга** жишээтэйгээ |
  | Файл | `dictionary/WordPopover.tsx` | `dictionary/DictionaryPanel.tsx` |
  Хоёул `dictionary/useWordLookup.ts` hook-ийг **тус тусдаа instance-аар**
  хэрэглэнэ — state хуваалцахгүй тул уншиж байхад үг харах нь толь бичгийн
  сессийг эвдэхгүй, эсрэгээрээ ч мөн адил. `DictionaryProvider.tsx` нь одоо
  зөвхөн context + энэ хоёрыг холбогч нимгэн давхарга (~150 мөр).
  `lookup(word, anchor)` / `translatePhrase(text, anchor)` нь **anchor-тай
  хэвээр** (popover үгийнхээ дээр гарах ёстой), `openSearch()` нь самбар нээнэ.
- **Толь бичгийн самбар:** баруун талаас гулсана (backdrop дарвал хаагдана),
  **хайлтын мөр самбар дотроо** (гар автоматаар нээгдэнэ), үг, **Дуудлага**
  (ElevenLabs → device TTS fallback), **Хадгалах**, доор нь утгын жагсаалт.
- **Үр дүн = хамгийн ихдээ 4 утга, давтамжаараа эрэмбэлсэн** (санамсаргүй биш).
  Утга бүр яг **3 мөр**: `1. run` → `I run every morning.` →
  `Би өглөө бүр гүйдэг.` **Тайлбар, тодорхойлолт, part-of-speech, карт,
  «хамгийн түгээмэл» шошго — байхгүй.** Холбоо үг ч нэг утга болно
  (`4. run out of`).
- **Хайлт нь самбар ДОТРОО.** Өмнөх дээрээс буудаг тусдаа хайлтын Modal-ыг
  бүрмөсөн устгав — товч дарахад самбар шууд нээгдэж, гар автоматаар гарна;
  сүүлд хайсан үгс самбар дотор чипээр харагдана.
- **Дизайн — hero градиент + editorial жагсаалт.** Өмнө нь самбар нь дөрвөн
  саарал зурвас (гарчиг · хайлт · үг · товчнууд) дээрээс доош овоолсон байв.
  Одоо тэр дөрвийг **нэг brand градиент hero** болгож нэгтгэв
  (`colors.primaryGradient`, 135°, панелийн зүүн булангийн радиустай —
  `overflow: hidden`). Hero дотор: хайлтын мөр + хаах товч (цасан шиг
  `rgba(255,255,255,0.18)` дүүргэлт), **32/40 үг** (h1-ээс нэг шат том), доор нь
  Дуудлага/Хадгалах pill-үүд. Энэ нь **DESIGN.md-ийн дүрмийг ч зөв болгодог**:
  brand ягаан нь dark дээр ТЕКСТ болж чаддаггүй (3.20:1) — цагаан текстийг
  градиент дээр тавьсан цорын ганц зөв хэлбэр нь энэ.
- **Утгын мөрүүд:** дугаар нь өөрийн баганад (22px) суух тул үг · жишээ ·
  орчуулга гурав **нэг зүүн ирмэг** дээр эгнэнэ; утга хооронд карт биш
  **hairline зураас**. Шинэ үг хайх бүрд мөрүүд `FadeInDown`-оор ээлжлэн
  гарна (Reduce Motion-д унтарна). Хоосон үед хайлтын дүрс + богино заавар.
- **Толь бичгийн товч зөвхөн 5 үндсэн таб дээр** — Home · Хичээл · AI найз ·
  Сорил · Профайл. `TopBar`-ийн `showDictionary` нь **default `false`**
  (гүн дэлгэцүүд бол төвлөрсөн урсгал), `chat.tsx` л `showDictionary` дамжуулна;
  өөрийн header-тэй `lessons`/`soril`/`profile`-д `<DictionaryButton>` суулгав.
  Дүрс нь **томруулдаг шил (`search`)** хэвээр.

**✅ Өсөхбаяр — BE тал шийдсэн (2026-08-06):**
`GET /dictionary/:word` Word bank-аас олдсон үед `example_sentence` +
`example_translation`-ийг `meanings: [{ word, example, translation }]` болгож
буцаана — **AI дуудлагагүй**, хуучин `translation`/`audioUrl` contract хэвээр:

```jsonc
{
  "word": "run", "translation": "гүйх", "audioUrl": null, "cached": true,
  "meanings": [                   // ХАМГИЙН ИХДЭЭ 4 · давтамжаараа, түгээмэл нь ЭХЭНД
    { "word": "run",         "example": "I run every morning.",   "translation": "Би өглөө бүр гүйдэг." },
    { "word": "run",         "example": "She runs a small business.", "translation": "Тэр жижиг бизнес ажиллуулдаг." },
    { "word": "run",         "example": "The machine is running.", "translation": "Төхөөрөмж ажиллаж байна." },
    { "word": "run out of",  "example": "We ran out of food.",     "translation": "Бидний хоол дууссан." }
  ]
}
```
4 утгын бүрэн AI contract нь тусдаа `GET /dictionary/search/:word` дээр
`dictionary_entries` cache-тай бэлэн. `POST /dictionary/:word/save` замыг мөн
солиж, одоо `POST /dictionary/saves/:word` нь `user_dictionary_saves`-д бичнэ;
Word bank-ийг `needs_review` мөрөөр бохирдуулахгүй.

Шалгасан: `tsc --noEmit` цэвэр · `eslint` хөндсөн файлууд дээр цэвэр.

#### ✅ Choi — «Хадгалсан үгс» 2 таб + Gmail маягийн чирж устгах (2026-08-04) · ДАВХАРДУУЛАХГҮЙ

**1. Чирж устгах — Gmail-ийн загвар (`src/components/SwipeToDelete.tsx`)**

Энэ нэг өдөр дотор **3 хувилбар дамжсан**, эцсийн нь Gmail. Дахин бүү эргүүл:
1. *(эх байдал)* чирэхэд Устгах товч гарч, **товч дарж** л устдаг байв;
2. *(завсрын)* нээгдсэн мөрийг **дахин чирвэл** устдаг болгов;
3. **(эцсийн)** Choi: «яг л Google-ийн email шиг болго» → **товч бүрмөсөн
   хасагдав**, Gmail-ийн ганц чирэлт болов.

- **Одоогийн зан үйл:** мөрийг хажуу тийш чирэхэд ард нь зөөлөн улаан **бүтэн
  мөрийн зурвас** (track) + хогийн сав гарна. Мөрийн өргөний **38%**
  (`ARM_FRACTION`) давахад **зэвсэглэнэ** — дүрс `1.16` болж дэвхцээд `1` дээр
  тогтоно, «Устгах» бичиг гарч ирнэ. Тавихад устана; босгоос өмнө тавивал буцаж
  очно.
- **⭐ Чирэх үеийн haptic (Choi хүссэн).** Босго давахад **`haptics.select()`**
  (шаржигнуур товшилт), буцаж бууж ирэхэд **`haptics.tap()`** (зөөлөн),
  устгахад **`haptics.medium()`**. Өөрөөр хэлбэл **тавихаас өмнө юу болохыг
  гараараа мэдэрнэ**. `useAnimatedReaction` нь `progress ≥ ARM_FRACTION` гэсэн
  boolean-ыг хардаг тул давалт бүрт **яг нэг л удаа** дуугарна.
- **Тохиргоо:** `friction={1}` (хуруутайгаа 1:1 — мөр өөрөө чирэгдэж байгаа болохоос
  шүүгээ нээж байгаа биш), `overshootRight={false}`, `rightThreshold = rowW × 0.38`.
  `renderRightActions` нь **бүтэн өргөнтэй** зурвас буцаадаг тул `rightWidth` =
  мөрийн бүтэн өргөн болж, «нээгдэх» гэдэг нь = «дэлгэцээс гарах» болно →
  **`onSwipeableWillOpen` нь бидний commit дохио**.
  - `rowW`-г `onLayout`-оор хэмжинэ, эхний утга нь `wp(100) − 32` тул утсан дээр
    хэмжилт таарч **дахин render хийхгүй** (таблет дээр 1 удаа).
- **Өнгө — 3 удаа тохируулж эцэслэв. ⚠️ Дахин бүү өөрчил.**
  цул `c.danger` («хэт улаан») → `c.dangerSoft` угаалга («хэт бүдэг») →
  **`TRACK_RED = '#DC2626'` + цагаан дүрс/бичиг** (Choi: «яг л гоё default
  улаан»). Энэ нь palette token **биш, модулийн тогтмол** — учир нь `danger` нь
  *бичиг/хүрээнд* тохируулагдсан: light `#C42B2B` нь бараан хүрэн, dark
  `#F87171` нь цайвар ягаан, аль нь ч **бүтэн мөр дүүргэхэд** «устгах» гэж
  уншигдахгүй. `#DC2626` (red-600) нь цагаантай **4.8:1** тул хоёр сэдэвт ижил
  ажиллана. Дүрс `trash-outline` → **`trash`** (цул дэвсгэр дээр цул дүрс).
- **⭐ Устгах анимац.** Чирж устгасан мөр өөрийн хурдаараа дэлгэцээс гарах ба
  улаан зурвас нь **байрандаа үлдэж** (Gmail-тэй адил) дараа нь **өндөр нь
  хаагдаж зай нь битүүрнэ** (`CLOSE_DELAY 120` → `CLOSE_MS 190`). Мөр доторх
  ⭐/🔖 товчоор устгавал мөр өөрөө зүүн тийш нисч бүдгэрээд (`FLY_MS 200`) мөн
  зай нь хаагдана. `onDelete` нь анимац **дууссаны дараа** л дуудагдана — тиймээс
  жагсаалт хурууны доороос гэнэт үсэрдэггүй.
  - Өндрийг `onLayout`-оор хэмжиж (`rowH`), **`maxHeight`**-аар хаана —
    `height: undefined` буцаадаг conditional style Reanimated дээр найдваргүй тул
    `NO_MAX_HEIGHT = 9999` sentinel ашиглав. `busy` ref нь давхар устгахаас хамгаална.
  - 🐛 **Засвар (Choi мэдээлсэн): «мөрийн 4 буланд өөр өнгийн хурц өнцөг
    гарч байна».** Шалтгаан: `Card variant="raised"` → `elevation.sm` нь iOS дээр
    `shadowColor: colors.glow` (**ягаан** гэрэлтэлт) хэрэглэдэг. Түүнийг
    **дөрвөлжин `overflow: hidden`** тайрахад дугуй булангийн гадна талд ягаан
    тэгш өнцөгт шаантаг үлддэг — «өөр өнгийн хурц өнцөг» яг тэр.
  - Тайрч байсан нь **`ReanimatedSwipeable`-ийн ӨӨРИЙН container**
    (номын сангийн `styles.container = { overflow: 'hidden' }`, унтраах
    боломжгүй — track-ийг задрахаас хамгаалдаг). ⚠️ Эхний оролдлого нь манай
    гаднах wrapper-ийг зассан тул **үр дүнгүй байсан** — clip нь номын сан дотор
    байна. Шийдэл: `containerStyle={{ borderRadius: radius.lg }}` дамжуулж
    **clip-ийг Card-тай яг ижил радиустай** болгосон.
  - ⚠️ **Дүрэм:** энэ мөрөнд оролцох аль ч `overflow: hidden` (гаднах wrapper ч,
    swipeable-ийн container ч) **заавал `radius.lg`-тэй** байх ёстой. `Card`-ийн
    радиус өөрчлөгдвөл энд мөн сольж өг.
- **`children` нь одоо функц ч байж болно:** `(remove) => <Card…>`. `remove` нь
  чирэлттэй **яг нэг** анимацыг ажиллуулна, тул мөр доторх ⭐/🔖 товч дарахад
  бас нисч гардаг болов. Энгийн `ReactNode` хэлбэр хэвээр ажиллана.
- **A11y:** дарж болох Устгах товч байхгүй болсон (Gmail-д ч байхгүй) — харин
  мөрийн ⭐/🔖 товч нь `accessibilityLabel={t('removeFromSaved')}`-тай **жинхэнэ
  товч** хэвээр тул дэлгэц уншигчаар устгах зам хаагдаагүй.
- ⚠️ **Дүрэм:** `useAnimatedStyle`/`useAnimatedReaction` дотор `spacing.lg` шиг
  импортолсон **объектын талбар** биш, **модулийн түвшний тоо** ашигла (worklet
  нь примитивийг найдвартай барьж авдаг).
- 🔜 **Санал (хийгээгүй):** Gmail-д ганц чирэлт аюулгүй байдгийн нөгөө тал нь
  **«Буцаах / Undo» snackbar**. Манай `Toast` нь `pointerEvents="none"` + дээд
  талд тогтсон тул дарж болдоггүй → Undo нэмэхийн тулд `Toast.tsx`-г (бүх аппын
  хуваалцсан component) өргөтгөх хэрэгтэй. Устгасан үгээ буцааж авах нь хоёулаа
  toggle endpoint учир BE тал бэлэн. Шийдвэрийг Choi гаргана.

**2. Тольны үгс мөр одоо чирэгддэг (`app/saved.tsx` → `DictRow`)**
- `DictRow` нь `SwipeToDelete`-д ороогүй байсан тул **чирэхэд юу ч гардаггүй**
  байсныг зассан. Одоо хоёр жагсаалтын мөр яг ижил ажиллана.

**3. Харагдац — нэг скроллоос 2 таб болов (`app/saved.tsx`)**
- Өмнө: «Хичээлийн үгс» жагсаалтын **доор** «Тольны үгс» нь `ListFooterComponent`
  дотор нэг урсгалаар цувдаг байв → үг олширмогц ёроолд нь хүрэхгүй болно.
- Одоо `PeriodTabs` segmented control-оор **2 тусдаа хэсэг**: `Хичээлийн үгс` /
  `Тольны үгс`, тус бүр дээрээ **тоогоо** харуулна. Зөвхөн нээлттэй таб рендерлэнэ
  (`FlatList` нь `key={tab}`-аар дахин үүснэ → скролл дээрээсээ эхэлж, хагас
  нээлттэй чирэлт үлдэхгүй).
- Таб бүрийн үйлдлийн мөр өөр: Хичээлийн → **«Давтаж эхлэх»** (flashcard),
  Тольны → **«Толь бичиг»** (`openSearch()`). Доор нь чирэх дохионы жижиг
  тайлбар (`swipeToDeleteHint`) — дохио нь өөрөө үл үзэгдэх тул нэг удаа хэлнэ.
- Хоосон төлөв таб бүрт тусдаа: `noSavedWords*` · шинэ `noDictionaryWords*`.
  Хоёулаа `EmptyState` (үнэг + badge) болов — өмнөх ⭐ emoji блок хасагдав.
- `VocabStats` карт нь таб хоёрын **дээр** нийтлэг хэвээр (энэ нь хадгалсан
  жагсаалт биш, насан туршийн үгсийн сангийн хэмжээ).

**4. Хуваалцсан component — `src/components/PeriodTabs.tsx`** ⚠️ **Boju АНХААР**
- `options`-д **сонголтот `count?: number`** нэмэгдэв → идэвхтэй таб дээр цагаан
  тунгалаг, идэвхгүй дээр `surface` өнгөтэй тооны pill гарна. `count` дамжуулахгүй
  бол харагдац **яг хуучин хэвээр** (Чансаа/Leaderboard-ын 3 таб хөндөгдөөгүй).
- Таб нь `flexDirection: row` + `justifyContent: center` болж, `accessibilityRole="tab"`
  нэмэгдэв.

Шинэ i18n түлхүүр (mn+en): `noDictionaryWords` · `noDictionaryWordsHint` ·
`swipeToDeleteHint`.

Шалгасан: `tsc --noEmit` цэвэр · `eslint` хөндсөн файлууд дээр цэвэр ·
`expo export --platform android` bundle амжилттай.

#### ✅ Choi — Хичээлийн буцалт · Home-ийн зай · Streak баяр хүргэлт · Сүүдрийн тайралт (2026-08-04) · ДАВХАРДУУЛАХГҮЙ

**1. «Хичээл рүү ороод буцаж чадахгүй» (`app/lesson/[id].tsx`)**
- 🐛 **Гол алдаа — шагналын самбар БҮРМӨСӨН гацдаг байсан.** `markDone()` нь
  `setLessonReward(0)` хийгээд **нэг л** `setTimeout(…, 1800)` тавьдаг байв.
  Дараа нь `completeLesson` буцаж ирээд `setLessonReward(res.xpAwarded)` дахин
  асаадаг — гэтэл **шинэ таймер тавьдаггүй**. Тиймээс сүлжээ удаан (>1.8s) үед
  XP-ийн самбар **хэзээ ч унтрахгүй**, `RewardBurst` нь `absoluteFill` +
  `zIndex 50` тул **буцах товчийг халхалж** дэлгэцээс гарах арга алга мэт
  харагддаг байв. Одоо `showReward()` нь өмнөх таймерыг цуцалж шинийг тавина,
  unmount дээр цэвэрлэнэ (`REWARD_MS = 1800`).
- **Самбар одоо толгойн доор гарна.** `RewardBurst`-д `topOffset` prop нэмэгдэж,
  хичээлийн дэлгэц `TOPBAR_H = 64` дамжуулна. (`pointerEvents="none"` тул
  дарахад ажилладаг байсан ч, **харагдахгүй товч бол эвдэрсэн товч**.)
- **Толгойд гарчиг нэмэгдэв** — өмнө `<TopBar back />` нь гарчиггүй, хоосон
  мөрөнд ганц сум байсан. Одоо `t('lessonScreenTitle')` («Хичээл»), 3 төлөвт
  (loading/error/normal) ижил.
- **`app/level/[code].tsx`-ийн буцах товч** нь `router.back()`-ийг **шууд**
  дууддаг байсныг `TopBar`-тай ижил болгов: `canGoBack()` шалгаад үгүй бол
  `/(tabs)/lessons` руу (deep link-ээс орвол өмнө нь үхмэл товч байсан) +
  `haptics.tap()` + `accessibilityLabel`.

**2. Home — «Үргэлжлүүлэх» ба өдрийн зорилго наалдсан (`app/(tabs)/index.tsx`)**
- `continueCard`-д `marginTop: lg` байсан ч **`marginBottom` байхгүй**, харин
  `DailyGoalCard`-д ямар ч margin байгаагүй (түүний тайлбар нь «зайг доод блок
  өгнө» гэсэн ч доод блок нь өгдөггүй байв) → **0px зайтай наалдаж** байсан.
- ⚠️ **Дүрэм:** Home дээрх блок бүр **өөрийн ДЭЭД талын зайг** эзэмшинэ
  (`reviewCard`/`joinCard` шиг `marginTop: lg`). `DailyGoalCard` одоо `style`
  prop авдаг болсон тул дэлгэц нь зайг өгнө.
- `DailyGoalCard`-д мөн **1px хүрээ** нэмэгдэв: цагаан зурвас нь гэрэлтсэн ягаан
  картны доор шууд наалдахад хоёулаа нэг том дүрс мэт уншигдаж байв. Одоо доорх
  review/join картуудтай ижил. Дотоод padding `sm → md`.

**3. Streak баяр хүргэлт + мөстөлт харуулах**
- `AchievementModal` (хуваалцсан) 3 сонголтот талбар авав: **`badgeValue`**
  (дугуйн дотор том тоо, дүрс нь 54→30 болж дээр нь суух), **`note`** +
  **`noteIcon`** (доор нь өнгөт чип). Дамжуулахгүй бол цомын харагдац **яг
  хуучнаараа**.
- **Streak цонх одоо:** «Өдрийн зорилго биеллээ 🎉» → дугуйнд **өдрийн тоо том**
  → **«Дараалал сунгагдлаа!»** → «+N XP урамшуулал» → мөстөлтийн чип.
  (Өмнө нь ганц жижиг дөл + «12 өдрийн дараалал» гэсэн мөр байв.)
- **Мөстөлт (2 арга, хоёуланг нь):**
  1. **Одоо ажиллана** — `streakFreezes`-ийг **хоногоор** хэлнэ:
     «2 хоногийн мөстөлтийн хамгаалалттай». Баяр хүргэх цонхонд + `StreakFreezeSheet`-д.
  2. **Backend шийдсэн (2026-08-06)** — `streakFreezesUsed?` одоо ирнэ (энэ
     streak хэдэн алгассан өдрийг даван туулсан). Ингэснээр «Энэ дарааллыг
     2 хоног мөстөлт хамгаалсан» чип автоматаар асна. Хадгалалт:
     `users.streak_freezes_used_current` + migration
     `AddStreakFreezesUsedCurrent1786900000000`.

**4. 🐛 Сүүдэр дөрвөлжин тайрагдах — аппын хэмжээнд аудит**
- Choi: «Home-ийн *Бас үзээрэй* дахь IELTS/Хэлц картууд ч тийм байна».
- **Шалтгаан бүр ижил:** `elevation.*` нь iOS дээр `shadowColor: colors.glow`
  (**ягаан**) хэрэглэдэг. Түүнийг **тайрдаг** хайрцаг (ScrollView эсвэл
  `overflow: hidden`) картан дээр наалдмал байвал ягаан гэрэлтэлт дугуй булангийн
  гадна **хатуу тэгш өнцөгт шаантаг** болж үлддэг.
- **Аудит хийсэн:** 43 `elevation.*` загвар · 50 `overflow: hidden` · 6 хэвтээ
  rail. **Ганц бодит тохиолдол** нь Home-ийн rail байсан (`rail` нь
  `paddingRight` л байсан, дээд/доод/зүүн тал нь 0).
- **Засвар:** `RAIL_SHADOW_PAD = 12` (сүүдрийн хүрээ: offset 2 + 1.5×radius 6 ≈ 11).
  ScrollView-д `marginVertical/-marginLeft`, contentContainer-т ижил хэмжээний
  padding → **байрлал хөдлөхгүй**, сүүдэрт зай гарна. Энэ нь `BuddySelector`-ын
  `SHADOW_PAD`-тай **яг ижил механизм** (тэнд аль хэдийн зассан байсан).
- ⚠️ **Дүрэм:** сүүдэртэй карт **хэвтээ ScrollView/FlatList**-д хийх бүрдээ
  contentContainer-т `paddingVertical ≥ 12` + эсрэг сөрөг margin өг. Тайрдаг
  хайрцаг картан дээр наалдмал байвал сүүдэр **үргэлж** дөрвөлжин тайрагдана.
- **Тайрагдаагүй нь** (шалгасан, хөндөөгүй): profile-ын `achRow` (цомын тэмдэг
  сүүдэргүй), notification-ы чипүүд, унших дэлгэцийн `vocabChip` (хоёулаа
  сүүдэргүй), soril-ын картууд (босоо урсгалд, gutter-тэй).

Шинэ i18n түлхүүр (mn+en): `lessonScreenTitle` · `streakCelebrationExtended` ·
`streakFreezeUsedNote` · `streakFreezeCoverNote`. `streakCelebrationOverline`
өөрчлөгдсөн («Дараалал үргэлжилж байна!» → «Өдрийн зорилго биеллээ 🎉»).

⚠️ **Boju АНХААР — хуваалцсан 3 component өргөтгөгдсөн, бүгд backwards-compatible:**
`AchievementModal` (`badgeValue`/`note`/`noteIcon`) · `RewardBurst` (`topOffset`)
· `DailyGoalCard` (`style`). Ямар ч prop дамжуулахгүй бол харагдац хуучнаараа.

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` 0 error (20 warning бүгд
өмнөх кодынх) · `expo export --platform android` bundle амжилттай ·
`main` (#208) merge хийсний ДАРАА дахин шалгасан.

#### ✅ Choi — Баяр хүргэх дэлгэц + 4 ээлжлэх дүр зураг (2026-08-04) · ДАВХАРДУУЛАХГҮЙ

**Юу вэ:** хичээл · сорил · ярих · сонсох · унших · бичих · өдрийн сорилт —
**юу ч дуусгасан** сурагч нэг ижил бүтэн дэлгэцийн баяр хүргэлт хүлээж авна.
Ард нь **4 өөр ертөнц ээлжилж** гарна. Файлууд: `src/components/celebration/`.

**Дэвсгэр нь Choi-н өгсөн бодит SparkXP key art** (`assets/celebration/*.webp`):

| # | Файл | Юу байгаа |
| --- | --- | --- |
| 1 | `kingdom.webp` | Титэмтэй үнэг цайзан дээр бамбартай, салют, ягаан шөнийн тэнгэр |
| 2 | `sky.webp` | Нил ягаан агаарын бөмбөлөг доторх үнэг, доор нь нуур/цайзтай хөндий |
| 3 | `mountain.webp` | Аялагч үнэг, цасан уулс, хүрхрээ, ой, тод хөх тэнгэр |
| 4 | `space.webp` | Сансрын үнэг сар дээр, пуужин, Санчир гараг |

- **PNG → WebP (q84): нийт 556KB** (эх PNG-үүд нь 10.3MB байсан). Зурагнууд
  780×1790, `contentFit="cover"` тул ямар ч утасны харьцаанд **тайрч** тохирно.
- ⚠️ **Эхэндээ би эдгээрийг вектороор ДАХИН ЗУРСАН** (SVG gradient-үүдээр).
  Choi «яагаад миний явуулсан зургийг ард нь хийхгүй байгаа юм» гэсэн тул
  бодит зураг руу шилжүүлэв. Вектор хувилбар нь `scratchpad/`-д нөөцлөгдсөн,
  кодоос **устгасан** (ашиглагдахгүй 800 мөр үлдээх нь CODING_RULES-ийн эсрэг).
  **Дахин бүү зур** — бодит art нь илүү сайн.

**⭐ Найруулга: UI нь ДООД талд.** Дөрвөн зурагт үнэг **голоороо** байгаа тул
төвд карт тавих нь харах ёстой цорын ганц зүйлийг халхална. Тиймээс
`CelebrationScreen` нь доороосоо өрөгдөж (`spacer: flex 1`), зураг дээд 2/3-ыг
эзэмшинэ — тоглоомын ялалтын дэлгэц шиг: **дүр дээрээ, шагнал доороо**.

**Уншигдац:** `Scrim` нь `SCRIM_START = 0.42`-оос эхэлж `SCRIM_FULL = 0.80`-д
дүүрнэ. Дөрвөн зурагт үнэгний **царай 27–50%** хооронд байдаг тул угаалга нь
**үргэлж түүний доор** эхэлнэ — баатар харанхуйлахгүй, бичиг уншигдана.
Хүч нь зураг тус бүрт өөр (`Scene.scrim`): уулын гэрэлтэй өдрийнх **0.95**,
сансрынх **0.84**.

**Ээлжлэх нь санамсаргүй БИШ, мөчлөг** (`useCelebrationScene`). 4 зурагтай үед
random нь ~25% магадлалаар дараалан давтагдана — нэг ертөнцийг 2 удаа дараалан
харах нь баяр хүргэлтийг лаазалсан мэт болгодог. AsyncStorage-д индекс
хадгална (`sparkxp.celebrationScene`).

**Хөдөлгөөн — хөдөлгөөнгүй зураг «ачаалж байна» гэж уншигддаг:**
- **Ken Burns** — 12 секундэд ~5% ойртоно. Хөдөлгөөн гэж мэдэгдэхгүй удаан, гэвч
  «баяр хүргэлт» ба «screenshot» хоёрын ялгаа нь тэр. Суурь scale нь 1-ээс их
  тул шилжилт хэзээ ч ирмэг ил гаргахгүй.
- **Гялалзалт 3 давхаргаар** — 40 SVG зангилаа тус бүрийг хөдөлгөхийн оронд 3
  `Animated.View` өөр өөр фазаар анивчина (UI thread 40 биш **3** transform
  хөтөлнө). Зөвхөн **дээд 46%**-д — доор нь бичиг эхэлнэ.
- **Санамсаргүй тоо seed-тэй** (`rng()` mulberry32); `Math.random()` ашиглавал
  дахин render бүрд гялалзалт үсэрнэ.
- **Reduce Motion** бүгдэд нь хүндэтгэгдэнэ.

**Дэлгэц (`CelebrationScreen`):** 32px булан · glassmorphism (BlurView +
тунгалаг дүүргэлт — BlurView дангаар нь бараан зураг дээр бараг харагдахгүй) ·
XP тоо spring-ээр орж амьсгалах халаатай · `CountUp` · confetti ·
`haptics.celebrate()`. Өнгөний өргөлт нь **зураг тус бүрийн `accent`**-аас.
- ⚠️ Хоёрдогч товч нь `<Button variant="ghost">` **биш**: тэр нь идэвхтэй
  сэдвийн ягаанаар будагддаг тул light theme дээр зураг дээр алга болно.

**Preview:** `/celebration-preview` — 4 дүр зургийг зэрэг харах + карт дээр дарж
бодит дэлгэцийг тэр ертөнц дээр үзэх. Screenshot авахад ашиглана.
**Хаанаас орох вэ: Тохиргоо → доод талын `DEV` хэсэг → «Celebration scenes».**
Тэр блок нь `__DEV__`-ээр хаалттай тул release bundle-д Metro бүтнээр нь хасна —
сурагч хэзээ ч харахгүй.

⚠️ **Тестгүй унших материал XP өгдөггүй** (тиймээс баяр хүргэлт хүрч ирэхгүй).
`markRead` нь **санаатайгаар** юу ч төлдөггүй — «ёроол хүртэл гүйлгэсэн» гэдгээр
XP тарааx товч аппад байх ёсгүй. Файлын дээд тайлбар нь «тестгүй материал
уншсанаар нь өгнө» гэж **буруу** бичсэн байсныг зассан (код тэгж хэзээ ч
ажиллаж байгаагүй). Унших дасгалыг бодитоор туршихын тулд **админаас тухайн
материалд асуулт нэмэх** хэрэгтэй.

**⭐ БҮХ дуусах мөчид холбогдсон (Choi: «бүх зүйлийн дараа гарч ирж байгаа юу?
тийм болгох ёстой шүү, тус бүрт нь тааруулж»).** 5 урсгал:

| Дэлгэц | Хэзээ | Статистик |
| --- | --- | --- |
| `app/lesson/[id].tsx` | `markDone()` — XP ирсний **дараа** | Тестийн тоо · Түвшин |
| `app/quiz/[id].tsx` | `submit()` — **зөвхөн тэнцсэн үед** | Зөв · Хувь · Цуваа (≥2 үед) |
| `app/reading/[id].tsx` | `award()` — тестээ давсан үед | Үг · Өгүүлбэр · XP |
| `app/swipe.tsx` | Багц дуусмагц | Мэдсэн · Давтах · Дараалал |
| `app/game/[mode].tsx` | `finish()` | Зөв · Очирхон |

- **Үг нь `celebration/copy.ts`-д ТӨВЛӨРСӨН** (`celebrationCopy(kind)`).
  ⚠️ **Дүрэм: шинэ дуусах урсгал нэмэх бүрд `CelebrationKind`-д case нэмнэ,
  дуудах газартаа гарчиг зохиохгүй.** Эс бөгөөс 5 дэлгэц 5 өөр хэмжээний ялалт
  тэмдэглэж эхэлнэ. `perfect: true` нь зөвхөн **гарчгийг** («Төгс!») солино —
  мөчийн хэмжээг хэзээ ч биш.
- **Ёслол нь хэзээ ч өөрчлөгддөггүй** — 20 минутын хичээл ч, 60 секундын
  давталт ч ижил дэлгэц, ижил анимац. Хөршөөсөө чимээгүй тэмдэглэдэг урсгалыг
  сурагч эхлээд хаядаг.
- **Унасан сорил баярладаггүй** — доорх үр дүнгийн дэлгэц нь алдааны зөв хариу.
- **Трофей/streak нь баяр хүргэлтийг ХААСНЫ дараа** гарна (`closeCelebration()`
  бүрт `checkCelebrations()`) — 2 modal дараалан гарах нь аль алиныг нь мууддаг.
- **Доорх агуулга алдагддаггүй:** quiz-ийн асуулт тус бүрийн задаргаа,
  swipe-ийн `ReviewStats`, тоглоомын оноо — бүгд хэвээр, баяр хүргэлт нь зүгээр
  л дээр нь тавигдаад хаагдахад ил гарна.
- XP-г **үргэлж сервер өгнө** (`xpAwarded`/`xpEarned`) — дахин үзэхэд 0 тул
  хуурамч тоо гарахгүй.

⚠️ **Boju АНХААР — `app/quiz/[id].tsx` ба `app/game/[mode].tsx` хөндөгдсөн**
(чиний бүс). Өөрчлөлт нь бага: celebration state + submit дотор 2 мөр + үр
дүнгийн дэлгэцийн төгсгөлд `<CelebrationScreen>`. Доорх логик, задаргаа
бүрэн хэвээр.

**Хичээлийн `RewardBurst` тууз ХАСАГДАВ** — бүтэн дэлгэцийн баяр хүргэлт
орлосон. (Өмнөх «тууз гацдаг» засвар үүнтэй хамт хэрэггүй болсон; `RewardBurst`
нь одоо зөвхөн quiz-ийн хариулт бүрийн гялалтад үлдсэн.)

**🐛 Давхардал зассан (Choi: «өмнөх EXCELLENT / тэнцлээ дэлгэц гарсаар байна,
энэ нь давтардал»).** Сорилын үр дүнгийн дэлгэц дээр цом, ГАЙХАЛТАЙ тэмдэг,
хувийн цагираг, оноо, статистик байсан нь **баяр хүргэлттэй яг давхцаж** байв —
«хариултаа харах» дарахад хоёр дахь, бүдэг ялалтын дэлгэц рүү буудаг байсан.
- **Тэнцсэн үед** тэр бүх hero + статистикийн эгнээ **хасагдав**. Доор нь
  зөвхөн баяр хүргэлтийн өгч чадахгүй зүйл үлдэнэ: **аль асуултыг буруу
  хийсэн** (chip-үүд + алдааны дэлгэрэнгүй карт).
- **Унасан үед** hero хэвээр — тэнд баяр хүргэлт гардаггүй тул оноо ба буцах
  зам хэрэгтэй.
- **IELTS band** нь hero дотор байсан тул хамт алга болох байсан — түүнийг
  **тусдаа карт** болгож хоёр замд аль алинд нь гаргав (баяр хүргэлтэд байхгүй
  цорын ганц тоо).
- **`gradeKey` (ГАЙХАЛТАЙ/МАШ САЙН/САЙН) устгаагүй — баяр хүргэлтийн ГАРЧИГ
  болов.** Сурагчийн хамгийн түрүүнд уншдаг мөр нь түүнийг дүгнэдэг мөр байх
  ёстой. 100% үед «Төгс!» давамгайлна.
- **Товчны дараалал эргэв:** үндсэн = **«Дуусгах»** (шууд гарна), хоёрдогч =
  «Хариултын задаргаа». Choi: «заавал finish дараад байх хэрэггүй». Сурагч
  сорил бодохоор ирсэн болохоос хоёр дахь үр дүнгийн дэлгэцээр алхахаар ирээгүй.

Шинэ i18n (mn+en): `celebrationEyebrowReading` · `celebrationTitle` ·
`celebrationSubtitle` · `celebrationStatWords` · `celebrationStatSentences` ·
`celebrationStatXp`.

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` 0 error ·
`expo export --platform android` bundle амжилттай.

#### ✅ Choi — Дасгалын төгсгөл: нэмэлт «Дуусгах» товч хасав + «Дэлгэрэнгүй» дэлгэц (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «дасгал хийж дуусаад celebration гарч ирээд, дэлгэрэнгүй гэж харахаар
дэлгэц нь сонин байна» + «сүүлийн дасгал дээр finish товч харагдаад байлгүй
шууд celebration гарах ёстой». Хоёулаа `app/quiz/[id].tsx`-д (дасгал бүр энэ
дэлгэцээр явдаг: `app/skill/[key].tsx` → `/quiz/:id`).

**1. Сүүлийн асуулт өөрөө дуусгадаг болов.** Өмнө нь сүүлийн хариулт зөв
гарсны дараа ногоон ✓ туузан доор дахиад **«Дуусгах»** товч хүлээж байдаг байв —
сурагчийн аль хэдийн харчихсан зүйлийг давтаж хэлдэг нэмэлт даралт.
- Одоо `queue.length === 1` дээр зөв хариулбал `FINISH_HOLD_MS = 700` мс ✓-г
  барьж үзүүлээд **өөрөө `submit()` дуудна** → шууд баяр хүргэлт.
- Шинэ `finishing` төлөв: тэр хугацаанд товч «Илгээж байна…» болж түгжинэ,
  прогресс бар **100% дүүрнэ** (`solved` дээр +1).
- ⚠️ **Зүрхний хаалт санаатай алгасагдсан** — сүүлийн асуултыг зөв хийсэн хүнийг
  зүрх дууссан гэж үр дүнгээс нь салгах нь шийтгэл болно.
- **Буруу хариулт хэвээр 2 даралттай** (тайлбар унших ёстой), 2 удаа андуурч
  хариулт нээгдсэн тохиолдолд ч гараар дарна — тэнд автоматаар үсрэх нь
  зөв хариултыг уншуулахгүй өнгөрөөнө.
- `submit()` алдвал `finishing` буцаж тайлагдана → товч дахин дарагдана
  (өгөгдөл алдагдахгүй).

**2. «Хариултын дэлгэрэнгүй» дэлгэц жинхэнэ дэлгэц болов.** Тэнцсэн үед
hero-г хассан (өмнөх багц) нь зөв байсан ч түүнээс үлдсэн нь **гарчиггүй,
толгойгүй, хамгийн дээрээ жижигхэн caption-оор эхэлдэг хуудас** байв — баяр
хүргэлтийг хаамагц гэнэт хоосон дэлгэц рүү буудаг тул «сонин» харагдаж байсан.
- **`TopBar` нэмэгдэв** (`title="Дүн"`, back, `showBadges={false}`) — гарчиг
  болон буцах зам гарлаа. (`app/game/[mode].tsx` аль хэдийн ийм байсан.)
- **Тэнцсэн үеийн `recap` карт** — 62px цагираг дотор хувь, хажууд нь оноо +
  XP/цуваа таблет. Нэг мөр. Баяр хүргэлт ёслолоо хийчихсэн тул энэ нь
  **сануулга** болохоос хоёр дахь ялалтын дэлгэц биш. Унасан үеийн том hero
  хэвээр (тэнд баяр хүргэлт гардаггүй).
- **Давхар confetti хасагдав** — `result.passed && !celebrating && <Confetti />`
  гэсэн мөр нь баяр хүргэлтийг хаамагц **дахин** цаас цацдаг байв, яг тэр
  уншихаар нээсэн дэлгэц дээр.
- **«Дуусгах» товч наалттай footer болов** — өмнө нь гүйлгэлтийн хамгийн ёроолд
  байсан тул алдаа олон гарсан үед гарах зам нь хэдэн дэлгэц доор байдаг байв.

Шалгасан: `tsc --noEmit` цэвэр.

#### ✅ Choi — «Хариултын дэлгэрэнгүй» дэлгэцийн дизайн шинэчлэл (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «хариултын дэлгэрэнгүй дэлгэц нэг л таалагдахгүй байна, сонин харагдаж
байна — илүү гоё дизайн болго. Эможийг больё, хямдхан харагдаж байна.»
Дээрх толгой/footer засвар (мөн 2026-08-05) хангалтгүй байсан тул дэлгэцийг
**бүтцээр нь** дахин зохиов. Файл: `app/quiz/[id].tsx` + `src/i18n/index.ts`.

**1. Хамгийн том асуудал: нэг зүйлийг ХОЁР удаа хэлдэг байсан.** Өмнө нь
«Хариултын дэлгэрэнгүй» (өнгөт chip-үүд ✓/✗) ба «Алдсан асуултууд» (тусдаа
карт) гэсэн хоёр блок байв — эхнийх нь юу ч сургадаггүй (улаан ✗-ээс сурах
зүйл алга), хоёр дахь нь мөн адил мэдээллийг дахин өгүүлдэг.
- Одоо **асуулт бүрд нэг мөр** бүхий ганц жагсаалт (`AnswerRow`): дугаар ·
  асуултын текст (2 мөр) · төлвийн дүрс. Буруу байсан бол мөр нь **нээгдэж**
  «Таны хариулт / Зөв хариу»-г үзүүлнэ.
- Мөрүүд **нэг картан дотор hairline-аар** тусгаарлагдана — 15 асуулттай сорил
  15 хөвөгч хайрцаг биш, нэг жагсаалт болж уншигдана.

**⭐ Гурван төлөв, хоёр биш.** Буруу хариулт дахин эргэж ирдэг тул асуулт нь
зөв · буруу · **эцэст нь зөв болсон** гэсэн 3 төлөвтэй. Гурав дахь нь энэ
дэлгэцийн гол утга учир — энгийн ногоон ✓ тавибал яг **дахин унших ёстой**
асуултыг нуична. Тиймээс:

| Төлөв | Өнгө | Дүрс | Нээгдэх үү |
| --- | --- | --- | --- |
| Шууд зөв | success | `checkmark-circle` | Үгүй — тайлбарлах зүйл алга |
| Эхэндээ андуурсан | streak (улбар шар) | `refresh-circle` | Тийм + «Эхэндээ андуурсан» шошго |
| Буруу | danger | `close-circle` | Тийм (`open_response` бол мөр дангаараа) |

**2. Оноон карт нэг болов (тэнцсэн ба унасан аль алинд).** Хоёр зам зөвхөн
өнгө болон гарчгаараа ялгаатай атал тус тусдаа layout-тай байсан нь тэнцсэн
үед hero-г хассаны дараа дэлгэцийг **дутуу баригдсан** мэт үлдээж байв.
- Одоо `ProgressRing` (116px, arc = хувь, өнгө = success/danger) дотор `CountUp`,
  доор нь дүн («ГАЙХАЛТАЙ!» / «Дахин оролдоно уу»), доор нь `Pill` эгнээ
  (оноо · +XP · ×комбо).
- **`Pill` компонентыг дахин ашиглав** (өөрийн pill style бичээгүй), `StatTile`
  + `tileStyles` устгагдав — CODING_RULES §DRY.
- Устгасан style: `heroShadow` `hero` `scoreRing` `ringScore` `statRow`
  `breakdownTitle` `chipWrap` `chip` `chipNum` `chipMark` `missCard` `missLine`
  `missLineBody` `noMistakes` `resultEmoji` `gradeBadge` (+ `LinearGradient`,
  `AwardBadge`, `Confetti`, `colors` import-ууд).

**3. Эможи хасагдав** (Choi: «хямдхан харагдаж байна»):
- `answerCorrect`: «Зөв! 🎉» → **«Зөв!»** (сорил бодож байх үеийн ✓ тууз).
- `resultNoMistakes`: «Нэг ч алдаагүй — гайхалтай! 🎉» → **«Нэг ч алдаагүй»**,
  бөгөөд одоо жагсаалтын **толгойн баруун талд** `shield-checkmark` дүрстэй
  жижиг мөр болж суусан (өмнө нь бүтэн өргөнтэй ногоон хайрцаг байв).
- ⚠️ Тэр мөр гарах нөхцөл нь `алдаа 0 && score === total` — зөвхөн `mistakes`-
  ээр шалгавал AI-аар шалгагддаггүй `open_response` буруу байхад ч «алдаагүй»
  гэж худлаа хэлнэ.

**Устгасан i18n түлхүүр:** `resultMistakesTitle` · `resultMistakesHint`
(тусдаа блок байхгүй болсон). **Шинэ:** `resultRetriedTag` (mn: «Эхэндээ
андуурсан» · en: «Missed at first»).

Шалгасан: `tsc --noEmit` цэвэр · `eslint app/quiz/[id].tsx src/i18n/index.ts`
0 error (үлдсэн 3 warning нь өмнөөс байсан `exhaustive-deps`).

#### ✅ Choi — Савлах эффект бүх аппаас хасагдав (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «хаана ч байсан апп дотор ингэж их савлаж байгаа эффектийг бүр мөсөн
хасаж, бүр маш бага хэмжээний л савлуул. Дасгал хийж байхад ч гэсэн аймар их
савалж байна. "Зөв хийсэн" гэж дээр нь гарч ирж байгаа message бас савлаад
байна.»

**Шалтгаан нь 2:**
1. Reanimated-ийн `FadeInDown` нь анхдагчаараа **25px** зам явдаг.
2. Түүн дээр `.springify()` нэмэгдэхэд spring нь тайван цэгээ **давж өнгөрөөд
   буцдаг** (overshoot) — тэр давалт нь «савлалт» болж мэдрэгддэг.

**⭐ Засвар нь нэг эх сурвалжтай: `src/lib/motion.ts`.**
- **`enter(delay?, duration?)`** — аппын **цорын ганц** орж ирэх анимац:
  `ENTER_SHIFT = 6px` зам + энгийн fade, **spring огт байхгүй** тул юу ч давж
  өнгөрөх боломжгүй. Дээшээ хувилбар нь `enterUp()` (toast гэх мэт).
- **`SPRING`-ийн damping 18 → 22.** Харьцаа нь `damping / (2·√(stiffness·mass))`
  = `22 / (2·√(180·0.6))` ≈ **1.06 (critical)**. Өмнө нь ≈0.87 байсан нь дарагдсан
  карт, `ProgressRing`, `CountUp`, `PressableScale` бүрийг байрандаа тогтохын
  өмнө нэг найгуулж байв. ⚠️ **Үүнийг бууруулбал савлалтыг бүх апп даяар
  буцааж авчирна.**
- **Дүрэм: шинэ дэлгэц дээр `FadeInDown` / `FadeInUp` / `.springify()`-г шууд
  бүү бич — `enter()`-ийг ашигла.** Тэгвэл хөдөлгөөний хэмжээг цаашид энэ нэг
  файлаас тохируулна.

**15 файл шилжсэн** (`entering=` бүхий бүх газар): `app/leaderboard.tsx` ·
`app/notifications.tsx` · `app/(tabs)/index.tsx` · `app/(tabs)/soril.tsx` ·
`app/quiz/[id].tsx` · `app/idiom/[id].tsx` · `app/level/[code].tsx` ·
`app/lesson/[id].tsx` · `BuddyChatSheet` · `RewardBurst` · `Toast` ·
`EditProfileModal` · `CelebrationScreen` · `CustomTabBar` · `DictionaryPanel`.
- **«Зөв!» тууз** (`RewardBurst`) — `springify().damping(13)` байсан, одоо
  `enter()`. Choi онцгойлон нэрлэсэн газар.
- `CustomTabBar`-ын `SlideInDown.springify()` ба `level/[code]`-ийн
  `ZoomIn.springify()` мөн spring-гүй болов (zoom-ийн overshoot нь бас савлалт).
- **Буруу хариултын хажуу тийш доргилт** (`app/quiz/[id].tsx`) нь дотооддоо
  ±12px, 7 алхам байсныг хуваалцсан `shake()` (**±8, 5 алхам**) руу шилжүүлэв —
  алдаа мэдрэгдэх ёстой болохоос асуултыг дэлгэцийн хөндлөн шидэх ёсгүй.
- **Хөндөөгүй:** `FadeIn` (зам явдаггүй тул савлахгүй), `ZoomIn.duration(...)`,
  `Confetti`, `Ken Burns`. `useReduceMotion()` хэвсэн газраа хэвээр.

⚠️ **Boju АНХААР — чиний бүсийн 6 файл хөндөгдсөн** (`leaderboard`,
`notifications`, `soril`, `idiom`, `level`, `BuddyChatSheet`): өөрчлөлт нь
**мөр тус бүрт нэг мөр** — `entering={FadeInDown...}` → `entering={enter(...)}`
+ import. Логик огт хөндөгдөөгүй.

#### ✅ Choi — Алдаагаа харах хэсэг бүх дүнгийн дэлгэцэд (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «сорилын хэсгийн бас төгсгөлд хийж дуусаад тус бүрт нь алдаагаа харж
болдог хэсгийг нь гаргаж өг, энэ нь их тус болно. Мөн сорил шиг иймэрхүү үр
дүн гардаг хэсгүүдэд нэмэх хэрэгтэй.»

**Шинэ хуваалцах компонент: `src/components/AnswerReview.tsx`.** Сорилын
дэлгэцэд байсан жагсаалтыг гаргаж авч, дүнгээр төгсдөг **бүх** урсгал ижил
«юуг буруу хийсэн бэ?» хэсэгтэй болов.
- API нь **аль хэдийн форматлагдсан мөр** авдаг (`given`, `correctAnswer`) —
  урсгал бүр хариултаа өөр өөрөөр хадгалдаг (хичээлийн сорил нь сонголтын
  индекс, үгийн тоглоом нь монгол мөр), тул форматлах ажил нь асуултын
  хэлбэрийг эзэмшигчийнх, байрлуулах нь компонентынх.
- `flawless` (алдаагүй тэмдэг) нь **дотроо тооцогдоно** — гаднаас буруу
  дамжуулах боломжгүй.

| Дэлгэц | Төлөв |
| --- | --- |
| `app/quiz/[id].tsx` (сорил · дасгал · IELTS) | ✅ шинэ компонент руу шилжсэн |
| `app/game/[mode].tsx` (Үг ангууч · Хурдан бууд · Сонсож барь) | ✅ UI бэлэн — **BE талбар хүлээж байна** (доор) |
| `ReadingQuiz` (унших материалын асуулт) | ✅ **аль хэдийн** байсан — хариултаа явуулмагц сонголт бүр ногоон/улаан болж, зөв хариу нь гарч ирдэг. Дээр нь бас жагсаалт нэмбэл яг тэр давхардал болно. |
| `MatchGame` (Холбож ял) | ❌ хамаарахгүй — асуулт биш, хос холбох механик |

**Тоглоомын дэлгэц: дүнгийн хэсэг ScrollView болов** (өмнө нь голлуулсан нэг
блок байсан) — оноо одоо 10 мөрт тоймын **толгой** болж суув.

✅ **BE хүсэлт шийдсэн (2026-08-06): `POST /words/quiz/submit` хариунд `results` орно.**
XP/Sparks логик өөрчлөгдөөгүй, зөвхөн per-answer тойм нэмэгдсэн:
  ```ts
  results: { wordId: string; correct: boolean; correctAnswer: string }[]
  ```
  `correctAnswer` = `word.mongolian`.
- **Апп талд бэлэн:** `src/api/wordQuiz.ts`-ийн `QuizResult.results` нь
  **optional**, `AnswerReview` нь хоосон жагсаалтад юу ч зурдаггүй. Тиймээс
  одоогийн backend дээр апп **унахгүй**, зүгээр л тоймыг харуулахгүй — талбар
  ирмэгц ямар ч апп шинэчлэлгүйгээр өөрөө гарч ирнэ.

Шинэ i18n (mn+en): `gameNoAnswer` («Хариулаагүй» — хурдны горимд цаг дуусахад).

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` **0 error**.

#### ✅ Choi — Streak баяр хүргэлтийн дизайн + эможи бүхэлд нь хасагдав (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «streak сунгагдаж байгаа message-ний дизайн сонин байна. MN дээрээ "гоё"
гэдэг үг ашиглахгүй шүү дээ. Тэр эможи ашиглахгүй, маш cheap харагдаад байна.
Апп-д ерөнхийдөө иймэрхүү сонин эможи ашиглахгүй. Мөн icon нь streak-даа
ашиглаж байгаа icon-оо ашигла, assets дотор байгаа.»

**1. Дүрс — брэндийн галын дүрс болов.** `AchievementModal` нь Ionicons-ийн
хавтгай `flame` глиф зурдаг байсныг **`assets/icons/flame.png`** (аппын streak
badge хаа сайгүй ашигладаг 3D дүрс) руу шилжүүлэв.
- `Achievement`-д шинэ **`appIcon?: AppIconName`** талбар нэмэгдэв. `imageUrl`
  (цомын жинхэнэ зураг) > `appIcon` > `icon` (Ionicons, сүүлчийн нөөц).
- Цом мөн `appIcon: 'trophy'` (алтан цом) авав — зураг нь хараахан
  байршуулаагүй цом ч баяр хүргэлтэд зохимжтой харагдана.
- ⚠️ **64pt-оос том бүү зур** — эх PNG-үүд ~200px өргөнтэй (`appIcons.ts`).

**2. Дизайн.** Өмнө нь 110px дугуй дотор жижигрүүлсэн дүрс **ба** том тоо хоёул
багтахыг оролдож, badge хоёр ажлыг муу гүйцэтгэж байв.
- Одоо **badge нь дүрсээ л барина**, тоо нь доор өөрийн мөрөнд **52pt**-оор
  гарна, доор нь «өдрийн дараалал» шошго.
- Badge-ийн ард **өөрийнх нь өнгөний зөөлөн туяа** (152px, 12%) нэмэгдэв —
  ганц хавтгай дугуй наалт шиг харагддаг байсныг гэрэлтсэн болгов.
- Картын урсгал: **юу болсон** (overline) → **хэдэн өдөр** (том тоо) → **юу
  өгсөн** (+XP) → **маргааш юу хамгаалах вэ** (мөстөлтийн чип).

**3. Үг.**
- **«Гоё!» товч устав** — баяр хүргэлтийн товч одоо аппын бусад газартай нэг
  адил **«Үргэлжлүүлэх»** (`continue` түлхүүр аль хэдийн байсан тул `nice`
  түлхүүрийг бүрмөсөн хассан).
- **«Дараалал сунгагдлаа!» мөр хасагдав** — «Өдрийн зорилго биеллээ» дээр том
  «12 өдрийн дараалал» бичигдэж байхад гурав дахин давтах хэрэггүй.
  (`streakCelebrationExtended`, `streakCelebrationTitle` устсан; шинэ
  `streakCelebrationDays`.)

**4. 🐛 Гэрэл сэдвийн өнгөний алдаа зассан (дашрамд олдсон).**
`useCelebrations` нь `tints`-ийг **статикаар** (dark багц) уншдаг байсан тул
light сэдэв дээр цайвар улбар шар бичгийг цагаан картан дээр буулгаж,
уншигдахгүй болгож байв. Одоо `tintThemes[useSettings().theme]`.

**5. ⭐ Эможи бүх аппаас хасагдав** (Choi: «ерөнхийдөө»).
- **`src/i18n/index.ts`-д 70 мөр** (mn+en) цэвэрлэгдэв: 🎉 👋 🔥 💪 😅 🔒 🦊 ✨
  💡 ✓ ⭐ 💎. Одоо i18n-д UI текст дотор **эможи бүрэн алга**.
- **Утга агуулж байсан 2 тохиолдлыг үг болгов** (зүгээр хасвал өгүүлбэр
  ойлгомжгүй болно):
  - `⭐` = хадгалах товч → «картан дээрх **од товчийг** дарж хадгална».
  - `💎` = Очирхон валют → шинэ **`sparksUnit`** түлхүүр («Очирхон» / «Sparks»).
    Alert-ийн текст, товчны шошгонд дүрс байрлуулах зай байдаггүй.
- **Дэлгэц дэх hardcode эможи:** Home-ийн мэндчилгээний 👋 хасав;
  swipe-ийн `✓ / ✕ / ♥` тамганууд **Ionicons** болов (мөр болгож `stamp`-д
  `flexDirection: 'row'`); хичээлийн түгжээний `💎` → `sparksUnit`;
  Premium картуудын `👑`/`💎` → брэндийн `AppIcon` (`gem` / `sparks`).
- **Устсан үхмэл түлхүүр:** `comboLabel`, `lessonCompleteSuffix` (дуудагддаггүй
  байсан), `nice`, `streakCelebrationTitle`, `streakCelebrationExtended`.

⚠️ **Boju — 2 газарт эможи САНААТАЙГААР үлдээв, чиний шийдэх зүйл:**
1. `app/level/[code].tsx` — түвшний арлуудын `🌿 🏡 🏰 ⛰️ 🪐`. Эдгээр нь
   чимэглэл биш, **газрын зургийн бүтэц** — солих бол таван арлын зураг
   зурах хэрэгтэй (`assets/icons`-д тохирох дүрс алга).
2. `src/constants/mockBuddies.ts` + `BuddySelector` — buddy-нуудын `🦊 👩‍⚕️
   👨‍🚒 👩‍🏫`. Эдгээр нь дүрийн **аватар**; жинхэнэ buddy зураг ирэхээр
   солигдоно (AI Buddy Part 4 — Meshy 3D).

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` **0 error**.

#### ✅ Choi — Duolingo маягийн шууд залруулга (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «яг Duolingo шиг — шууд зөв байвал зөв гээд, буруу байвал зөв нь шууд
харагдахаар болго.» Файл: `app/quiz/[id].tsx` (сорил · дасгал · IELTS).

**Өмнө:** буруу хариулахад «Буруу хариулт» + «Дахин оролдоорой» гэсэн сануулга
л гардаг байв. Зөв хариу нь **2 удаа андуурсны дараа** л ил болно
(`REVEAL_AFTER_TRIES`). Тэгэхээр сурагч алдаагаа хамгийн сайн ойлгох боломжтой
яг тэр агшинд юу ч сурахгүй өнгөрч байсан.

**Одоо:** буруу хариулмагц **зөв хариу тэр дороо** гарна.
- **Сонголтот асуулт** — зөв хувилбар ногооноор асна, сонгосон буруу нь улаанаар
  хажууд нь үлдэнэ. Тэр хоёрын зэрэгцээ байдал нь өөрөө хичээл.
- **Бүх төрөлд туузан дотор «Зөв хариу: …» мөр** нэмэгдэв. `formatAnswer`-ийг
  ашигласан тул сонголтын индекс «B. london» болж, `word_match` нь
  «left → right» мөрүүд болно — **үг холбох асуултын зөв хариу урьд нь хаана ч
  харагддаггүй байсан**.
- **Товч үргэлж «Үргэлжлүүлэх»** («Дахин оролдох» гэдэг нь хуучин урсгалынх).

> ⚠️ **Энэ хэсгийн 2 зүйлийг мөн өдөр нь дараагийн багц ДАРЖ БИЧСЭН**
> (доорх «Зөв болтол дахин хийнэ» хэсгийг үз): (1) туузан дахь «Зөв хариу: …»
> мөр нь одоо **зөвхөн бичих төрөлд** үлдсэн, (2) `DROP_AFTER_TRIES` хязгаар
> **устсан**.

**⭐ Дасгал дахин ирэх нь ХЭВЭЭР — гэхдээ дараалалынхаа АРД.** Зөв хариуг
харуулчихаад тэр асуултыг **шууд** дахин асуувал ногоон мөрийг хуулж бичих л
дасгал болно. Харин бүхэл нэг эргэлтийн дараа ирэхэд тэр нь дахин **санах ойн
шалгалт** болно — Duolingo яг ингэдэг. `DROP_AFTER_TRIES = 2` нь зөвхөн хязгаар:
хэн ч нэг асуулт дээр мөнхөд гацахгүй.
- ⚠️ Тиймээс `wrongTries` нь **зөвхөн гацахаас хамгаалах** үүрэгтэй болов
  (өмнө нь зөв хариу хэзээ ил болохыг ч шийддэг байсан).
- Зүрх хэвээр: буруу хариулт 1 зүрх авна.
- Дүнгийн дэлгэцийн «эхэндээ андуурсан» тэмдэглэгээ хэвээр — `mistakes` нь
  **эхний** алдааг хадгалдаг тул хуулж бичсэн 2 дахь оролдлого дүрийг өөрчлөхгүй.

**Устсан i18n:** `tryAgainHint` («Дахин оролдоорой»), `retryAnswer` («Дахин
оролдох») — хоёул хуучин урсгалынх.

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` **0 error**.

#### ✅ Choi — «Зөв болтол дахин хийнэ» + өнгөөр залруулах (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «доор нь хачин илүү тэр "буруу хариулт / зөв хариу A:1" гэх мэт
харуулахаа болий, сонин байна — хүмүүс улаан ногоон өнгөөр нь таньдаг болгий.
Мөн буруу бол үргэлжлүүлээд дараа нь зөв болтол хийдэг болго. Яг л Duolingo-гийн
систем шиг, яг л зөв логиктой болго.»

**1. Залруулга нь ӨНГӨ, текст биш.**
| Төрөл | Хэрхэн залрах вэ |
| --- | --- |
| Сонголт | Зөв нь ногоон, сонгосон буруу нь улаан. **Текст мөр байхгүй.** |
| Үг холбох | `WordMatchBoard`-д шинэ **`graded`** prop: мөр бүр ногоон/улаан болж, буруу мөрийн дугаар ✕ болно. Дүгнэгдмэгц самбар **түгжигдэнэ**. |
| Бичих | Талбар улаан болно **+ зөв үг энгийнээр** гарна — улаан хүрээ нь ямар үг байсныг хэлж чадахгүй тул энэ ганц газарт текст үлдэв. |

**2. Зөв болтол дахин ирнэ.** `DROP_AFTER_TRIES` хязгаар устав — асуулт
буруу л бол дарааллын **ард** орж, зөв хариулах хүртэл эргэж ирнэ. Буруу
хариултаа үлдээгээд сорилыг дуусгах боломжгүй.
- **Мөнхийн давталт болохгүй** — буруу хариулт 1 зүрх авдаг, зүрх дуусахад
  `proceed()` нь HeartsSheet гаргаж гарцыг өгнө. Яг Duolingo-гийн зогсоох нөхцөл.
- `wrongTries` state **бүрмөсөн устав** (зөвхөн хязгаарт хэрэглэгддэг байсан).
- Прогресс бар буруу хариулт дээр урагшлахаа болино (queue богиносоогүй тул) —
  зөв зан төлөв.

**3. ⭐ Оноог ЭХНИЙ оролдлогоор дүгнэнэ** (Choi сонгосон).
- **Яагаад заавал:** асуулт зөв болтол дахин ирдэг тул **сүүлийн** хариулт
  үргэлж зөв. Тэгвэл `/submit` бүх сорилыг **100%** гэж дүгнэж, оноон карт,
  дүн, «тэнцсэн» гэсэн ойлголт бүхэлдээ утгагүй болно.
- `answersWithCurrent()` одоо тухайн асуултын **хамгийн эхний** хариултыг
  хадгална (өмнө нь сүүлийнхээр дардаг байсан). Сервер талд өөрчлөлт хэрэггүй.
- Тэнцэх босго **50%** (`quizzes.service.ts`) тул эхний хараагаараа тэн
  хагасаас илүүг нь алдаж байж л унана.

**4. Дүнгийн жагсаалт 3 төлөвөөс 2 болов.** «Эхэндээ андуурсан» (улбар шар)
төлөв нь эхний-оролдлогын дүгнэлттэй хамт **боломжгүй** болов: эхний хариулт
буруу бол мөр нь улаанаар дүгнэгдэнэ, зөв бол алдаа бүртгэгдээгүй байна.
Хүрэшгүй салаа кодыг үлдээхгүйн тулд `AnswerReviewItem.retried`,
`resultRetriedTag` устав. (Улаан мөр бүр нь одоо «эцэст нь зассан ч эхэндээ
мэдээгүй» гэсэн утгатай — тэр нь бүх улаан мөрийн шинж болсон тул тусад нь
тэмдэглэх шаардлагагүй.)

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` **0 error**.

#### ✅ Choi — Дүгнэлтийн тууз хасагдав + дуусгасан бүр баярлана (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «доор нь "зөв / буруу" гэж бичээр харагдуулахаа болъё, маш сонин байна,
онцгүй харагдаж байна. Мөн яагаад celebration screen-ийг харуулахыг болиулчваа?
Дахиад л өмнөх шигээ "0/5 зөв" гэх мэт сонин screen нь харагдаж байна.»

**1. Дүгнэлтийн тууз (`fbBanner`) БҮРМӨСӨН хасагдав.** Хариултын талбар өөрөө
ногоон/улаан болдог тул доор нь «Зөв!» / «Буруу хариулт» гэж бичих нь давхардал
байв.
- Сонголт бүр мөрөндөө ✓/✕ дүрстэй болсон нь хэвээр.
- **Бичих (fill_blank) талбарт өнгө байхгүй байсныг нэмэв** — тууз л түүний
  цорын ганц дохио байсан. Одоо талбар ногоон/улаан болж, буруу үед зөв үг
  доор нь ногоонoор гарна (өнгө ямар үг байсныг хэлж чадахгүй цорын ганц газар).
- Устсан i18n: `answerCorrect` · `answerWrong` · `correctComboInline` ·
  `correctAnswerLabel`. Цуваа (combo) нь дээд талын `RewardBurst`-д хэвээр.

**2. 🐛 Celebration яагаад алга болов — ШАЛТГААН.** Өмнөх багц оноог **эхний
оролдлогоор** дүгнэдэг болгосон. Гэтэл celebration нь `res.passed`-аар
(≥50%) хаалттай байв. Тэгэхээр:
> Сурагч бүх асуултаа зөв болтол хийж дуусгасан ч, эхний хараагаараа тэн
> хагасаас илүүг нь алдсан бол **«унасан» дэлгэц** дээр буугаад баяр хүргэлт
> огт гардаггүй байв. «0/5 зөв» гэдэг нь яг энэ — туршиж үзэхдээ санаатай
> буруу хариулаад дараа нь бүгдийг зассан тохиолдол.

**⭐ Засвар: дуусгасан бүр баярлана.** Буруу хариулт үлдээгээд сорилыг дуусгах
**боломжгүй** (асуулт зөв болтол эргэж ирдэг) тул **төгсгөлд хүрсэн нь өөрөө
амжилт**. `res.passed` хаалт хасагдав; `markExerciseCompleted` /
`markDailyTask` мөн адил дуусгамагц ажиллана.
- Үр дүнгийн дэлгэцээс **«унасан» гэсэн ойлголт бүрмөсөн арилав**
  (`quizTryAgain` устав). Оноо нь **дүгнэлт биш, мэдээлэл** болов.
- **Дүнгийн 4 дэх шат нэмэгдэв:** <50% үед «САЙН!» гэж худлаа магтахын оронд
  шинэ **`gradeDone` («ДУУСГАЛАА!»)**. Картан дээр «Эхний оролдлогоор»
  (`resultAccuracyNote`) гэсэн тайлбар мөр нэмэгдэж, тоо юуг хэмждэгийг хэлнэ.
- Цагирагийн өнгө 3 бүстэй болов: ≥75% ногоон · ≥50% улбар шар · <50% улаан
  (унасан гэсэн үг биш, анхаарал татсан утгатай).
- **Алдааны haptic хасагдав** — баяр хүргэлт тоглож байхад доор нь «буруу» гэж
  чичрэх нь өөрөө өөрийгөө үгүйсгэж байв.

⚠️ **Санаатайгаар ХЭВЭЭР:** оноо/XP/IELTS band нь **эхний оролдлогоор** тооцогдоно
(сервер рүү эхний хариулт илгээгдэнэ). Хэрэв сүүлийн (зөв) хариултыг илгээвэл
бүх сорил 100% болж, **IELTS band үргэлж 9.0** гарах тул тэгэх боломжгүй.
Үүний үр дүнд эхний хараагаараа бүгдийг алдвал **XP = 0** (сервер XP-г оноотой
пропорциональ өгдөг). Хэрэв «дуусгасан бол хамгийн багадаа тодорхой XP өгөх»
хэрэгтэй бол энэ нь **Өсөхбаярын BE өөрчлөлт** — хэлээрэй, хүсэлт бичье.

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` **0 error**.

#### ✅ Choi — Дээд талын «Яг зөв!» карт устгагдав (2026-08-05) · ДАВХАРДУУЛАХГҮЙ

Choi: «дасгал хийхээр дээр нь гарч ирж байгаа "зөв байна" гэдэг дээшээгээ
наалдчихаад байна. Үүнийг огт байхгүй болго. Ямар ч хэрэггүй зүйл.»

**`RewardBurst` бүхэлдээ устав.** Зөв хариулах бүрд дэлгэцийн дээд талд
«Яг зөв! / Дараалж зөв! / Галтай байна!» гэсэн ягаан карт confetti-тэйгээ
гарч, асуултын дээр наалддаг байв. Сорил дээр хариулт нь **аль хэдийн ногоон
болдог** тул энэ нь гурав дахь удаагаа ижил зүйлийг хэлж байсан хэрэг.
- `app/quiz/[id].tsx`-ээс `rewardFlash` state · `RewardFlash` төрөл ·
  `rewardTimer` + цэвэрлэгээ · `praiseKey()` · render блок бүгд хасагдав.
- `src/components/RewardBurst.tsx` **файл устгагдсан** (өөр хаана ч
  ашиглагддаггүй байсан).
- Устсан i18n: `correctPraise1/2/3/5` · `correctInstantToast` ·
  `correctComboToast`.

**⭐ Мэдрэмж ХЭВЭЭР үлдсэн:** зөв хариулт бүр `haptics.combo(n)` +
`sound.correct()` дуудна, дараалал уртсах тусам чичиргээ хүчтэй болно.
Choi зөвхөн **нүдэнд харагдах** эмх замбараагүй байдлыг хассан — мэдрэхүйн
шагнал биш. Цуваа (комбо) нь дүнгийн дэлгэцийн «Цуваа» pill дээр хэвээр
(тэндээ дүгнэгдсэн хариултаас дахин тооцогддог).

Шалгасан: `tsc --noEmit` цэвэр · `eslint app src` **0 error**.

#### ✅ Choi — Админ «AI-аар үүсгэх»: Дасгал · Сорил · IELTS (2026-08-08) · ДАВХАРДУУЛАХГҮЙ

> ⚠️ **Энэ бол `/backend` + `/admin` доторх ажил — эзэмшигч нь Өсөхбаяр.**
> Choi барьсан тул **merge хийхээсээ өмнө Өсөхбаяртай тохирно уу.** Хөндсөн файл:
> `backend/src/quizzes/*` · `admin/src/components/AiBulkGenerator.tsx` ·
> `admin/src/pages/{exercises,quizzes,ielts}` · `API.md §6`.

Админ Excel/CSV бэлдэлгүйгээр **зүгээр л агуулгаа бичихэд** AI асуулт үүсгэдэг
болов. Гурван хуудсанд (Дасгал · Сорил · IELTS) «✨ AI-аар үүсгэх» товч нэмэгдэв.

**Гол шийдэл — гурвуулаа НЭГ `Quiz` entity.** Дасгал (`lessonId: null` +
`category` = ур чадвар), Сорил (`quizType` = тоглоом), IELTS (`category` =
`ielts_*`) гурав ялгаатай хуудас ч ижил хүснэгт дээр сууна. Тиймээс **1 endpoint
+ 1 дундын компонент** гурвуулангийнх (CODING_RULES §0.2 DRY) — хуудас бүр
өөрийн ялгааг `AiTarget`-аар л дамжуулна.

**Урсгал: preview-first.** AI шууд DB рүү бичихгүй —
`POST /quizzes/ai-generate` нь **хадгалагдаагүй ноорог** буцаана → админ
`QuizQuestionsEditor` дотор хараад засна → `POST /quizzes`-ээр **ноорог**
(`isPublished: false`) болж хадгалагдана. Буруу хариулт сурагч руу хүрэхгүй.

**Автомат чанарын шалгуур** (`backend/src/quizzes/ai-generate.ts`) — AI-д
итгэхгүй. Засаж болохгүй асуултыг хасаад, бүгдийг `warnings`-д тайлбарлана:
индекс мужаас гарсан зөв хариу · давхардсан сонголт · 4-өөс өөр тооны сонголт ·
`___` цоорхойгүй `fill_blank` · хоосон хариулт · давхардсан асуулт · танихгүй төрөл.

**Нэмэлт:** түвшин/төрөл/тоог орхивол **AI өөрөө таамаглана**; үүсгэсэн
асуултуудыг 1–4 тусдаа дасгал болгож **хуваах**; IELTS Reading-д эх бичвэрээ
өгөх эсвэл AI-аар зохиолгох.

**⚠️ Gemini 2.5-flash-ийн хоёр хавх — засагдсан (үүнийг мэдэж байх нь чухал).**
Эхний ажиллуулалт **235 секунд** аваад `"AI-гийн хариуг уншиж чадсангүй (JSON биш)"`
гэж унасан. Түлхүүр, сүлжээ, эрхтэй огт холбоогүй байв:

1. **Thinking гаралт руугаа асгарч байсан.** `gemini-2.5-flash` дээр thinking
   анхдагчаар **асаалттай**; JSON горимд бодлоо талбар дотор бичээд ```` ```json ````
   гэж дахин эхлүүлж, JSON-ыг эвдэж байв (5 асуултад **19,550 токен**).
   → `runGeminiText`-д `thinkingBudget` сонголт нэмж, quiz үүсгэхэд **`0`** (унтраасан).
2. **Схем хэт сул байсан.** Асуултын 4 төрөл өөр талбартай тул `required` нь
   зөвхөн `type` байсан — загварт "асуулт дуусав" гэсэн зогсох дохио байхгүй.
   Thinking унтраасны дараа ч нэг `question` string дотор **давталтын гогцоонд**
   орж 18,071 тэмдэгт бичив. → `buildSchema()` нь одоо **төрөл тус бүрийн чанга
   схем** (яг тэр төрлийн талбарууд бүгд `required` + `maxLength`/`minItems`).
   `maxLength` нь хэмжээ хязгаарлахаас илүү **зогсох дохио** болж өгдөг.
3. Төрлийг админ заагаагүй ("AI өөрөө сонго") үед схемийг чангатгах боломжгүй
   тул **эхлээд аль формат тохирохыг л асуух жижиг дуудлага** нэмэгдэв
   (`buildTypePrompt` / `TYPE_PICK_SCHEMA`, ~50 токен). Бүтэлгүйтвэл
   `multiple_choice` руу буцна — жижиг алхмаас болж онцлог унахгүй.
4. `maxOutputTokens` (`maxTokensFor()`) + `finishReason: MAX_TOKENS` илрүүлэлт
   нэмэгдэв — таслагдсан хариу одоо "JSON биш" гэж ойлгомжгүй унахгүй,
   шалтгаанаа хэлнэ. Temperature 0.7 → **0.4**.

**Үр дүн: 235с → 3–6с**, анхааруулга 0.

⚠️ `gemini-text.ts` нь **толь бичиг** ч ашигладаг тул шинэ 3 сонголт
(`thinkingBudget` · `maxOutputTokens`) **бүгд сонголттой** — өгөөгүй үед зан
төлөв нь яг урьдын хэвээр, толины ажиллагаа хөндөгдөөгүй.

**Бодит AI-гаар тестлэгдсэн** (Choi-гийн локал, билинг идэвхтэй түлхүүр):

| Тест | Хугацаа | Үр дүн |
| --- | --- | --- |
| `multiple_choice` 5 асуулт | 3с | ✅ 0 анхааруулга |
| `word_match` 4 асуулт | 4с | ✅ англи↔монгол хос зөв |
| `open_response` (IELTS Writing) | 5с | ✅ |
| AUTO — "ярианы сонсгол" | 4с | ✅ → `multiple_choice` |
| AUTO — "үгийн сан" | 6с | ✅ → `word_match` |
| AUTO — 20 асуулт (дээд хязгаар) | 6с | ✅ → `fill_blank` |

Мөн: backend `tsc --noEmit` цэвэр · admin `tsc -b --force --noEmit` цэвэр ·
`eslint` 0 error · задлагчийн шалгуурыг санаатай эвдэрсэн 8 асуулттай хуурамч
AI хариугаар турших — 4 муу нь зөв хасагдав.

⛔ **Дараагийн хүн шалгах зүйл:** админы UI-аар (`localhost:5173`) дамжуулан
end-to-end хараахан дарж үзээгүй — endpoint-ыг шууд `curl`-ээр л тестэлсэн.
Мөн prod дээр `GEMINI_API_KEY` байгаа эсэхийг Railway-гээс баталгаажуулна.

#### ✅ Choi — Админ: «Ноорог» төлөв хасагдав + AI явц/алдаа (2026-08-10) · ДАВХАРДУУЛАХГҮЙ

> ⚠️ **Энэ бол `/admin` доторх ажил — эзэмшигч нь Өсөхбаяр.** Choi барьсан тул
> **merge хийхээсээ өмнө Өсөхбаяртай тохирно уу.** Backend хөндөөгүй, migration
> шаардахгүй. Хөндсөн файл: `admin/src/components/{Publish,ErrorBox,JobProgress,
> AiBulkGenerator}.tsx` · `admin/src/lib/errors.ts` · `admin/src/pages/
> {exercises,quizzes,ielts,lessons,reading,idioms,words}`.

**1. «Ноорог» гэсэн төлөв админаас бүрмөсөн хасагдав — Хадгалах = шууд нийтлэх.**
Форм бүрийн «Шууд нийтлэх» checkbox устсан; хадгалах/импортлох/AI-аар үүсгэх
гурвуулан `isPublished: true` бичнэ (Хичээл · Дасгал · Сорил · IELTS · Унших ·
Хэлц · хичээлийн тест). Энэ нь 2026-08-08/09-нд хуудас бүр дээр тус тусад нь
зассан "ноорог-анхдагч" алдааны **үндсийг нь тасалж байгаа хэрэг** — цаашид
шинэ форм нэмэхэд дахин давтагдахгүй.
- Үлдсэн цорын ганц төлөв нь **нуух** (`Аппаас нуух` / мөрийн 👁 товч) —
  нийтлэгдсэн контентыг устгалгүйгээр аппаас түр авах. Нэр нь «Ноорог» биш
  **«Нуугдсан»**, учир нь энэ нь "хараахан бэлэн биш" биш, "зориуд авсан" гэсэн утга.
- ⚠️ **Хуучин ноорог мөрүүд DB-д хэвээр.** Хуудас бүрийн дээр шар анхааруулга
  гарч, **«Бүгдийг нийтлэх»** нэг товчоор засна (`UnpublishedBanner`). Хичээл ·
  Унших · Хэлц гурав нь сервер талаас хуудаслагддаг тул тоо нь **тухайн хуудсынх**
  — хэдэн хуудас байвал тэр бүрд дарна.
- Үгсийн хуудсанд `status` нь AI-ийн хяналтын урсгал (`needs_review`) тул хэвээр;
  зөвхөн **формын** сонголтоос `📝 Ноорог`-ыг хасав (шүүлтүүрт хуучин ноорог
  үгсээ олохын тулд үлдээсэн).
- Дундын хэсгүүд: `components/Publish.tsx` (`HiddenBadge` · `VisibilityButton` ·
  `UnpublishedBanner`) — жагсаалтын «Төлөв» багана бүр устаж, тэр логик нэг
  газраас ирнэ.

**2. Импортын цонхонд «✨ AI-аар үүсгэх» товч.** Дасгал ба Сорилын CSV/JSON
импорт дээр буулгасан текстээ **тэр чигт нь AI руу дамжуулах** товч нэмэгдэв
(`AiBulkGenerator`-ийн шинэ `initialBrief`). Формат нь таарахгүй (баганын дараалал
буруу, зүгээр л жагсаалт) үед админ гараар засахын оронд AI-д өгөөд асуулт,
хариулт, оноог нь бөглүүлнэ. Импортолсон контент мөн шууд нийтлэгдэнэ.

**3. AI үүсгэх явц + алдааны мэдэгдэл.**
- Явцын зураас + хувь + шат (`Агуулгыг уншиж байна… → Асуулт зохиож байна… →
  Чанарыг шалгаж байна…`). `POST /quizzes/ai-generate` нь нэг удаагийн хүсэлт тул
  явц нь **хугацаанд суурилсан ойролцоо** тооцоо (95%-д хүрээд хариу хүлээж
  зогсоно) — товчин дээр ч `AI үүсгэж байна… 42%` гэж гарна. Хэдэн секунд болохыг
  урьдчилж хэлнэ (`6 + асуулт×1.5` сек).
- Хадгалахдаа 2–4 хэсэг болгож хуваасан бол **жинхэнэ** явц (`2/3 хэсэг`).
- Алдаа: `lib/errors.ts` → `friendlyError()` нь `HTTP 429` гэх мэт түүхий
  бичгийг «AI-ийн хязгаарт хүрлээ. 1 минут хүлээгээд дахин оролдоно уу» болгож
  хөрвүүлнэ (429 · timeout · сүлжээ · API түлхүүр · 5xx · 401). Шинэ `ErrorBox`
  нь дүрс + **«Дахин оролдох»** товчтой, улаан хайрцгаар харагдана.
- Үгс/Хэлц хуудасны background ажлын самбар (2 газар хуулбарласан ~40 мөр JSX)
  → дундын **`JobProgress`** болов. Алдаатай мөр бүр «N амжилтгүй — дэлгэрэнгүй»
  дотор шалтгаанаараа задарна.

⚠️ Дээрх 2026-08-08-ны бичлэгт «`POST /quizzes`-ээр **ноорог** болж хадгалагдана»
гэсэн мөр **хүчингүй болсон** — одоо шууд нийтлэгдэнэ (preview дээр асуулт бүрийг
хараад засчихсан байдаг тул ноорог хадгалах шалтгаан үлдсэнгүй).

⛔ **Шалгаагүй зүйл:** `tsc --noEmit` цэвэр, `npm run build` цэвэр — гэхдээ
браузераар (`localhost:5173`) дарж үзээгүй. Ялангуяа «Бүгдийг нийтлэх» баннер ба
импорт→AI шилжилтийг нэг удаа гараар шалгаж өгнө үү.

#### ✅ Choi — Админ «Бүх төрлөөр үүсгэх» (2026-08-10) · ДАВХАРДУУЛАХГҮЙ

> ⚠️ **`/backend` + `/admin` доторх ажил — эзэмшигч нь Өсөхбаяр.** Choi барьсан
> тул **merge-ийн өмнө Өсөхбаяртай тохирно уу.** Migration шаардахгүй (шинэ
> хүснэгт/багана алга). Хөндсөн: `backend/src/quizzes/{bulk-generate.ts,
> bulk-generate.spec.ts,quizzes.service.ts,quizzes.controller.ts,dto/}` ·
> `admin/src/components/BulkGenerate.tsx` · `admin/src/pages/{exercises,quizzes,
> ielts}` · `API.md §6`.

Нэг товч дараад **бүхэл түвшний контент** бэлдэнэ. Админ зөвхөн **түвшингээ**
сонгоно — агуулга огт бичихгүй; AI төрөл бүрийн онцлогийг таниад дасгал зохионо.
Товч гурван хуудсанд: **Дасгал · Сорил · IELTS** (гурвуулаа нэг `Quiz` entity
тул нэг endpoint + нэг компонент — CODING_RULES §0.2).

| Хуудас | Төрлүүд | 10 сонговол |
| --- | --- | --- |
| Дасгал | Сонсгол · Бичих · Нөхөх · Дүрэм (4) | 40 дасгал |
| Сорил | 6 тоглоом (`quizType`) | 60 |
| IELTS | Listening · Reading · Writing · Speaking | 40 |

*Ярих (тун удахгүй) ба Унших (өөрийн `ReadingPassage` сантай) хоёр орохгүй —
тэнд `Quiz` үүсгэвэл апп дээр хүрэх дэлгэцгүй мөр болно.*

**Гол шийдэл — сэдвүүд рүү ээлжлүүлж тараана.** Апп дасгалыг `topic`-оор нь
бүлэглэж харуулдаг (`mobile/app/skill/[key].tsx`). Тиймээс AI-д сэдэв зохиолгохын
оронд админд аль хэдийн байгаа сэдвийн жагсаалтыг (`EXERCISE_CATEGORIES`,
`IELTS_SUBTOPICS`) ээлжлүүлж өгнө → 10 дасгал 7 сэдэвт жигд тарж, аппын одоогийн
бүлгүүдэд цэвэр буна. Нэг сэдэв дахин таарвал prompt-д "**энэ сэдвээрх 2 дахь
дасгал — өөр үгсийн сан, өөр өнцгөөс бич**" гэж очно.

**Давхардлаас хамгаалах 2 давхарга** (Choi-гийн үндсэн хүсэлт):
1. **Prompt тал** — тухайн `category`-гийн одоо байгаа гарчгуудыг (25 хүртэл)
   "битгий давт" гэж AI-д өгнө.
2. **Хариу тал** — буцаж ирсэн асуулт бүрийг DB дэх БҮХ асуултын нормчилсон
   түлхүүртэй харьцуулна (`dedupKey`: жижиг үсэг, цэг таслал/давхар зайг арилгана
   → "She ___ to school." ба "she  ___ TO school" нэг гэж тоологдоно). Давхардвал
   тэр асуулт **хасагдана**; 3-аас цөөн үлдвэл дасгал бүхэлдээ хаягдаж `skipped`.
   Түвшнээр шүүхгүй — A1-ийн асуултыг B1-д дахин гаргах нь мөн л давхардал.

**Bodit AI-гаар тестлэгдсэн** (Choi-гийн локал, билинг идэвхтэй түлхүүр):

| Тест | Үр дүн |
| --- | --- |
| 2 төрөл × 2 дасгал × 5 асуулт | 4/4 үүссэн, 0 алдаа, **~8 секунд** |
| Сэдэв тараалт | Аялал · Мэдээ · Цаг · Артикль — тус бүр 1 |
| `level` · `topic` · `isPublished` | бүгд зөв (`a1`, сэдэв, нийтэлсэн) |
| **Яг тэр хүсэлтийг ДАХИН гүйлгэв** | 8 дасгал / 39 асуулт → **39 нь давтагдашгүй**; 1 давхардсан асуулт баригдаж хасагдав (5→4) |

Мөн `bulk-generate.spec.ts` **17 тест** (тараалт, `nth`, `dedupKey` кирилл,
`questionText` гэмтсэн өгөгдөл, prompt-ийн 25 гарчгийн таслалт).

**Явц + зогсоох.** Урт ажил тул background job (`jobId` → 2.5с тутам татна),
явц нь `⏳ AI дасгал үүсгэж байна — Сонсгол · Аялал #2`, `created/skipped/failed`
тоолуур, амжилтгүй мөр бүрийн шалтгаан, **«Зогсоох»** товч. Дундын `JobProgress`
компонентыг ашиглана (өмнөх багцад Үгс/Хэлцээс гаргаж авсан).

⚠️ **Анхаарах зүйлс:**
- `ai-generate`-ээс ялгаатай нь энэ нь **шууд DB рүү бичнэ** (40 дасгалыг preview
  дээр нэг бүрчлэн шалгах боломжгүй). Хамгаалалт нь: асуулт бүр `ai-generate.ts`-ийн
  чанарын шалгуурыг дамжина + давхардал хасагдана + бүх мөр админд засагдана.
- Ажлын явц **санах ойд** (`bulkJobs` Map) — сервер restart хийвэл явц алдагдана
  (үүссэн дасгал DB-д үлдэнэ). Railway дээр deploy хийх үед ажиллаж байвал ийм.
- Зэрэг **3** AI дуудлага. Gemini-гийн 429-ийг `runGeminiText` өөрөө retry хийдэг.
- Нэг ажилд дээд тал нь **100** дасгал (`MAX_TOTAL_STEPS`) — зарцуулалтын хамгаалалт.

⛔ **Дараагийн хүн шалгах:** админы UI-аар (`localhost:5173`) дарж үзээгүй —
endpoint-ыг `curl`-ээр л end-to-end тестэлсэн. Мөн Choi-гийн локал DB-д тестийн
**8 дасгал** үлдсэн (`category in ('listening','grammar')`) — хэрэггүй бол
админаас сонгоод устгана уу.

#### ✅ Choi — Сонсголын дасгал хариулах боломжтой боллоо (2026-08-11) · ДАВХАРДУУЛАХГҮЙ

> ⚠️ **`/backend` + `/admin` доторх ажил — эзэмшигч нь Өсөхбаяр.** Choi барьсан
> тул **merge-ийн өмнө Өсөхбаяртай тохирно уу.** Migration шаардахгүй (шинэ
> хүснэгт/багана алга). Хөндсөн: `backend/src/quizzes/{ai-generate.ts,
> ai-generate.spec.ts,bulk-generate.ts,quizzes.service.ts,dto/query-quizzes.dto.ts}` ·
> `admin/src/pages/exercises/ExercisesPage.tsx`.

**Алдаа:** «Юу сурах вэ?» → Сонсгол доторх дасгал **эх мэдээлэлгүй** асуулт
асууж байв. Бодит жишээ — «Өдөр тутмын ярианы сонсгол» гэсэн дасгал шууд
`What time does Sarah usually wake up?` гэж асууж, Сара хэдэд босдогийг хаана ч
хэлээгүй. Сурагчид **таамаглахаас өөр арга үлдээгүй**.

**Шалтгаан:** 2026-08-10-нд нэмсэн ангиллын жор (`recipeFor`) нь зөвхөн **«Бүх
төрлөөр үүсгэх»** замд ордог байсан. Админы ердийн **«AI-аар үүсгэх»** цонх нь
`buildPrompt` дуудах бөгөөд тэнд сонсголын тухай ганц ч үг байгаагүй — загварт
`listening` гэдгийг зөвхөн шошго болгон дамжуулж, сонсох **ЯРИА зохиох даалгавар
огт өгдөггүй** байв. Тиймээс шинэ дасгал үүсгэх бүрд алдаа давтагдсаар байлаа.

**Засвар — 4 давхар (эхний хоёр нь гол):**
1. **Жор хоёр зам дээр ч ажиллана.** `buildPrompt` одоо `recipeFor(category)`-г
   уншина; `aiGenerate` дээр асуултын форматыг ч жор шийднэ (админы сонголт ба
   AI-гийн таамгаас **дээгүүр**) — формат буруу байвал аппын runner дасгалыг
   харуулж ч чадахгүй.
2. **Яриа заавал болов.** Gemini schema дээр `passageText` нь сонсголд
   `required` + `minLength: 40` (`MIN_LISTENING_SCRIPT`); `parseDraft` яриагүй
   ноорогийг **алдаа болгон** буцаана; `QuizzesService.create/update` нь
   яриагүй сонсголыг 400-аар татгалзана (гараар ч, импортоор ч орж чадахгүй).
3. **Хуучин эвдэрсэн мөр аппаас нуугдав.** `GET /quizzes` **анхдагчаар**
   хариулах боломжгүй сонсголыг хасна (`includeUnanswerable=true` гэвэл
   гаргана — админ л ашиглана). Серверт хийсэн тул **аппын шинэчлэл хүлээхгүй**,
   суулгачихсан бүх хувилбар шууд цэвэрлэгдэнэ. Устгаагүй — админ засах боломжтой.
4. **Админ:** «Сонсох яриа» талбар одоо `*` заавал (форм ба импорт хоёуланд),
   эвдэрсэн мөрүүд дээр улаан **«Яриагүй»** тэмдэг + хуудасны дээр анхааруулга.

**Нэмэлт олдвор:** яриаг `A:` / `B:` гэж бичүүлэхэд загвар асуултдаа **гэнэт нэр
зохиож** оруулдаг байв (`What time does Sarah start work?` — гэтэл яриан дотор
Sarah гэж хэн ч алга). Жор одоо оролцогчийг **нэрээр** бичүүлж, «асуултад дурдсан
нэр яриан дотор заавал сонсогдсон байх» гэж шаардана.

**Батлагдсан (локал, бодит Gemini + DB):** сонсголын 7 дасгалаас **5 нь
эвдэрсэн** байсан → апп одоо зөвхөн 2 бүтнийг харна, админ 7-г бүгдийг харна.
Яриагүй `POST /quizzes` → **400**; яриатай → **201**. AI-гаар 3 удаа үүсгэхэд
гурвуулаа нэртэй яриа + бүрэн хариулагдах асуулттай гарсан. Тест **42 ногоон**
(шинэ `ai-generate.spec.ts` — 12 тест яг энэ алдааг хамгаална).

⛔ **Дараагийн хүн:** админы UI-аар (`localhost:5173`) дарж үзээгүй — endpoint
болон `curl`-ээр л end-to-end тестэлсэн. **Prod дээрх** хуучин эвдэрсэн сонсголын
дасгалууд аппаас автоматаар нуугдана, гэхдээ **админаас гараар засах** хэрэгтэй
(яриаг нь бичих эсвэл устгах).

#### ✅ Choi — Чанарын шалгагч: логикийн бүх алдааг нэг дор (2026-08-11) · ДАВХАРДУУЛАХГҮЙ

> ⚠️ Дээрх бичлэгийн **үргэлжлэл** — тэр нь зөвхөн сонсголыг зассан. Choi
> «нэг нэгээр биш, ийм төрлийн БҮХ алдааг ол» гэсэн тул шалгуурыг ерөнхийлөв.
> `/backend` + `/admin` — **merge-ийн өмнө Өсөхбаяртай тохирно уу.** Migration
> шаардахгүй. Шинэ файл: `backend/src/quizzes/{quality.ts,quality.spec.ts}` ·
> `admin/src/components/QualityPanel.tsx`.

**Гол санаа — нэг шалгуур, гурван зам.** Бүх дүрэм `quality.ts` (`checkQuiz`)
дотор; **үүсгэх · хадгалах · тайлагнах** гурвуулан түүнийг дуудна. Ингэснээр
"админд зүгээр харагдсан мөр аппаас нуугдах" гэсэн зөрүү үүсэхгүй (DRY).
Шинэ дүрэм нэмэхдээ зөвхөн тэр файлыг хөнд.

**Барьж авдаг болсон алдаанууд** (бүгд бодит контент дээр илэрсэн):
- 🚫 `fill_blank` сонголтод **gerund + infinitive хоёулаа** (`swimming` ба
  `to swim`) — хоёул зөв мөртлөө нэг нь л тэнцдэг тул **зөв хариулсан сурагч
  буруу гэж тэмдэглэгддэг** байв. Choi-гийн мэдээлсэн алдаа.
- 🚫 Сонсголын асуултад дурдсан **нэр яриан дотор огт сонсогдоогүй**.
- 🚫 Зөв хариулт сонголтуудын дунд алга · `___` цоорхойгүй · сонголт давхардсан ·
  зөв хариултын индекс мужаас гарсан · асуулт/хариулт хоосон.
- ⚠️ **Утгаараа сонгох цоорхой** — `My mother likes to ___ in the kitchen.` →
  түлхүүр `cook`, гэтэл `sing`/`eat`/`clean` бүгд зөв. Хаалтанд үндсэн хэлбэр
  (`___ (go)`) байвал анхааруулахгүй (тэгвэл хариулт цорын ганц болно).
- ⚠️ **Задарсан хариулт** — `Which vegetable is …used in eggplant parmesan?`
  → `eggplant`. Хоёр өөр үг ижил орчуулгатай. Давхардсан асуулт.

`block` = хадгалалт **400**, аппаас нуугдана. `warn` = блоклохгүй, админд
жагсаагдана (хүн шийднэ) — худал дуулга контентыг устгах эрсдэлгүй.

**Админд:** Дасгал хуудсанд **чанарын самбар** нэмэгдэв — мөр бүрийн шалтгааныг
нэрлээд «Засах» товчоор шууд хүргэнэ; жагсаалтад «Хариулах боломжгүй» (улаан) /
«Шалгах» (шар) тэмдэг. Шалгуурыг админд давхардуулж бичээгүй — серверийн
`GET /quizzes/quality-report` уншина.

**🐛 Мобайл засвар (мөн Choi мэдээлсэн):** сонсголын **нөхөх** дасгалд цоорхойтой
өгүүлбэр огт харагдахгүй, зөвхөн **хариулсны дараа** гарч ирдэг байв — цоорхой
хаана байгааг харахгүй бол нөхөх боломжгүй. `hideQuestionText` нь `fill_blank`-д
хэзээ ч хамаарахгүй болов; заавар нь ч тусдаа (`howToListenFill` — «Сонсоод
доорх өгүүлбэрийн цоорхойг нөх»).

**Батлагдсан (локал, бодит DB + Gemini):** тайлан 11 асуудалтай дасгал олсон
(5 нь аппаас хаагдсан). Сонсгол: сурагч 2 харна / нийт 7. Gerund дасгал
хадгалах оролдлого → **400** зөв мессежтэй. Тест **60 ногоон**
(`quality.spec.ts` 18 + өмнөх 42).
- 🐛 Хоёр **худал дуулга** зассан: `hat` нь `What` дотроос (дэд-мөрөөр хайсан),
  `Tom's` → `Toms` (эзэмшлийн `'s`). Одоо үгийн заагаар шалгана.

⛔ **Дараагийн хүн:** админы UI-аар дарж үзээгүй (`curl` + Vite build-ээр л
шалгасан). `test/app.e2e-spec.ts` дахь **толь бичгийн** нэг тест унаж байгаа нь
энэ ажилтай хамааралгүй (quizzes хөндөөгүй) — тусад нь шалгах.

#### ✅ Choi — Сорил: админы контент 6 картдаа хуваарилагдав (2026-08-11) · ДАВХАРДУУЛАХГҮЙ

Choi: «админаас нэмсэн дасгалууд яагаад ангилал болгондоо хуваагдаж орохгүйгээр
“Шинэ сорилууд” гэж гарч ирсэн бэ? Үүнийг ингэж гаргаж ирэхгүйгээр хуваарилж
гарга».

**Алдаа:** Сорилын табын 6 карт нь **зөвхөн үгийн сангаас автоматаар үүсдэг
тоглоомууд** байсан ба админы бичсэн сорилууд тэдгээрийн доор «Шинэ сорилууд»
гэсэн **тусдаа овоо** болж цуварддаг байв — 60 сорил нэг жагсаалт болж, аль нь
ямар төрөл болох нь мэдэгдэхгүй.

**Засвар:** админы сорилууд одоо **төрөл тус бүрийн нэртэй хэсэгт** хуваагдана —
Үг таах · Сонсох · Дүрэм · Хурдан хариулт · Холбох · Дүүргэх. Хэсгийн нэр нь
`admin/src/pages/quizzes/QuizzesPage.tsx`-ийн `QUIZ_TYPES`-тэй яг таарна.
Локал DB дээр баталсан: **6 хэсэг × 10, харьяалалгүй 0**.
- ⚠️ **Яагаад `topic` БИШ вэ:** админы Сорил хуудас **«Сэдэв» талбаргүй** тул
  `topic` үргэлж хоосон — түүгээр хуваавал бүгд «Бусад»-д унана. `quizType` нь
  харин мөр бүрд бөглөгддөг.
- Танихгүй `quizType`-тай мөр **чимээгүй алдагдахгүй** — «Бусад» хэсэгт гарна.
- 6 карт нь **урьдын адил шууд тоглоом руу** орно (дунд нь цонх гарахгүй).
- `mobile/src/api/quizzes.ts`-ийн `Quiz`-д **`quizType`** ба **`createdAt`**
  нэмэгдэв (сервер аль хэдийн буцаадаг байсан, зөвхөн mobile-ийн төрөлд алга байв).
  Мөрийн зурагч `QuizRow` болж гарсан.
- ⚠️ **Дүрэм:** админд шинэ тоглоомын төрөл нэмэхэд `SORIL_TYPE_LABELS`
  (`soril.tsx`)-д мөн нэм — эс бөгөөс «Бусад»-д унана.
- ⚠️ **Boju:** `mobile/app/(tabs)/soril.tsx` хөндөгдсөн (чиний эзэмшил).

> 🔻 **Туршиж үзээд БУЦААСАН (Choi):** карт дарахад «Тоглоом эхлүүлэх» гэсэн
> сонголтын цонх (`SheetModal`) гаргах, картан дээр «N үлдсэн» тэмдэг харуулах
> хоёрыг хийж үзсэн боловч **хэрэглэхэд сонин** байсан тул хассан. Карт = шууд
> тоглоом; админы контент нь доорх нэртэй хэсгүүдэд. Дахин бүү нэм.

#### ✅ Choi — Нөхөх дасгал: сонголт 4 болж, байрлал цэгцлэгдэв (2026-08-12) · ДАВХАРДУУЛАХГҮЙ

Choi: «нөхөх дасгалуудад сонголт нь хэтэрхий олон байна, яг 4-ш л байхад болох
байх, тэгээд байрлал нь гоё байх хэрэгтэй — иймэрхүү замбараагүй биш».

**Алдаа:** сонголтгүй **хуучин контент** дээр апп `wordBank` руу буцдаг байсан —
тэр нь **тухайн дасгалын БҮХ хариулт** тул 10 асуулттай дасгалд **10 чипс**
гарч, урсаад эмх замбараагүй болдог байв (бодит: 9 чипс).

**Засвар:**
- **BE:** `withFillChoices()` — `choices`-гүй `fill_blank` асуулт бүрд **яг 4**
  сонголт бэлдэнэ (зөв хариулт + тухайн дасгалын бусад хариултаас 3). Ижил
  сэдэвтэй тул итгэмээр, `normalizeChoices` нь зөв хариулт дотор нь байхыг
  баталгаажуулна. Шинэ `GET /quizzes/:id` → `findOneForStudent()`.
  - ⚠️ `findOne()` нь **бүтэн entity хэвээр** — `update`/`/check`/`/submit`
    түүн дээр тулгуурладаг. Тэндээс талбар хасвал `update` нь DB-гээс
    хариултуудыг **устгана**. Тиймээс аппын хувилбарыг тусад нь гаргав.
  - `buildWordBank` нь `@deprecated` — хуучин суулгацтай апп эвдрэхгүйн тулд
    буцаасаар байна.
- **FE:** сонголтууд **2×2 тэгш сүлжээ** боллоо (`flexBasis: '48%'`, 52px өндөр).
  Урьд нь уртаараа урсаж, мөр бүрд өөр тооны үг багтаж, зарим нь ганцаараа
  үлддэг байв.
- 🧪 Баталсан: 9 чипс → **асуулт бүрт яг 4**, зөв хариулт бүрд нь дотор нь.

**🐛 Дараагийн дамжлага — Choi туршаад олсон 3 зүйл (2026-08-12):**
1. **Зарим асуулт 3 сонголттой байсан.** Нэг үг хэд хэдэн асуултын хариулт
   байвал (ж: «doing» 2 удаа) санамсаргүй 3-ыг авахад ижил үг давхар орж,
   дараа нь давхардал арилгагдаад **3 болж хумигддаг** байв. Одоо сонголтын
   санг **эхлээд давхардалгүй болгоно** → бүх асуулт 4 (бодит датан дээр
   4 дасгал × бүх асуулт = 4).
2. **3 сонголттой үед сүлжээ эвдэрдэг байсан.** `flexGrow` нь сүүлийн чипсийг
   мөр бүтнээр сунгадаг байв — хассан. Одоо сондгой тоотой ч зүүн талдаа тэгш.
3. ⛔ **Бичих дасгал ИЛГЭЭГДДЭГГҮЙ байсан** (Choi: «submit хийх гэхээр error»).
   `open_response` асуултын оноо **0** тул бүхэлдээ бичих дасгалд нийт оноо 0
   болж, `scoreSubmission` нь **400 «Quiz-д оноогүй асуулт байна»** шидэж
   байв — сурагч бичээд дуусгачихаад илгээж чаддаггүй. Эдгээр нь автомат
   үнэлгээгүй (жишиг хариулттай нь өөрөө харьцуулна) тул одоо **дүнгээр биш,
   дуусгасан эсэхээр** тооцно: бүтэн XP, алдааны тойм гарахгүй.
   ⚠️ Холимог дасгал (оноотой + задгай) урьдын адил — задгай нь оноо нэмэхгүй.
4. **Гарын түлхүүр хураах арга байгаагүй** (Choi: «яаж хураахаа мэдэхгүй,
   заавал өөр хэсэгт дарж байж гардаг»). Олон мөрт талбарт Enter нь шинэ мөр
   нэмдэг тул гарц байхгүй байв. Одоо бичиж эхэлмэгц талбарын дээр
   **«Болсон»** товч гарна (`Keyboard.dismiss()`).

**⚠️ Дээрх 1 ба 3 нь BACKEND засвар — prod дээр гартал үйлчлэхгүй.** Choi
prod руу холбогдсон утсан дээр тестэлдэг тул засварын дараа ч ижил алдаа
харагдсаар байв. Тиймээс аппын талаас **хоёр даатгал** нэмэв:
- **Сонголтыг апп өөрөө 4-өөр таслана** (`pickFillChoices`). ⚠️ Таслах нь
  **зөв хариулт дотор нь үлдэх баталгаатай** үед л аюулгүй — эс бөгөөс дасгал
  хариулах боломжгүй болно. Сервер `answer`-ыг хариудаа явуулдаг бол (одоогийн
  prod ингэдэг) түүгээр баталгаатай 4 бүрдүүлнэ; явуулаагүй бол **таслахгүй**
  (бөглөрсөн ч хариулж болно). Backend шинэчлэгдвэл асуулт бүр өөрийн 4
  сонголттой ирэх тул энэ зам огт хэрэглэгдэхгүй.
- **Серверийн алдааны мессежийг ил гаргана.** Урьд нь `catch` нь үргэлж
  ерөнхий «Failed to submit your answer» харуулдаг байсан тул жинхэнэ
  шалтгаан («Quiz-д оноогүй асуулт байна») нуугдаж, оношлох боломжгүй байв.

> ⛔ **Өсөхбаярт — АЮУЛГҮЙ БАЙДЛЫН олдвор (энэ багцад ЗАСААГҮЙ).**
> `GET /quizzes/:id` ба `GET /quizzes` хоёр нь **зөв хариултыг аппад илгээж
> байна** (`"answer":"eyes"`, `"correct":1`). `mobile/src/api/quizzes.ts:22`-т
> «correct & answer are NOT returned to the client» гэж бичсэн ч сервер
> бодитоор хасдаггүй — сурагч сүлжээний хариунаас хариултыг харах боломжтой
> (XP/зүрхний систем бүхий апп тул утга учиртай).
> **Яагаад энэ багцад заагаагүй вэ:** зөв засвар нь ролиос хамаарсан
> сериализаци шаардана — админ жагсаалтдаа хариултыг **харах ёстой** (засварлах
> учир), сурагч **харах ёсгүй**. Хоёр endpoint-д хамаарах тул чиний талын
> шийдвэр. Түр зуурын нөлөө: `withFillChoices`-ийн 4 сонголт нь дүр эсгэсэн
> хамгаалалт болно.

**➕ Шинэ ↔ хийсэн нь ялгарах болов** (Choi: «орохоор шинэ, хуучин хийсэн гэдгийг
нь яаж харагдуулах вэ?»). Шийдэл нь **«юу үлдсэн»**-ийг тэргүүнд гаргах:
- **Хийгээгүй нь ЭХЭНД** эрэмбэлэгдэнэ; хийсэн нь доошоо буугаад ✓ ногоон дүрс +
  бүдэг өнгө + «Хийсэн» гэсэн тэмдэглэгээтэй үлдэнэ (устгахгүй — дахин хийж болно).
- Бүлэг доторх эрэмбэ **шинэ → хуучин** (сервер `createdAt DESC` буцаадаг).
- **«ШИНЭ» тэмдэг** — сүүлийн **7 хоногт** нэмэгдсэн ба **хийгээгүй** мөрөнд л.
  Хийчихсэн зүйлийг «шинэ» гэвэл худал мэдээлэл болно.
- **Картын тэмдэг нь ҮЛДСЭН тоог** хэлнэ («3 үлдсэн»), нийт тоог биш — тоо биш
  үйлдэл заана. Бүгдийг хийсэн бол ногоон **«Бүгд хийгдсэн»**.
- Цонхны толгойд **«3/10 хийсэн»** ахиц.
- Төлөв нь `loadCompletedExercises()`-ээс (ур чадварын дэлгэцүүдийн ижил сан),
  `useFocusEffect`-ээр уншина — сорил хийгээд гарангуут ✓ шууд суана.
- `Quiz`-д **`createdAt`** талбар нэмэгдэв (сервер буцаадаг байсан, төрөлд алга байв).

#### ✅ Choi — Сонсоод нөхөх засвар + дасгалын UI шинэчлэл (2026-08-11) · ДАВХАРДУУЛАХГҮЙ

Дээрх хоёр бичлэгийн **гурав дахь давалгаа** — Choi аппаас олсон 2 шинэ алдаа.

**🐛 1. Дуу нь нөхөх үгийг чимээгүй алгасдаг байв.** `Speech.speak` нь `___`-ийг
уншдаггүй тул «How are you ___?» → сурагч «How are you?» гэж сонсоод, ямар үг
дутуу байгааг **мэдэх аргагүй** үлддэг байв. «Ямар үг уншиж байгааг нь мэдэж
байж л нөхөж чадна» (Choi). Хоёр талаас зассан:
- **Үндсээр нь (BE):** сонсоод нөхөх дасгалын нөхөх үг нь **сонсох яриан дотор
  ЗААВАЛ** байх ёстой болов (`block`). Цоорхойтой өгүүлбэр өөрөө ч яриан дотор
  гарсан байх ёстой — эс бөгөөс сурагч сонсоогүй өгүүлбэрээ нөхөх болно.
  Жорт ч нэмэгдсэн тул AI ийм дасгал огт үүсгэхээ болино.
- **Аппад:** `speakable()` нь `___`-ийг «blank» гэж уншина (диктантын жишиг арга)
  — үлдсэн ямар ч тохиолдолд чимээгүй алгасахгүй.

**🐛 2. Сонсголд «Нөхөх» сонгох боломжгүй болсон байв** (миний өмнөх багцын
регресс). Ангиллын жор нь админы **заасан төрлийг дардаг** байсан тул сонсголд
үргэлж эхний хэлбэр (сонгох) гардаг байв. Одоо дараалал:
**админы заасан → жор → AI-гийн таамаг**; сонсголын жор нь заасан төрөлд
тохирох хэлбэрээ (сонгох ↔ нөхөх) өөрөө олно.

**🎨 Дасгалын дэлгэцийн UI шинэчлэгдэв** (`app/quiz/[id].tsx`):
- **Цоорхой одоо ХАРАГДАНА.** `___` нь текстийн дунд алга болдог байсныг өнгөт
  «нүх» болгов; сонгосон үг нь нүхэн дотроо суух тул сурагч **бүтэн өгүүлбэрээ
  уншиж** зөв эсэхээ шалгана (`QuestionWithBlank`).
- **Сонсох карт** — хавтгай товч байсныг дугуй дүрс + гарчиг + «Товшоод яриаг
  сонс» / «N удаа сонссон» дэд мөр + play дүрс бүхий өргөгдсөн карт болгов.
- **Заавар** энгийн текст байсныг зөөлөн шошго болгов; текстгүй үед огт
  гарахгүй (өмнө хоосон мөр үлддэг байсан).
- Сонголт/чипсийн радиус, дэвсгэр өнгө, зай тэгшлэгдэв (чипс нь бүрэн бөөрөнхий).

**Батлагдсан (бодит Gemini + DB):** «Нөхөх» сонсгол үүсгэхэд яриа + 3 асуулт
бүгд яриан дотроос гарсан (`I usually ___ up at 7 AM.` → `wake` ✓). Яриан дотор
байхгүй үг нөхүүлэх оролдлого → **400**; байгаа нь → **201**. Тест **63 ногоон**,
mobile/backend typecheck + lint цэвэр.

**UI — хоёр дахь дамжлага (Choi: «UI өөрчлөгдөөгүй байна, бүх төрлийн тест дотор»):**
- **Асуулт одоо КАРТтай.** Урьд нь дэвсгэр дээр чөлөөтэй хэвтэж, доорх хариултын
  товчнуудтай нийлж, аль нь асуулт болох нь тодорхойгүй байв. Мөр хоорондын зай
  34px болж, цоорхойн нүх мөрөндөө багтана.
- **Сонгох үгс** 48px өндөртэй, тодоор бичигдэнэ (хуруугаар оноход том).
- **Зөв хариулт** чипсийн дунд шахагдаж, шинэ чип мэт харагддаг байсныг тусдаа
  мөрөнд ✓ дүрстэй гаргав (нөхөх ба бичих хоёуланд).
- **Сорилын тоглоомын дэлгэц** (`app/game/[mode].tsx`) ч ижил загварт орлоо —
  үгийн prompt карттай, сонголт 56px өндөртэй. Хоёр runner нэг төрхтэй боллоо.
- ⚠️ **Metro-г дахин ачаална** (`npm run go`) — UI өөрчлөлт зөвхөн шинэ bundle-д
  гарна. Choi «өөрчлөгдөөгүй» гэсэн нь reload хийгээгүйтэй холбоотой байж болзошгүй.

**🎧 Сонсоод нөхөх: одоо ЗӨВХӨН тухайн өгүүлбэрийг уншина (2026-08-11, гурав дахь дамжлага).**
Choi: «энэ сонсдог хэсгийг нь зүгээр л шууд хариултыг нь уншдаг болговол ямар вэ?»
- ⛔ **Дан хариултыг уншуулах боломжгүй** — сервер зөв хариултыг аппад **хэзээ ч
  илгээдэггүй** (`api/quizzes.ts:22`, зөвхөн `/check` шалгана). Илгээвэл сурагч
  сүлжээнээс/бандлаас хараад мэдэх боломжтой болно.
- ✅ **Оронд нь:** `findScriptSentence()` нь цоорхойтой өгүүлбэр яриан дотор
  хаана байгааг олоод (үгийн давхцлаар, талаас илүү таарсан үед л итгэнэ),
  **түүнийг л уншина**. Богино, төвлөрсөн — дутуу үг тод сонсогдоно, хариулт
  задрахгүй. Итгэлтэй таарахгүй бол бүтэн яриа руу буцна.
- Нөхөх дасгалд асуулт бүрд шинэ өгүүлбэр уншина (сонгох дасгалд яриа нэг л удаа).
- «Бүтэн яриа» товч нэмэгдсэн — контекст хэрэгтэй бол бүтнээр нь сонсоно.

**🎨 Дизайн — гурав дахь дамжлага:** асуултын карт зүүн талдаа брэндийн өнгөт
зурвас + зөөлөн сүүдэртэй болов; сонгосон хариулт/чип өргөгдөнө (сүүдэр);
сонголтууд 56px өндөр (хуруунд таарна); сонсох картын дүрс тунгалаг дугуйтай.

**🐛 Цоорхой «сонин дөрвөлжин хайрцаг» болж байсныг зассан (Choi мэдээлсэн).**
Эхний хувилбарт цоорхойг `Text` дотор дэвсгэр өнгөөр хийсэн байсан —
**React Native нь үүрлэсэн `Text`-д `borderRadius`-ыг үл тоодог** тул мохоо
дөрвөлжин гарч, өгүүлбэрийн дунд наалдсан шошго шиг харагдаж байв.
- Одоо өгүүлбэрийг **үг тус бүрээр** зурж (`flexWrap` мөр), цоорхойг жинхэнэ
  **`View`** болгов: бөөрөнхий булан, 38px өндөр, хоосон үедээ **тасархай
  хүрээтэй** («энд үг орно» гэдгийг хэлнэ), дүүрэхэд цул өнгө болно.
- ⚠️ **Дүрэм:** RN-д текстийн дунд бөөрөнхий/хүрээтэй элемент хэрэгтэй бол
  `Text` дотор `backgroundColor` бүү хэрэглэ — `View` болгож, өгүүлбэрээ
  `flexWrap` мөр болго.

**🔊 «blank» гэж хэлэхээ болив — жинхэнэ үг сонсогдоно (Choi).** Сурагч нөхөх
үгээ **чихээрээ барьж авах** ёстой тул тэр үг дуунд байх ЁСТОЙ.
- **Нөхөх дасгал цоорхойтой асуултыг ХЭЗЭЭ Ч уншихгүй** боллоо — үргэлж
  ЯРИАнаас уншина. Яриа нь бүтэн үгтэй ирдгийг сервер баталгаажуулна
  (`quality.ts`: нөхөх үг + өгүүлбэр хоёул яриан дотор байх, эс бөгөөс 400).
  Тиймээс **шинэ дасгал/даалгавар нэмэхэд ч** энэ алдаа давтагдахгүй.
- Сонсох зүйлгүй бол товчийг огт гаргахгүй (дардаг мөртлөө чимээгүй товч
  байхаас дээр). `speakable()` нь одоо зөвхөн хамгаалалт — цоорхой орж ирвэл
  «blank» гэхийн оронд богино завсарлага.
- 🧪 Баталсан: 2 өөр бүтэцтэй дасгалын 5 асуулт бүрд `findScriptSentence()`
  зөв өгүүлбэрийг оносон ба **нөхөх үг нь тэр өгүүлбэр дотор байсан**
  (`I really enjoy ___ to music.` → «I really enjoy listening to music.»).

**🐛 Гурван алдаа зассан (Choi мэдээлсэн):**
1. **«Үргэлжлүүлэх» дарахад дуу гарахгүй, товчийг дахин дарах шаардлагатай.**
   `Speech.stop()` нь **асинхрон** — шууд араас нь `speak()` дуудвал зогсоолт нь
   шинэ өгүүлбэрийг залгидаг. Одоо 160мс хүлээгээд эхлүүлнэ. Мөн автомат
   уншилтын түлхүүр нь **унших текст + оролдлого** болов: буруу хариулаад
   эргэж ирсэн асуулт ч дахин уншигдана (өмнө чимээгүй үлддэг байв).
2. **Зөв хийсний дараа үг цоорхойноос алга болдог байв** (`!feedback` нөхцөл).
   Одоо үлдэнэ; нүх нь өөрөө **ногоон/улаан** болж хариултаа хэлнэ.
3. **Буруу хийхэд зөв хариулт доор нь тусдаа мөр болж гардаг байсан** — сурагч
   дээш доош хараад тааруулах хэрэгтэй болдог байв. Одоо **зөв чипс өөрөө
   ногоороно** (сонгох дасгалын зан төлөвтэй ижил), буруу сонголт улаан.
   Гараар бичих хувилбарт л доорх мөр хэвээр (тэнд чипс байхгүй).

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
- [x] **EAS холбогдсон** — Expo project `@usukh6ayar/sparkxp`, `app.json`
      `extra.eas.projectId` = `302d838f-49f9-4abe-8179-d3d180940fe7`
      (2026-08-04-нд дахин үүсгэсэн — доорх "EAS төсөл `sparkxp` болов"-ыг үз).
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
- [x] 🆕 **EAS төсөл `sparkxp` болов (2026-08-04)** — хуучныг устгаж шинийг
      үүсгэсэн. Шалтгаан: `slug` нь `sparkxp` болсон ч EAS түүнийг
      `extra.eas.projectId`-ийн ард байгаа төслийн slug-тай тулгаж шалгадаг тул
      бүх `eas` команд `Slug for project identified by "extra.eas.projectId"
      (englishxp) does not match the "slug" field (sparkxp)` гэж унаж байв.
      `eas project:rename` команд **байхгүй** (21.5.0 дээр ч), зөвхөн dashboard.
      Сонгосон зам: **delete → `eas init --force`**.
      | Юу | Утга |
      | --- | --- |
      | Шинэ төсөл | `@usukh6ayar/sparkxp` |
      | Шинэ `projectId` | `302d838f-49f9-4abe-8179-d3d180940fe7` |
      | Хуучин `projectId` | ~~`d5b190dd-0fb6-4684-8aff-4648fb0f0357`~~ (устсан) |
      **Устгахад алдсан зүйл:** 1 Android build-ийн түүх (`preview`, 2026-07-24)
      + EAS-ийн үүсгэсэн Android keystore. Play Store дээр нийтлээгүй, мөн
      bundle id хамаагүй солигдож байсан тул бодит хохирол гараагүй. EAS env
      vars (3 орчин) болон EAS Update branch хоосон байсан. **Hot Updater OTA
      огт хөндөгдөөгүй** — тэр Cloudflare R2/D1/Worker дээр, Expo-д хамаагүй.
      ⚠️ Хуучин `preview` APK суусан төхөөрөмж дээр шинэ build **тусдаа апп**
      болж суух болно (bundle id + keystore хоёулаа өөр).
      ⚠️ `eas init` нь `app.json`-г дахин бичихдээ кирилл escape-ийг задалж,
      `expo-local-authentication`-ы `USE_BIOMETRIC`/`USE_FINGERPRINT`
      зөвшөөрлийг Android дээр тодорхой бичсэн (plugin prebuild дээр ямар ч
      байсан нэмдэг — зөв).
- [ ] ⚠️ Дараагийн native build-ийн ӨМНӨ: локал `ios/`+`android/` (gitignore)
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
- [x] ⚖️ **Privacy/Terms хуудсыг маркетингийн сайтад БОДИТООР байршуулав**
      (2026-08-08). Өмнө нь апп болон store listing хоёулаа тэр хаяг руу
      заадаг атлаа файл нь тэнд байхгүй, **404** байсан — 2 build аль хэдийн
      тэр холбоостой TestFlight руу явсан. Одоо `SparkXP_web` repo-д
      байршиж, prod дээр 200 гарахыг батлав.

      **Store-д оруулах хаягууд** (`.html`-тэй хувилбарыг ашиглана — апп яг
      түүн рүү заадаг):

      | Юу | URL |
      | --- | --- |
      | Privacy Policy (Apple + Play) | `https://spark-xp-web.vercel.app/privacy.html` |
      | Terms of Service | `https://spark-xp-web.vercel.app/terms.html` |
      | Support URL (Apple шаарддаг) | `https://spark-xp-web.vercel.app/support.html` |
      | Дата устгах URL (Play шаарддаг) | `https://spark-xp-web.vercel.app/delete-account.html` |

      ⚠️ **`privacy.html`/`terms.html` бол ХУУЛБАР.** Эх файл нь энэ repo-д
      `admin/public/{privacy,terms}.html`. Тэнд өөрчлөгдөх бүрд маркетингийн
      сайт руу дахин хуулах ёстой, эс бөгөөс хоёр газар зөрнө:

      ```bash
      cp admin/public/{privacy,terms}.html ../SparkXP_web/public/
      diff ../SparkXP_web/public/privacy.html admin/public/privacy.html   # хоосон байх ёстой
      ```

      **Илгээхээсээ өмнө дахин шалга** (deploy бүрийн дараа ч):
      `curl -sIL https://spark-xp-web.vercel.app/privacy.html | head -1` → `200`.
      404 бол Apple reject хийнэ — тэд холбоосыг заавал нээж шалгадаг.
- [ ] 🚦 **OTA staged rollout — App Store-оос ӨМНӨ дүрэм болгож тогтоох.**
      Одоо OTA нь шууд **100%** дээр гардаг. Beta-д зүгээр, production-д
      аюултай: эвдэрхий bundle-ыг OTA-гаар буцааж засах баталгаа **байхгүй**
      (`bundle disable` нь шалгалт хийсээр байгаа төхөөрөмжид л хүрнэ; native
      crash-rollback нь bundle *унасан* үед л ажилладаг). 2026-08-08-нд яг ийм
      bundle гарч, суусан төхөөрөмж OTA-гаа бүрмөсөн алдаж, зөвхөн апп устгаж
      дахин суулгаснаар сэргэсэн — App Store дээр боломжгүй зүйл.
      **Урсгал:** `deploy -r 10` (force-гүй) → bundle доторх мөр шалгах →
      1–2 цаг Sentry → `bundle update --rollout-cohort-count 500` → `1000`.
      Бүрэн заавар + checklist: `docs/HOT_UPDATER.md` §4.6.

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
| **Push Notification** | Өсөхбаяр (BE) + Choi/Boju (FE) | BE + cron ✅ · Choi-гийн API давхарга ✅ · native dependency + `app.json` plugin ✅ · үлдсэн: dev-client build + APNs/FCM credential |
| Streak сайжруулалт | Choi | Freeze ✅ · өдрийн зорилго ✅ · streak daily-goal gate ✅ (2026-08-06) · сануулга = push-тай хамт |

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
