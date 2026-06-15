# EnglishXP (SparkXP) — Хэрэглэгчийн роль ба эрх

> Энэ файл нь системийн **хэрэглэгчийн төрөл, роль, эрх**-ийг дэлгэрэнгүй
> тайлбарласан лавлах. Хоёр dev (тус тусын Claude)-ийн **хуваалцсан ойлголт**.
> Кодын дүрэм/контекст: `CLAUDE.md` · Ажлын төлөвлөгөө: `ROADMAP.md`,
> `MOBILE_ROADMAP.md`.

---

## 🎯 Зорилго ба хэн ашиглах вэ

Гамшгийн англи хэл сурах **геймжүүлсэн** апп (Монгол оюутнууд primary).
Эзэмшигч: **Hustle Hive LLC**.

Нэг апп, **олон төрлийн хэрэглэгч** — `Organization` (нээлттэй `type` талбар) нь:

| Audience | Тайлбар |
|---|---|
| **Дан оюутан** | Англи сурах хувь хүн (байгууллагагүй, `organizationId = null`) |
| **Сургууль** | Багш + сурагчид (класс, даалгавартай) |
| **Байгууллага** | Хуулийн фирм, компани — ажилтнууддаа сургах |

Байршил (`province`/`district`)-аар **орон нутгийн leaderboard** (аймаг/дүүрэг).

---

## 🎭 Роль (UserRole)

Нэг `User` хүснэгт, `role` enum талбараар эрх ялгана. Код:
`backend/src/common/enums` → `UserRole` (`student | teacher | admin | super_admin`).
Хамгаалалт: `@Roles(...)` + `RolesGuard` (`backend/src/auth/`).

---

## 1. 👨‍🎓 `student` — Оюутан (гол хэрэглэгч)

**Хэн:** Англи сурч буй оюутан/сурагч. Шинэ бүртгэл default-оор `student`.

**Хариуцлага / юу хийдэг:**
- Үг, хичээл, дүрэм, сонсгол сурах
- **Сорил** (quiz) өгч оноо авах
- **Үг давтах** (SM-2 spaced repetition)
- **AI Найз**-тай ярих (англи дадлага)
- **XP** цуглуулах (насан туршийн прогресс) + **Очирхон** (Sparks, зарцуулагддаг)
- **Leaderboard** дээр өрсөлдөх (global / аймаг / дүүрэг / класс)
- Spark-аар **хичээл нээх** (`priceSparks`)
- `join_code`-оор **класст элсэх** (сургуулийн оюутан)

**Эрх (endpoints):**
- `POST /auth/register`, `/auth/login`, `GET /auth/me`
- `PATCH /users/me`, `GET /users/me/stats`
- `GET /words`, `/lessons`, `/quizzes` (зөвхөн унших)
- `GET /reviews/due`, `POST /reviews/:wordId`
- `POST /quizzes/:id/submit`
- `POST /ai/chat`
- `GET /leaderboard`
- `POST /lessons/:id/unlock`, `GET /lessons/:id/access`
- `POST /classes/join` (Phase 2)

**Mobile дэлгэц:** Нүүр · Хичээлүүд · Сорил · AI Найз · Профайл · Хичээл дэлгэрэнгүй · Үг давтах

**Чадахгүй:** контент үүсгэх/засах, бусдын мэдээлэл харах, класс үүсгэх.

---

## 2. 👩‍🏫 `teacher` — Багш (Phase 2)

**Хэн:** Сургууль/байгууллагын багш, ангиа удирддаг.

**Хариуцлага / юу хийдэг:**
- **Класс үүсгэх** + `join_code` гаргах
- Оюутнуудаа удирдах (класст хэн байгаа)
- **Даалгавар** (Assignment) өгөх — хичээл/сорилыг класст оноох, due date-тэй
- Оюутны **прогресс/статистик** харах (teacher dashboard)

**Эрх (endpoints, Phase 2):**
- `POST /classes` (класс үүсгэх), `GET /classes` (өөрийн класс)
- `POST /assignments` (даалгавар оноох)
- Класс доторх оюутны прогресс унших
- + бүх `student`-ийн уншлагын эрх

**Платформ:** teacher dashboard (web эсвэл mobile-д tab) — Phase 2.

**Чадахгүй:** глобал контент (үг/хичээл) удирдах (энэ нь admin), бусад класс/багшийн дата.

---

## 3. 🛠️ `admin` — Контент/систем удирдагч

**Хэн:** Контент бичигч, байгууллагын ажилтан. **Web admin panel**-аар ажиллана.

**Хариуцлага / юу хийдэг:**
- **Контент CRUD:** Үг, Хичээл, Сорил нэмэх/засах/устгах · publish · `priceSparks`
  · Сорилын `questions` (jsonb) засах
- **Хэрэглэгч удирдах:** жагсаалт, хайх, **role өөрчлөх**, устгах
- (Phase 2) Байгууллага, класс удирдах
- **Монитор:** AI зарцуулалт/зардал (AiUsage), Payments, Leaderboard
- **Plan limit** тохируулах (AI token, voice минут, Spark rate) — DB/Redis-ээс,
  **app update-гүйгээр** (CLAUDE.md core rule)

**Эрх (endpoints, `@Roles(ADMIN, SUPER_ADMIN)`):**
- `POST/PATCH/DELETE /words`, `/lessons`, `/quizzes`
- `GET /users`, `PATCH /users/:id` (role), `DELETE /users/:id`
- `PATCH /ai/limits` (plan limit)
- (Phase 2) `/organizations`, `/classes`, `/assignments`, `/payments` удирдах

**Платформ:** **Web admin dashboard** (тусдаа app, ижил backend API — `/admin`).

**Чадахгүй:** бусад admin-г удирдах, систем тохиргоо (энэ нь super_admin).

---

## 4. 👑 `super_admin` — Систем эзэн

**Хэн:** Платформын эзэн/гол админ (Hustle Hive).

**Хариуцлага / юу хийдэг:**
- **Бүх `admin`-ийн эрх**, дээр нь:
- **Бусад admin-г үүсгэх/удирдах** (role олгох)
- **Систем тохиргоо** (бүх байгууллагын plan, лимит)
- Бүх байгууллага/дата хооронд хандах (cross-org)

**Эрх:** бүх endpoint, хязгааргүй.

**Платформ:** Web admin dashboard (өргөтгөсөн эрхтэй).

---

## 📊 Эрхийн матриц

| Үйлдэл | student | teacher | admin | super_admin |
|---|:---:|:---:|:---:|:---:|
| Бүртгүүлэх / нэвтрэх | ✅ | ✅ | ✅ | ✅ |
| Контент **унших** (үг/хичээл/сорил) | ✅ | ✅ | ✅ | ✅ |
| Сорил өгөх, үг давтах, XP цуглуулах | ✅ | ✅ | ✅ | ✅ |
| AI Найз-тай ярих | ✅ | ✅ | ✅ | ✅ |
| Spark-аар хичээл нээх | ✅ | ✅ | ✅ | ✅ |
| Класс үүсгэх, даалгавар өгөх | ❌ | ✅ | ✅ | ✅ |
| Класст оюутны прогресс харах | ❌ | ✅(өөрийн) | ✅ | ✅ |
| Контент **CRUD** (нэмэх/засах/устгах) | ❌ | ❌ | ✅ | ✅ |
| Хэрэглэгч удирдах (role өөрчлөх, устгах) | ❌ | ❌ | ✅ | ✅ |
| Plan limit / AI лимит тохируулах | ❌ | ❌ | ✅ | ✅ |
| Монитор (AI зардал, Payments) | ❌ | ❌ | ✅ | ✅ |
| **Бусад admin удирдах**, систем тохиргоо | ❌ | ❌ | ❌ | ✅ |

> `teacher` нь `student`-ийн бүх **уншлага/суралцах** эрхтэй + класс удирдлага.
> `admin`/`super_admin` нь голдуу **web panel**-аар (mobile-аар суралцах нь сонголт).

---

## 🔧 Код дахь хэрэгжилт

- **Enum:** `backend/src/common/enums` → `UserRole`.
- **Хамгаалах:**
  ```ts
  @UseGuards(JwtAuthGuard, RolesGuard)   // эхэлж токен, дараа нь role
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('words')   // зөвхөн admin/super_admin
  ```
- **JWT payload:** `{ sub: userId, email, role }` — `JwtStrategy` хэрэглэгчийг ачаална.
- **`@Roles` байхгүй бол** нэвтэрсэн хэн ч хандана (зөвхөн `JwtAuthGuard`).
- Шинэ хэрэглэгч default `role = student`. Role-ийг **admin/super_admin** өөрчилнө
  (`PATCH /users/:id`) — өөрөө өөрийгөө дэвшүүлэхгүй.

---

## 🔁 Үндсэн урсгалууд (user flows)

**Оюутан:** бүртгүүлэх → (сургуулийн бол `join_code`-оор класст элсэх) → хичээл
үзэх/сорил өгөх → XP/Очирхон цуглуулах → leaderboard өрсөлдөх → Spark-аар хичээл
нээх → AI-тай дадлага хийх.

**Багш (Phase 2):** нэвтрэх → класс үүсгэх → `join_code` оюутнуудад өгөх →
даалгавар оноох → прогресс хянах.

**Admin:** web panel-д нэвтрэх → үг/хичээл/сорил нэмэх (publish) → хэрэглэгч
удирдах → AI зардал/Payments хянах → plan limit тохируулах.

**Super_admin:** admin-уудыг үүсгэх/удирдах → систем/байгууллагын тохиргоо.

---

## 📈 Scale (хэдэн хэрэглэгч)

Тогтсон дээд хязгааргүй — **MVP-ээс өргөжихөөр** зохиосон:
- Одоо: Postgres query (мянга мянган хэрэглэгч).
- Өргөжвөл: Redis cache / leaderboard ZSET (стэк-д бэлэн), plan limit.
- Multi-org: сургууль/компани бүр олон зуун хэрэглэгчтэй.
- UUID PK, indexed query, append-only ledger (XpLog/SparksLog) — найдвартай.
