# EnglishXP (SparkXP) — Хэрэглэгчийн роль ба эрх

> Системийн **хэрэглэгчийн төрөл, роль, эрх** — хэн юу **харах**, юу **хийх**
> боломжтойн лавлах. Хоёр dev (тус тусын Claude)-ийн хуваалцсан ойлголт.
> Код дүрэм: `CLAUDE.md` · Бүтээгдэхүүн: `PRODUCT_BRIEF.md` · API: `API.md`.
> Сүүлд шинэчилсэн: **2026-06-17** (auth overhaul + teacher хэсэг хэрэгжсэн).

---

## 🎯 Хэрэглэгчийн төрөл (audience)

Нэг апп, олон төрлийн хэрэглэгч. `Organization` (нээлттэй `type` талбар):

| Audience | Тайлбар |
|---|---|
| **Дан суралцагч** | Хувь хүн, байгууллагагүй (`organizationId = null`) |
| **Сургууль** | Багш + сурагчид (класс, даалгавар, join code) |
| **Байгууллага** | Хуулийн фирм, компани — ажилтнаа сургах |

Байршил (`province`/`district`) болон `organizationId`-аар **орон нутгийн /
сургуулийн leaderboard** боломжтой.

---

## 🎭 Роль (UserRole) — 5 төрөл

Нэг `User` хүснэгт, `role` enum талбараар эрх ялгана
(`backend/src/common/enums` → `UserRole`). Хамгаалалт: `@Roles(...)` + `RolesGuard`.

| Role | Хүн | Платформ |
|---|---|---|
| `student` | Суралцагч (гол хэрэглэгч) | Mobile |
| `teacher` | Багш — анги/даалгавар удирдана | Mobile (role-based tab) |
| `moderator` | Контент бичигч (teacher + контент CRUD) | Web admin |
| `admin` | Контент/хэрэглэгч/систем удирдагч | Web admin |
| `super_admin` | Платформын эзэн | Web admin |

> **Шинэ бүртгэл үргэлж `student`.** teacher/moderator/admin эрхийг **admin
> олгоно** (`PATCH /users/:id`; moderator/admin/super_admin-г зөвхөн super_admin).

---

## 1. 👨‍🎓 `student` — Суралцагч (гол хэрэглэгч)

**Хэн:** Англи сурч буй хүн. Бүртгэл default-оор student.

**Юу ХАРАХ вэ (mobile дэлгэцүүд):**
- **Нүүр** — мэндчилгээ, өдрийн зорилго, давтах үгс, **"Анги нэгдэх"**, скилл grid, статистик
- **Хичээлүүд** — зураг-банер картууд (level filter, прогресс, pull-to-refresh)
- **Хичээл дэлгэрэнгүй** — видео + (дараа) "Гүнзгийрүүлэх" үнэтэй хичээл
- **Сорил** (quiz) · **Үг давтах** (SRS карт) · **AI Найз** (chat)
- **Чансаа (Leaderboard)** — scope: **Анги** (багшийн сурагчид) · Глобал · Аймаг · Дүүрэг; долоо хоног/сар/бүх цаг; өөрийн байр
- **Профайл** — нэр, **avatar (зураг upload / бэлэн зургаас)**, XP/Очирхон, гарах
- **Анги нэгдэх** — код бичих эсвэл **QR уншуулах**

**Юу ХИЙХ боломжтой:**
- Үг/хичээл/дүрэм/сонсгол сурах, **сорил өгч оноо авах**
- **XP** цуглуулах (насан туршийн) + **Очирхон/Sparks** (зарцуулагддаг)
- AI Найз-тай ярих (дадлага)
- Spark-аар **хичээл нээх** (`priceSparks`)
- **Анги нэгдэх хүсэлт** илгээх (код/QR) → **багш зөвшөөрнө** (шууд элсэхгүй)
- Өөрт **оноосон даалгавар** харах (`/assignments/mine`)
- Профайл/avatar засах, leaderboard-д өрсөлдөх

**Эрх (endpoints):** `auth/register|verify-otp|resend-otp|login|forgot-password|reset-password|me` ·
`PATCH /users/me` · `POST /users/me/avatar` · `GET /words|lessons|quizzes` (унших) ·
`reviews/*` · `POST /quizzes/:id/submit` · `POST /ai/chat` · `GET /leaderboard` ·
`POST /lessons/:id/unlock`, `GET /lessons/:id/access` · `POST /classes/join` · `GET /assignments/mine`

**ЧАДАХГҮЙ:** контент үүсгэх/засах, бусдын дата харах, класс үүсгэх.

---

## 2. 👩‍🏫 `teacher` — Багш ✅ (хэрэгжсэн)

**Хэн:** Сургууль/байгууллагын багш. Эрхийг **admin олгоно** (бүртгэлээр болохгүй).
Нэвтрэхэд role-оор **багшийн tab** руу автоматаар орно.

**Юу ХАРАХ вэ (багшийн tab):**
- **Ангиуд** — заадаг ангиуд (сургууль + нэр), "Анги үүсгэх"
- **Ангийн дэлгэрэнгүй** — **элсэх код + QR (Share)**, сурагчид (XP), даалгаврууд,
  **элсэх хүсэлтүүд (зөвшөөрөх/татгалзах)**
- **Чансаа** — зөвхөн **өөрийн сурагчид** (бүх ангиа нийлүүлж, XP-ээр)
- **Профайл** — "Багш" badge, гарах

**Юу ХИЙХ боломжтой:**
- **Анги үүсгэх** (сургууль сонгож + нэр: 10А/11Б) → join code + QR гарна
- Сурагчийн **элсэх хүсэлтийг зөвшөөрөх/татгалзах** (хэн ч кодоор шууд орохгүй)
- **Даалгавар оноох** (хичээл/сорил + due date), устгах
- Сурагчдынхаа **XP/чансаа** харах
- + бүх `student`-ийн суралцах эрх

**Эрх:** `POST /classes` · `GET /classes` · `GET /classes/:id` · `/classes/:id/students` ·
`/classes/:id/requests` + `.../approve` + reject · `POST/GET/DELETE /assignments` ·
`GET /leaderboard?scope=teacher`

**ЧАДАХГҮЙ:** глобал контент (үг/хичээл/сорил) CRUD, бусад багшийн анги/сурагч.

---

## 3. 🧩 `moderator` — Контент бичигч

**Хэн:** Хичээл/контент бэлтгэгч. **super_admin олгоно.**

**Юу ХИЙХ:** `teacher`-ийн эрх + **контент CRUD** (Lessons / Words / Quizzes
нэмэх/засах/устгах, publish, `priceSparks`, thumbnail). Web admin-аар.

**ЧАДАХГҮЙ:** хэрэглэгчийн role өөрчлөх, plan/систем тохиргоо, бусад admin удирдах.

---

## 4. 🛠️ `admin` — Контент/хэрэглэгч/систем удирдагч

**Хэн:** Байгууллагын админ. **Web admin panel** (`/admin`). Email-ээр нэвтэрнэ.

**Юу ХАРАХ/ХИЙХ:**
- **Контент CRUD:** Үг, Хичээл (+ thumbnail, parent/гүнзгийрүүлэх), Сорил
- **Хэрэглэгч удирдах:** жагсаалт, хайх, **role өөрчлөх** (teacher болгох), устгах
- **Байгууллага / класс / даалгавар / Payments** удирдах
- **Монитор:** AI зарцуулалт/зардал (AiUsage), Payments, Leaderboard (`/leaderboard/top`)
- **Plan limit** (AI token/voice минут/Spark rate) — DB/Redis-ээс, **app update-гүйгээр**

**Эрх (`@Roles(ADMIN, SUPER_ADMIN)` голчлон):** `POST/PATCH/DELETE /words|lessons|quizzes` ·
`GET /users` · `DELETE /users/:id` · `/organizations`, `/classes`, `/assignments`, `/payments` ·
`PATCH /ai/limits` · `POST /upload`

**ЧАДАХГҮЙ:** бусад admin удирдах, role-г admin/super_admin болгох (→ super_admin).

---

## 5. 👑 `super_admin` — Систем эзэн

**Хэн:** Платформын эзэн (Hustle Hive).

**Юу ХИЙХ:** **Бүх admin эрх** + дараах:
- Бусад **admin/moderator/teacher үүсгэх/role олгох** (`PATCH /users/:id`)
- **Сургууль (Organization) бүртгэх** (гэрээтэй сургуулийг жагсаалтад нэмэх)
- Систем/бүх байгууллагын **plan, лимит, тохиргоо**, cross-org хандалт

**Эрх:** бүх endpoint, хязгааргүй.

---

## 📊 Эрхийн матриц

| Үйлдэл | student | teacher | moderator | admin | super_admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Бүртгүүлэх / нэвтрэх (username/email) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Контент **унших**, сорил, XP, AI, Spark | ✅ | ✅ | ✅ | ✅ | ✅ |
| Анги нэгдэх (хүсэлт) | ✅ | — | — | — | — |
| Анги үүсгэх, даалгавар, **хүсэлт зөвшөөрөх** | ❌ | ✅ | ✅ | ✅ | ✅ |
| Өөрийн сурагчдын чансаа | ❌ | ✅ | ✅ | ✅ | ✅ |
| Контент **CRUD** (хичээл/үг/сорил) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Хэрэглэгч удирдах (устгах, role) | ❌ | ❌ | ❌ | ✅ | ✅ |
| Plan/AI лимит, Payments, монитор | ❌ | ❌ | ❌ | ✅ | ✅ |
| **admin/teacher role олгох**, Сургууль бүртгэх, систем | ❌ | ❌ | ❌ | ❌ | ✅ |

> `teacher`/`moderator` нь `student`-ийн бүх **суралцах** эрхтэй.
> `admin`/`super_admin` голдуу **web panel**-аар.

---

## 🔧 Код дахь хэрэгжилт

- **Enum:** `UserRole` (`student | teacher | moderator | admin | super_admin`).
- **Хамгаалалт:**
  ```ts
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  ```
  `@Roles` байхгүй бол нэвтэрсэн хэн ч хандана (зөвхөн `JwtAuthGuard`).
- **Нэвтрэлт:** `{ identifier, password }` — `identifier` нь **username ЭСВЭЛ email**
  (`email` талбар хуучин admin-д хэвээр). Бүртгэл → **email OTP** баталгаажуулалт.
- **JWT payload:** `{ sub, email, role }`. Шинэ хэрэглэгч default `student`.
- **Mobile routing:** нэвтэрсний дараа `role`-оор — `teacher` → багшийн tab, бусад → student tab.

---

## 🔁 Үндсэн урсгалууд

- **Суралцагч:** бүртгүүл (username+email → OTP) → (сургуулийнх бол **код/QR-аар анги нэгдэх хүсэлт** → багш зөвшөөрнө) → хичээл/сорил → XP/Очирхон → чансаа → Spark-аар хичээл нээх → AI дадлага → даалгавраа гүйцэтгэх.
- **Багш:** admin багшаар томилно → нэвтэр → анги үүсгэ (сургууль+нэр) → код/QR хуваалц → **хүсэлт зөвшөөр** → даалгавар оноо → сурагчдынхаа чансаа хян.
- **Moderator/Admin:** web panel → хичээл/үг/сорил нэмэх (thumbnail, publish) → (admin) хэрэглэгч/role/AI лимит/Payments.
- **Super_admin:** сургууль бүртгэх → багш/admin томилох → систем тохиргоо.

---

## 📈 Scale

UUID PK, indexed query, append-only ledger (XpLog/SparksLog). Одоо Postgres
query (мянга мянган хэрэглэгч); өргөжвөл Redis cache / leaderboard ZSET (бэлэн),
plan limit, multi-org (сургууль/компани бүр олон зуун хэрэглэгч).
