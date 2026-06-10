# EnglishXP (SparkXP) — Admin Dashboard Roadmap

> **Web admin panel**-ийн төлөвлөгөө. Контент бичигч/ажилтан контент удирдах,
> хэрэглэгч хянах вэб. Роль/эрх: `ROLES.md` · Endpoint: `API.md` · Дүрэм: `CLAUDE.md`.
> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж буй · `[ ]` хийгээгүй

---

## 🏛️ Архитектур

```
Backend (бэлэн NestJS API)
   ├── Mobile app  (оюутан, React Native)
   └── Admin web   (admin/super_admin, React)   ← ШИНЭ, /admin folder
```

- **Шинэ backend хийхгүй** — одоо байгаа API-г ашиглана (`API.md`).
- Admin вэб → `admin` role-оор нэвтэрч, JWT токеноор `@Roles(ADMIN)` endpoint рүү.
- Repo-д **`/admin`** folder (`/backend`, `/mobile`-ийн хажууд).
- `super_admin` нэмэлт эрхтэй (admin удирдах, систем тохиргоо).

---

## 🧰 Технологийн сонголт (MVP)

| Зүйл | Санал | Тайлбар |
|---|---|---|
| Framework | **React + Vite + TypeScript** | Хурдан, хөнгөн |
| Admin engine | **Refine** (refine.dev) ⭐ эсвэл **React-Admin** | REST дээр table/form/CRUD автоматаар |
| (Эсвэл) UI | **shadcn/ui** + custom | SparkXP брэндтэй, илүү дизайн хяналт |
| Auth | JWT (login → token → localStorage) | Backend-ийн `/auth/login` |
| Data | `fetch`/axios wrapper (Bearer token) | `API.md`-ийн endpoint-ууд |
| Charts | recharts (монитор хэсэгт) | AI зардал/прогресс |

> **2 dev, REST бэлэн** → **Refine/React-Admin** хамгийн хурдан (boilerplate бага).
> Брэнд дизайн чухал бол shadcn. Эхлээд Refine-аар туршихыг санал болгоё.

---

## 📁 Төлөвлөж буй бүтэц

```
admin/
  src/
    api/client.ts        fetch wrapper (baseUrl, Bearer token, алдаа)
    auth/                login, token storage, role guard
    pages/
      words/             list + form
      lessons/           list + form (content editor)
      quizzes/           list + form (questions editor)
      users/             list + role change
      monitor/           AI usage, payments, leaderboard
      settings/          plan limits
    components/          Table, Form, Sidebar, ...
  .env                   VITE_API_URL=http://localhost:3000/api
```

---

## 🎯 Phase A0 — Foundation `[x]` — 👤 Бишрэлт ✅

- [x] `/admin` — React + Vite + TS + Tailwind v3 scaffold
- [x] API client — `VITE_API_URL`, Bearer token, ApiError, `api.get/post/patch/delete`
- [x] **Login** хуудас → `POST /auth/login` → localStorage token
- [x] **Role guard** (`RequireAdmin`) — admin/super_admin биш бол /login руу redirect
- [x] Layout — sidebar (`Sidebar.tsx`) + `<Outlet />` + protected routes (`App.tsx`)
- **DoD:** ✅ Admin нэвтэрч, sidebar-тай dashboard руу орно. Student татгалзана.

## 🎯 Phase A1 — Контент удирдлага `[x]` — 👤 Бишрэлт ✅

- [x] **Words** — хүснэгт + level шүүлт + нэмэх/засах/устгах modal
- [x] **Lessons** — CRUD + publish/unpublish toggle + priceSparks + JSON content editor
- [x] **Quizzes** — CRUD + questions JSON editor (template байна)
- **DoD:** ✅ Admin үг/хичээл/сорил нэмж, publish хийнэ.

## 🎯 Phase A2 — Хэрэглэгч удирдлага `[x]` — 👤 Бишрэлт ✅

- [x] **Users** жагсаалт + нэр/имэйлээр хайх
- [x] **Role өөрчлөх** (super_admin-д dropdown, admin-д харах л)
- [x] Хэрэглэгч **устгах** (өөрийгөө устгахаас сэргийлсэн)
- **DoD:** ✅ Admin хэрэглэгчдийг харж, super_admin role өөрчилнө.

## 🎯 Phase A3 — Монитор `[x]` — 👤 Бишрэлт ✅

- [x] **Payments** жагсаалт (`GET /payments`) + нийт орлого статистик
- [ ] **AI зарцуулалт** — `GET /ai/usage` backend endpoint нэмэх хэрэгтэй (gap)
- **DoD:** ✅ Төлбөрийн мэдээлэл харагдана.

## 🎯 Phase A4 — Тохиргоо `[x]` — 👤 Бишрэлт ✅

- [x] **AI plan limit** засах — `GET/PATCH /ai/limits` (dailyMessage, dailyToken, maxContext)
      app update-гүйгээр Redis/DB-ээс тохируулна
- **DoD:** ✅ Admin AI лимит кодгүйгээр тохируулна.

## 🎯 Phase A5 — Phase 2 удирдлага `[ ]`

- [ ] **Organizations** — байгууллага CRUD (`/organizations`) — хуудас нэмэх
- [ ] **Classes** — класс жагсаалт/харах (`/classes`)
- [ ] **Assignments** — даалгаврын тойм
- **DoD:** Admin сургууль/класс/даалгавар удирдана.

---

## ⚠️ Backend-д нэмэх боломжтой endpoint (gap)

Admin dashboard-д хэрэгтэй боловч одоо байхгүй байж болзошгүй:
- [ ] `GET /ai/usage` — AiUsage нэгтгэл/жагсаалт (зардал монитор) — admin
- [ ] `POST /users` (admin) — admin хэрэглэгч/багш шууд үүсгэх (одоо зөвхөн register)
- [ ] `GET /quizzes` admin филтр (бэлэн байж магадгүй — шалгах)
- [ ] Хичээл/сорилын **дэлгэрэнгүй статистик** (хэдэн оюутан дуусгасан г.м)

> Эдгээрийг Phase-д хүрэхэд backend талд нэмнэ (Бишрэлт/Усухбаяр тохиролцоно).

---

## 🔐 Эрх (ROLES.md-ээс)

| Үйлдэл | admin | super_admin |
|---|:---:|:---:|
| Контент CRUD (үг/хичээл/сорил) | ✅ | ✅ |
| Хэрэглэгч жагсаалт/role/устгах | ✅ | ✅ |
| Монитор (AI зардал, Payments) | ✅ | ✅ |
| Plan limit тохируулах | ✅ | ✅ |
| **Бусад admin удирдах**, систем тохиргоо | ❌ | ✅ |

> `teacher` нь admin БИШ — өөрийн класс/оюутныг **teacher dashboard**-аар (тусдаа).

---

## 🌿 Git workflow

- Backend-тэй ижил: өөрийн branch (`usukhbayar`/`bishrelt` эсвэл `feature/admin-*`)
  → PR → review → `main`. `main` руу шууд push хийхгүй.
- `admin/.env` (`VITE_API_URL`) commit хийхгүй — `.env.example` болго.

---

## 📌 Дараагийн алхам

1. Технологи сонгох (Refine vs React-Admin vs shadcn)
2. **Phase A0** (scaffold + login + layout)
3. **Phase A1 — Words CRUD**-аас эхлэх (хамгийн энгийн, backend бэлэн)
4. Дараа нь Lessons → Quizzes → Users → монитор
