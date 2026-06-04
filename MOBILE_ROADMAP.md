# EnglishXP — Mobile App Roadmap (Frontend)

React Native + Expo оюутны апп-ийн төлөвлөгөө. Backend (`/backend`) бэлэн тул
дэлгэц бүрийг **жинхэнэ API endpoint**-той холбоно. Зарчим: MVP эхэнд, дараа нь
scale. Монгол хэл primary.

> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж байгаа · `[ ]` хийгээгүй
> Backend roadmap: `ROADMAP.md` · Дүрэм: `CLAUDE.md`

---

## 🎨 Дизайн / Брэнд — **SparkXP** 🦊

Лого: гүйж буй үнэг + очирхон. Брэнд өнгө (`src/theme/theme.ts`):

- **Улбар шар** `#F47B20` — primary, XP, гол товч (үнэг + "XP")
- **Навигатор хөх** `#182547` — гарчиг, текст ("Spark" + сарвуу)
- **Цөцгий** `#FBF4E6` — дулаан гадаргуу · **Амбер** `#FFB020` — Очирхон
- Уриа: "Суралц • Дадлага хий • Амжилтанд хүр"

> Жинхэнэ логог `mobile/assets/logo.png`-д хийвэл `src/components/Logo.tsx`-ийн
> текст wordmark-ийг `<Image>`-ээр солино. Одоо 🦊 + "SparkXP" текстээр.
> Фонт: системийн (кирилл дэмждэг); дизайн фонт сонгвол theme-д нэмнэ.

---

## 👥 Ажлын хуваарь (хэн · аль branch)

Бид 2 dev. **Mobile-ийн дэлгэцүүдийг өөрсдийн бичсэн backend-тэй нь тааруулж**
хуваасан (Усухбаяр: Words/Lessons/SRS/Leaderboard · Бишрэлт: Quiz/AI/Sparks).

| Үе шат / дэлгэц | Хэн | Backend (бэлэн) |
| --- | --- | --- |
| **M0 Foundation** (scaffold, API client, AuthContext, navigation) | 👤 **Усухбаяр** (эхэнд) | — |
| M1 Auth (login/register) | 👤 Усухбаяр | `/auth/*` |
| M2 Home/Dashboard | 👤 Усухбаяр | `/users/me/stats` |
| M2 Vocabulary / Review (SRS) | 👤 Усухбаяр | `/reviews/*` |
| M2 Lessons (list + detail) | 👤 Усухбаяр | `/lessons/*` |
| M2 Quiz | 👤 **Бишрэлт** | `/quizzes/:id/submit` |
| M2 AI buddy chat | 👤 **Бишрэлт** | `/ai/chat` |
| M3 Leaderboard | 👤 Усухбаяр | `/leaderboard` |
| M3 Profile (засах) | 👤 **Бишрэлт** | `/users/me` |
| M3 Sparks store / хичээл нээх | 👤 **Бишрэлт** | `/lessons/:id/unlock` |
| M4 Өнгөлгөө | 👥 хамт | — |

### Branch урсгал (mobile)

1. **M0 Foundation эхэнд** — Усухбаяр одоогийн **`mobile`** branch дээр барина →
   дуусаад PR `mobile` → `main` → merge. (Бусад бүх дэлгэц үүн дээр суурилна.)
2. **M0 main-д орсны дараа** — хүн бүр backend-тэй ижил урсгалаар, **өөрийн
   branch** дээр өөрийн дэлгэцүүдээ барина:
   - Усухбаяр → `usukhbayar` branch
   - Бишрэлт → `bishrelt` branch
3. Ажил эхлэхийн өмнө: `git checkout main && git pull origin main`, дараа нь
   `git checkout <өөрийн-branch> && git merge main`.
4. Дэлгэц/бүлэг дуусах бүрт PR → нөгөө dev review → `main`. `main` руу шууд push❌.

> Зөвлөмж: эхлээд Усухбаяр M0-г дуусгаж merge хийтэл Бишрэлт хүлээнэ (foundation
> хэрэгтэй). M0 орсны дараа хоёулаа **зэрэг** ажиллана (өөр өөр дэлгэц = өөр файл).

---

## 🧰 Технологийн сонголт (MVP default)

| Зүйл | Сонголт | Шалтгаан |
| --- | --- | --- |
| Framework | **Expo (managed) + TypeScript** | Хурдан эхлэх, OTA, build амар |
| Navigation | **Expo Router** (file-based) | Орчин үеийн default, гүн линк |
| Серверийн өгөгдөл | **TanStack Query** (эсвэл энгийн fetch+Context) | Cache, loading/error амар |
| Auth token | **expo-secure-store** | JWT-г найдвартай хадгална |
| State | **React Context** (auth/user) | MVP-д хангалттай |
| Хэл (i18n) | Энгийн `t()` + strings файл, **MN primary** | Хоёр хэл |
| Styling | `StyleSheet` + theme constants | Энгийн, junior уншина |
| HTTP | `fetch` wrapper (Bearer token автомат) | Нэг газар |

> `EXPO_PUBLIC_API_URL` орчны хувьсагчаар backend хаягийг тохируулна
> (dev: `http://localhost:3000/api`, утсан дээр LAN IP).

---

## 📁 Төлөвлөж буй бүтэц

```
mobile/
  app/                  Expo Router дэлгэцүүд
    (auth)/login.tsx, register.tsx
    (tabs)/index.tsx (Home), learn.tsx, leaderboard.tsx, profile.tsx
    lesson/[id].tsx, quiz/[id].tsx, review.tsx, chat.tsx
  src/
    api/client.ts       fetch wrapper (token, baseUrl, алдаа)
    api/*.ts            endpoint бүлгүүд (auth, words, lessons, ...)
    auth/AuthContext.tsx
    i18n/               mn.ts (primary), en.ts
    theme/              өнгө, фонт, spacing
    components/         дахин ашиглах UI (Button, Card, XPBadge, ...)
```

---

## 🎯 Phase M0 — Foundation `[x]` — 👤 Усухбаяр ✅

- [x] Expo (SDK 56) + TypeScript төсөл (`/mobile`) + Expo Router
- [x] Folder бүтэц (`app/`, `src/api|auth|i18n|theme`) + theme + i18n (mn primary)
- [x] `api/client.ts` — fetch wrapper, `EXPO_PUBLIC_API_URL`, Bearer token, ApiError
- [x] `AuthContext` — login/register/logout, token-г secure-store-д, `/auth/me` сэргээх
- [x] Expo Router auth gate: нэвтрээгүй→login, токентой→tabs (автомат redirect)
- [x] Минимал Login + Home (XP/Sparks, logout) дэлгэц
- **DoD:** ✅ Апп асаж, auth gate ажиллаж байна. tsc typecheck цэвэр.
  > Theme өнгө/фонт нь placeholder — дизайн ирэхэд тааруулна.

## 🎯 Phase M1 — Auth дэлгэцүүд `[x]` — 👤 Усухбаяр ✅

- [x] **Login** дэлгэц → `POST /api/auth/login` → token хадгалах (брэнд UI)
- [x] **Register** дэлгэц → `POST /api/auth/register`
      (нэр, имэйл, нууц үг + аймаг/дүүрэг picker — UB-д дүүрэг харагдана)
- [x] Алдаа/loading төлөв, login↔register холбоос
- [x] Дахин ашиглах компонент: `Logo`, `Button`, `TextField`, `SelectField`
- **DoD:** ✅ Шинэ хэрэглэгч бүртгүүлж, нэвтэрч, апп руу орно. tsc цэвэр.
  > Home-г бас брэндээр шинэчилсэн (XP/Sparks карт, "Өнөөдрийн зорилго").

## 🎯 Phase M2 — Үндсэн суралцах дэлгэцүүд `[ ]` — 👤 Усухбаяр + Бишрэлт

- [ ] **Home/Dashboard** — XP/Sparks (`GET /api/users/me/stats`), өнөөдрийн
      давтах үг тоо, товч цэс
- [ ] **Vocabulary / Review** — `GET /api/reviews/due` → карт эргүүлэх →
      `POST /api/reviews/:wordId {quality 0-5}` (Again/Hard/Good/Easy товч)
- [ ] **Lessons** жагсаалт — `GET /api/lessons` (type/level филтр)
- [ ] **Lesson detail** — `GET /api/lessons/:id`, түгжээтэй бол үнэ (priceSparks)
      харуулах; `GET /api/lessons/:id/access`-ээр нээгдсэн эсэхийг шалгах
- [ ] **Quiz** — асуулт харуулах → `POST /api/quizzes/:id/submit` → оноо + XP
- [ ] **AI buddy chat** — `POST /api/ai/chat` (текст), түүх харуулах
- **DoD:** Оюутан үг давтаж, хичээл үзэж, quiz өгч, AI-тай ярина.

## 🎯 Phase M3 — Gamification UI `[ ]` — 👤 Усухбаяр + Бишрэлт

- [ ] **Leaderboard** — `GET /api/leaderboard?period=&scope=`
      (weekly/monthly/all-time таб + global/аймаг/дүүрэг/класс scope), миний байр
- [ ] **Profile** — мэдээлэл, `PATCH /api/users/me` (нэр, аймаг/дүүрэг засах)
- [ ] **Sparks store / хичээл нээх** — `POST /api/lessons/:id/unlock`
      (Spark хүрэлцэхгүй бол мессеж)
- **DoD:** Оюутан рейтингээ, профайлаа харж, Spark-аар хичээл нээнэ.

## 🎯 Phase M4 — Өнгөлгөө `[ ]` — 👥 хамт

- [ ] Voice AI товч — "Тун удахгүй" (coming soon, CLAUDE.md)
- [ ] Loading skeleton, empty/error state бүх дэлгэцэд
- [ ] Pull-to-refresh, offline сэрэмжлүүлэг
- [ ] App icon, splash screen, нэр
- **DoD:** Апп бүрэн, гацахгүй, алдаа найрсаг харагдана.

---

## 🔁 Дүрэм (CLAUDE.md-ээс)

- Монгол хэл primary, англи secondary. Cyrillic-safe фонт.
- AI зөвхөн backend AI Gateway-аар (апп шууд AI API дуудахгүй).
- Контентыг hardcode хийхгүй — API-аас татна.
- Энгийн, junior уншиж ойлгох код.

## 🌿 Git workflow (ROADMAP.md-тэй ижил)

- `mobile` branch дээр ажиллаж, дуусах бүрт PR → review → `main`.
- `main` руу шууд push хийхгүй.

---

## 📌 Дараагийн алхам

1. **Дизайнаа надад үзүүл** (зам/зураг) → theme (өнгө/фонт) гаргана.
2. **Phase M0** (Expo scaffold + foundation) барина.
3. Дараа нь M1 (auth дэлгэц) → M2 (суралцах) → M3 (gamification).
