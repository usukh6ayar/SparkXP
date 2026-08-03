# SparkXP — Кодын аудит (2026-07-28)

> **Хамрах:** `/backend` (17.5k мөр) · `/mobile` (25.8k мөр) · `/admin` (8.8k мөр).
> **Аргачлал:** 3 төслийн `tsc --noEmit` + `CODING_RULES.md`-ийн дүрэм бүрээр grep
> аудит + migration ↔ entity тулгалт + security посtура. Олдвор бүрийг **кодоос
> баталсан** (файл:мөр бичсэн).
> **Эзэн:** Өсөхбаяр · **Төлөв:** энэ бол *жагсаалт*, засварыг доор заасан PR-уудаар
> тусад нь оруулна (энэ PR-д код өөрчлөөгүй).

## 0. Дүгнэлт

Суурь чанар **сайн**: 3 төсөл бүгд `tsc --noEmit` цэвэр, raw `fetch` бараг байхгүй
(1 л хууль ёсны binary дуудлага), бүх controller DTO ашигладаг, `catch {}`-оор
алдаа залгисан газар **байхгүй**, entity дүрэм (UUID PK / `@JoinColumn` / `jsonb`)
мөрдөгдсөн. Гол эрсдэл нь **кодонд биш — infra/тохиргоонд**: migration гинж
тасарсан, prod secret-д default утга бий, rate limit огт байхгүй, lint/test
ажиллахгүй байдалтай.

| Эрэмбэ | Тоо | Гол сэдэв |
| --- | --- | --- |
| 🔴 Өндөр | 3 | **бүгд ✅ зассан** — migration гинж (#178) · `JWT_SECRET` (#179) · rate limit (#179) |
| 🟠 Дунд | 11 | ✅ lint/test (#181) · ✅ crash reporting (#183) · ✅ CLAUDE.md (#177) · ✅ index (#182) · ✅ splash (M8, 2026-08-03) · ⬜ hardcoded өнгө · ⬜ том файл · ⬜ bundle ID |
| 🟡 Бага | 6 | ✅ Expo Push (#180) · ✅ сануулга (#180) · ✅ CI (#181) · ⬜ QPay stub · ⬜ i18n цоорхой |

> **Төлөв (2026-07-28 орой):** өндөр эрэмбийн **3/3** хаагдсан. Үлдсэн ажил нь
> ихэвчлэн `/mobile` талын (өнгө/i18n/bundle ID) буюу Choi/Boju-гийн хэсэг,
> эсвэл бизнесийн шийдвэр хүлээж буй (QPay).

---

## 1. 🔴 Өндөр эрэмбэ

### H1. `assignment_completions` table-д CREATE migration БАЙХГҮЙ

**Файл:** `backend/src/migrations/1785600000000-TeacherPanelPhase1.ts:39–44`

Тус migration нь дараах байдлаар table-г **өөрчилдөг**:

```ts
await q.query(`ALTER TABLE "assignment_completions" ADD "status" ...`);
await q.query(`ALTER TABLE "assignment_completions" ADD "score_pct" integer`);
```

Гэтэл `src/migrations/`-ийн **аль ч файлд** `CREATE TABLE assignment_completions`
байхгүй. Бүх migration-ийн үүсгэсэн table-ийг entity-ийн `@Entity()` нэрстэй
тулгахад **зөвхөн энэ нэг table дутуу**.

**Одоо prod унасан гэсэн үг БИШ.** Prod дээр уг table нь `DB_SYNCHRONIZE=true`
байсан үеийн үлдэгдэл болж аль хэдийн үүссэн. Асуудал нь **шинэ орчинд** гарна:

- шинэ Railway instance / staging орчин
- `DB_SYNCHRONIZE=false`-той локал dev (`typeorm.config.ts`-ийн prod стратеги)

Тэнд migration дараалахдаа `1785600000000` дээр алдаа өгнө → `DB_MIGRATIONS_RUN=true`
тул **boot бүтэлгүйтнэ**. Өөрөөр хэлбэл repo-гоос эхнээс нь орчин барих боломжгүй.

**Засвар (тусдаа PR):** `1785550000000-CreateAssignmentCompletions.ts` нэмнэ —
timestamp нь `1785600000000`-ээс **бага** байх ёстой (pending migration нь
timestamp-ийн дарааллаар ажилладаг), дотор нь `CREATE TABLE IF NOT EXISTS`
хэрэглэнэ. Ингэснээр **prod дээр no-op**, шинэ DB дээр зөв дарааллаар ажиллана.

> ✅ **ЗАССАН (PR #178).** `1785550000000-CreateAssignmentCompletions` нэмэгдэв —
> timestamp нь TeacherPanelPhase1-ээс өмнө, `CREATE TABLE IF NOT EXISTS` тул prod
> дээр no-op, шинэ орчинд зөв дарааллаар ажиллана. Зүрхний PR шинэ migration
> нэмж байсан тул тасарсан гинжийг эхлээд нөхөх шаардлагатай байв.

### H2. `JWT_SECRET` нь `'change-me'` гэсэн default-той

**Файл:** `backend/src/auth/auth.module.ts:26` · `backend/src/auth/strategies/jwt.strategy.ts:30`

```ts
secret: config.get<string>('JWT_SECRET', 'change-me'),
```

Хэрэв prod дээр `JWT_SECRET` env тавигдаагүй бол апп **чимээгүй** нийтэд мэдэгдэх
түлхүүрээр гарын үсэг зурна. Тэгвэл хэн ч дурын `userId` + `role: super_admin`-тэй
токен үйлдэж админ эрхээр орно.

**Засвар:** `NODE_ENV=production` үед `JWT_SECRET` байхгүй бол boot дээр `throw`
хийж унагах (fail fast) — чимээгүй уначихаас чанга уначих нь дээр.

### H3. Rate limiting / helmet огт байхгүй

`backend/package.json`-д `@nestjs/throttler` ч, `helmet` ч **байхгүй** (grep = 0),
`main.ts`-д ямар ч throttle middleware алга.

Хамгаалалтгүй үлдсэн зам:

| Зам | Эрсдэл |
| --- | --- |
| `POST /auth/login` | Нууц үг brute-force |
| `POST /auth/register` | Спам бүртгэл + имэйл флууд |
| OTP verify | 6 оронтой код таах (хязгааргүй оролдлого) |
| Password reset | Имэйл бөмбөгдөлт |
| `/ai/*` | Хэдийгээр per-user limit бий ч, HTTP давтамжийн хамгаалалт нэмэлт давхарга болно |

**Засвар:** `@nestjs/throttler` global guard (жишээ 60 хүсэлт/мин), auth зам дээр
чанга (`@Throttle(5, 60)`), + `helmet()`-ийг `main.ts`-д.

---

## 2. 🟠 Дунд эрэмбэ

### M1. Backend `npm run lint` ажиллахгүй

`package.json`-д `"lint": "eslint \"{src,test}/**/*.ts\" --fix"` гэж зарласан ч
**ESLint config файл байхгүй** (`.eslintrc*` ч, `eslint.config.*` ч олдсонгүй).
Ажиллуулахад: *"ESLint couldn't find a configuration file"*. Өөрөөр хэлбэл
`CODING_RULES.md §6`-ийн commit-ийн өмнөх шалгалт хэрэгжих боломжгүй.

> Анхаар: script-д `--fix` бий — тохиргоо нэмсний дараа шууд ажиллуулбал файлуудыг
> **өөрчилнө**. Эхлээд `npx eslint "src/**/*.ts"` (`--fix`-гүй) хийж олдворыг үзэх.

### M2. `mobile` / `admin`-д lint script байхгүй

`admin/`-д `eslint.config.js` **бий** ч `package.json`-д `lint` script алга.
`mobile/`-д config ч, script ч байхгүй. Хамгийн олон hardcoded өнгө/текст байгаа
талбар нь яг lint-гүй нь энэ.

### M3. Unit test-үүд хэзээ ч ажилладаггүй

`backend/src/teacher/progress.spec.ts` + `skill.spec.ts` бичигдсэн, гэвч
`jest.config.ts`-ийн `testRegex: '.*\\.e2e-spec\\.ts$'` нь **зөвхөн** e2e-г түүнэ.
`package.json`-д `test` script ч байхгүй (зөвхөн `test:e2e`). → 2 spec файл үхмэл.

**Засвар:** `testRegex`-ийг `.*\.(spec|e2e-spec)\.ts$` болгож, `"test": "jest"`
script нэмэх.

### M4. `xp_logs`-д composite index дутуу (leaderboard ажиллагаа)

**Файл:** `backend/src/leaderboard/leaderboard.service.ts:135–139` ·
`backend/src/entities/xp-log.entity.ts:15`

Leaderboard нь `xp_logs`-ийг `x.createdAt >= :since` цонхоор шүүж `u.id`-аар
бүлэглэдэг. Гэтэл entity дээр `@Index()` нь **зөвхөн `user_id`** дээр байна —
`created_at` дээр index алга. `weekly`/`monthly` чансаа бүр бүтэн table скан хийнэ.
Ledger нь append-only тул мөрийн тоо зөвхөн өснө.

**Засвар:** `@Index(['userId', 'createdAt'])` (эсвэл ядаж `created_at` дээр
ганцаархан index) + харгалзах migration.

### M5. Hardcoded hex өнгө — 71 газар (CODING_RULES §2 зөрчил)

| Файл | Тоо |
| --- | --- |
| `mobile/app/level/[code].tsx` | 10 |
| `mobile/src/components/VocabCard.tsx` | 8 |
| `mobile/app/(tabs)/lessons.tsx` | 7 |
| `mobile/app/(auth)/register.tsx` | 6 |
| `mobile/src/components/BuddySelector.tsx` | 4 |
| бусад 6 файл | 1–2 тус бүр |

Эдгээр нь `theme.ts`-ийн light/dark (+ premium) палитрт **дагадаггүй** тул
сэдэв солиход хагас өөрчлөгдөж, contrast алдагдана.

### M6. Хэт том файлууд (CODING_RULES §1 — ≈300 мөр)

| Файл | Мөр |
| --- | --- |
| `mobile/src/i18n/index.ts` | 1606 |
| `backend/src/words/words.service.ts` | 1277 |
| `admin/src/pages/words/WordsPage.tsx` | 1235 |
| `backend/src/ai-gateway/ai-gateway.service.ts` | 940 |
| `mobile/app/(tabs)/index.tsx` | 801 |
| `backend/src/ai-gateway/buddy.service.ts` | 800 |
| `admin/src/pages/quizzes/QuizzesPage.tsx` | 764 |

`i18n/index.ts`-ийг домэйнөөр (auth/home/quiz/teacher…) хуваах нь хамгийн хялбар,
эрсдэлгүй эхлэл. `words.service.ts` нь CRUD + AI fill + bulk job + медиа гэсэн
4 хариуцлагыг нэг дор барьж байна (God service).

### M7a. Crash reporting / error monitoring ОГТ БАЙХГҮЙ

`backend` · `mobile` · `admin` гурвуулаа Sentry (эсвэл түүнтэй адилтгах) ашигладаггүй
— `package.json`-уудад `sentry`/`bugsnag` grep = **0**.

Store-д гарсны дараа **хэрэглэгчийн утсан дээр юу эвдэрснийг харах арга байхгүй**
болно. Хэрэглэгч "ажиллахгүй байна" гэж бичихээс өөр дохио ирэхгүй. Launch-ийн
өмнө хийх ёстой хамгийн өндөр өгөөжтэй техникийн ажлуудын нэг (≈1 цаг):
`@sentry/react-native` (mobile) + `@sentry/node` (backend).

### M7b. `CLAUDE.md` админыг **Next.js** гэж бичсэн — бодитоор **Vite + React**

`CLAUDE.md` §Repo Structure: *"`/admin` — Next.js web admin dashboard"*.
Гэтэл `admin/package.json`-д `next` **байхгүй**, `vite` × 5 (`"dev": "vite"`,
`@vitejs/plugin-react`, `vite build`). `README.md` нь зөв бичсэн.

3 dev тус бүрийн Claude session энэ файлыг "shared brain" болгон уншдаг тул
буруу framework нь **идэвхтэй төөрөгдүүлж** байна (Next.js-ийн routing/SSR
таамаглалаар код бичих эрсдэл). Хамгийн хямд, хамгийн шууд өгөөжтэй засвар.

### M7. Апп-ын нэрлэлт `englishxp` хэвээр — rename хийх эсэхийг store-оос ӨМНӨ шийдэх

**Шинэчлэл 2026-08-03:** iOS дээр байсан **commit хийгээгүй** `com.usukhbayar.sparkxp`
өөрчлөлтийг **буцаалаа** → одоо *зөрүү байхгүй*, бүх талбар нэг мөрөнд:

| Талбар | Утга |
| --- | --- |
| iOS `bundleIdentifier` | `com.usukh6ayar.englishxp` |
| Android `package` | `com.usukh6ayar.englishxp` |
| `slug` / `scheme` | `englishxp` |
| `extra.eas.projectId` | `d5b190dd-…` (жинхэнэ, `owner: usukh6ayar`) |

Үлдсэн асуудал нь зөрүү биш, **брэндийн нэр**: апп нь SparkXP атлаа бүх
техникийн танигч нь `englishxp`. **Шийдвэр хэрэгтэй:** (а) `englishxp`-ээр
хэвээр илгээх — хамгийн хямд, хэрэглэгчид харагдахгүй; эсвэл (б) бүрэн rename
(iOS + Android + `slug` + `scheme` + EAS дахин холбох) — store-д **нэг ч удаа
илгээхээс өмнө** л боломжтой. Илгээсний дараа bundle ID солих нь App Store
Connect / Play дээр **шинэ апп** үүсгэнэ (шинэчлэл болохгүй), EAS credential ч
хуучин ID-д уягдсан. Хагас солих нь хамгийн муу төлөв.

### ~~M8. `splash` тохируулаагүй~~ — ✅ ЗАССАН (2026-08-03)

`mobile/app.json`-д `expo-splash-screen` plugin нэмэгдэв: `assets/splash-icon.png`
+ `imageWidth: 200` + theme-ийн дэвсгэр (light `#F6F4FD` · dark `#0B0716`).
`app/_layout.tsx` нь `preventAutoHideAsync()` → фонт бэлэн болмогц `hideAsync()`
хийж, splash-аас апп руу шууд шилжинэ (өмнө нь splash эхний frame дээр алга
болж, фонт ачаалагдах хүртэл хоосон дэлгэц гарах байсан).
App icon нь урьд өмнөөс **бэлэн**: `icon-ios.png` 1024×1024, `icon.png`
1254×1254 adaptive.

---

## 3. 🟡 Бага эрэмбэ

| # | Олдвор | Байршил |
| --- | --- | --- |
| L1 | QPay жинхэнэ API дуудлага stub хэвээр | `backend/src/payments/payments.service.ts:67` |
| L2 | Expo Push илгээлт stub хэвээр (`expoPushToken` хадгалагдаагүй) | `backend/src/notifications/notifications.service.ts:22` |
| ~~L3~~ | ~~Production код дотор `console.log`~~ — **энэ олдвор БУРУУ байсан.** `notifications.service.ts`-ийнх нь stub байсан (одоо бодит push, #180). `WordsPage.tsx`-ийнх нь **зориудын оператор хэрэгсэл**: удаан ажиллах bulk job-ийн явцыг browser console-д харуулдаг (кодод нь тайлбарласан байсан). Ажиллаж байгаа хэрэгслийг "цэвэрлэх" нь буруу тул хөндөөгүй | — |
| L4 | Англи хатуу текст i18n-д ороогүй (level narrative) | `mobile/app/level/[code].tsx:79` |
| L5 | CI байхгүй — `.github/workflows/` огт алга | repo root |
| L6 | **Үхмэл код** — `sound.ts` бүрэн бичигдсэн ч хаанаас ч import хийгдээгүй, `SOURCES` хоосон (CODING_RULES §5 зөрчил) | `mobile/src/lib/sound.ts` |
| L7 | **Сануулга (reminder) огт илгээгддэггүй** — `scheduler/`-т streak/давтлагын job алга, Expo Push нь stub. Гэтэл `WordReview`-д SM-2 due date аль хэдийн бий → өгөгдөл бэлэн, зөвхөн хүргэлт дутуу. Gamified апп-д хамгийн том retention хөшүүрэг | `backend/src/scheduler/`, `notifications.service.ts:22` |

L5-ын улмаас M1–M3 (lint/test) нь ажиллаж эхэлсэн ч **автоматаар шалгагдахгүй**.
Хамгийн бага CI: 3 төслийн `tsc --noEmit` + backend `jest`.

---

## 4. Санал болгож буй PR дараалал

| # | PR | Агуулга | Эрсдэл |
| --- | --- | --- | --- |
| ~~1~~ | ~~`fix/migration-chain`~~ | ✅ **ХИЙГДСЭН — PR #178** (зүрхний PR-т багтав) | — |
| 2 | `fix/auth-hardening` | H2 + H3 — secret fail-fast · throttler · helmet | Дунд — auth зам хөндөнө, тест хэрэгтэй |
| 3 | `chore/lint-test-ci` | M1 + M2 + M3 + L5 — eslint config × 3, jest testRegex, GitHub Actions | Бага |
| 4 | `perf/leaderboard-index` | M4 — composite index + migration | Бага |
| 5 | `refactor/i18n-split` | M6-ийн эхний алхам — `i18n/index.ts`-ийг хуваах | Бага (зан төлөв өөрчлөхгүй) |
| 6 | `chore/store-identity` | M7 + M8 — bundle ID шийдвэр + splash | **Шийдвэр эхэлж хэрэгтэй** |

| ~~7~~ | ~~`chore/sentry`~~ | ✅ **backend хийгдсэн — PR #183.** DSN-гүй бол бүрэн идэвхгүй. **Mobile тал үлдсэн** (Boju) | — |
| 8 | `docs/claude-md-fix` | M7b — админы framework залруулга | ✅ хийгдсэн |

> M5 (hardcoded өнгө) нь `CODING_RULES.md §7`-ийн refactor prompt-оор
> **талбар тус бүрээр** явуулах нь зөв — нэг PR-т 71 газар бүү хөндөөрэй.

---

## 5. Шалгасан бөгөөд ЦЭВЭР байсан зүйлс

Дараах зүйлсийг тусгайлан шалгаад асуудалгүй болохыг баталсан — дахин бүү шалга:

- **`tsc --noEmit` цэвэр** — backend · mobile · admin гурвуулаа.
- **Raw `fetch` алга** — `mobile/src/components/BuddyAvatar.tsx:194` дээрх ганц
  дуудлага нь GLB-г `arrayBuffer` болгож татдаг (API биш) → зөв.
- **DTO-гүй `@Body()` алга** — бүх controller-т `any`/inline type байхгүй.
- **Залгисан алдаа (`catch {}`) алга** — 4 талбарт 0 тохиолдол.
- **Entity дүрэм мөрдөгдсөн** — UUID PK, `created_at/updated_at`, `@JoinColumn`,
  nullable string-д тодорхой `type`.
- **`.env` commit хийгдээгүй** — зөвхөн `.env.example` × 4 tracked.
- **`mobile/ios` · `mobile/android` git-д ороогүй** (Expo Go урсгал бүтэн).
- **Health endpoint** — Redis ping-ийг timeout-оор race хийж hang-ээс сэргийлсэн.
- **i18n сахилга** — дэлгэцүүдэд монгол хатуу текст бараг алга (L4-өөс бусад).
- **API.md шинэ endpoint-уудыг барьсан** — `/quizzes/:id/check`, `/words/sample`,
  IELTS band бүгд баримтжсан.
