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

Бид 2 dev, тус бүр **нэг branch**-тай:

| Dev | Branch | Хариуцах дэлгэцүүд |
| --- | --- | --- |
| **Усухбаяр** | **`usukhbayar`** | Auth · Home · Review(SRS) · Lessons · Leaderboard |
| **Бишрэлт** | **`bishrelt`** | Quiz · AI chat · Profile · Sparks store |

Дэлгэцүүдийг **өөрсдийн бичсэн backend-тэй нь тааруулж** хуваасан.
**Foundation (M0) бэлэн, `main`-д орсон тул хоёулаа ОДОО зэрэг эхэлж болно.**

| Дэлгэц | Хэн | Branch | Backend | Төлөв |
| --- | --- | --- | --- | --- |
| M0 Foundation | Усухбаяр | — | — | ✅ main-д |
| M1 Login / Register | Усухбаяр | `usukhbayar` | `/auth/*` | ✅ main-д |
| M2 Home/Dashboard | Усухбаяр | `usukhbayar` | `/users/me/stats` | ✅ main-д (XP/Sparks карт) |
| M2 Review (SRS) | Усухбаяр | `usukhbayar` | `/reviews/*` | ⬜ дараагийнх |
| M2 Lessons (list+detail) | Усухбаяр | `usukhbayar` | `/lessons/*` | ⬜ |
| M3 Leaderboard | Усухбаяр | `usukhbayar` | `/leaderboard` | ⬜ |
| M2 Quiz | Бишрэлт | `bishrelt` | `/quizzes/:id/submit` | ✅ bishrelt-д |
| M2 AI buddy chat | Бишрэлт | `bishrelt` | `/ai/chat` | ✅ bishrelt-д |
| M3 Profile (засах) | Бишрэлт | `bishrelt` | `/users/me` | ✅ bishrelt-д |
| M3 Sparks store / нээх | Бишрэлт | `bishrelt` | `/lessons/:id/unlock` | ✅ bishrelt-д |
| M4 Өнгөлгөө | 👥 хамт | — | — | ⬜ |

### Branch урсгал

1. **Ажил эхлэхийн өмнө** main-аас шинэчил:
   ```bash
   git checkout main && git pull origin main
   git checkout <usukhbayar | bishrelt>
   git merge main          # foundation + нөгөөгийн merge хийсэн ажлыг авна
   ```
2. Өөрийн branch дээр дэлгэцээ барина. **Дахин ашиглах UI → `src/components/`**
   (CLAUDE.md DRY дүрэм). Өнгө/текст → `theme`/`i18n`-ээс.
3. Дуусаад push → **PR** `<branch>` → `main` → нөгөө dev review → merge.
4. `main` руу **шууд push хийхгүй**.

> Хоёулаа өөр өөр дэлгэц (өөр файл) дээр ажиллах тул conflict бараг гарахгүй.
> Дундын файл `app/(tabs)/_layout.tsx`-д таб нэмэхэд бага зэрэг тааралдвал хоёр
> таб-ыг хоёуланг нь үлдээгээд шийднэ.

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

## 🎯 Phase M2 — Үндсэн суралцах дэлгэцүүд `[~]` — 👤 Усухбаяр + Бишрэлт

- [x] **Home/Dashboard** (👤 Усухбаяр) — XP/Sparks карт, "Өнөөдрийн зорилго"
      _(одоо session-ээс; M2-д `GET /api/users/me/stats`-аар live болгоно)_
- [ ] **Vocabulary / Review** — `GET /api/reviews/due` → карт эргүүлэх →
      `POST /api/reviews/:wordId {quality 0-5}` (Again/Hard/Good/Easy товч)
- [ ] **Lessons** жагсаалт — `GET /api/lessons` (type/level филтр)
- [ ] **Lesson detail** — `GET /api/lessons/:id`, түгжээтэй бол үнэ (priceSparks)
      харуулах; `GET /api/lessons/:id/access`-ээр нээгдсэн эсэхийг шалгах
- [x] **Quiz** — асуулт харуулах → `POST /api/quizzes/:id/submit` → оноо + XP — 👤 Бишрэлт ✅
- [x] **AI buddy chat** — `POST /api/ai/chat` (текст), түүх харуулах — 👤 Бишрэлт ✅
- [x] **Lesson detail** — `GET /api/lessons/:id` + `GET /api/lessons/:id/access` + unlock — 👤 Бишрэлт ✅
- **DoD:** Оюутан үг давтаж, хичээл үзэж, quiz өгч, AI-тай ярина.

## 🎯 Phase M3 — Gamification UI `[~]` — 👤 Усухбаяр + Бишрэлт

- [ ] **Leaderboard** — `GET /api/leaderboard?period=&scope=`
      (weekly/monthly/all-time таб + global/аймаг/дүүрэг/класс scope), миний байр — 👤 Усухбаяр
- [x] **Profile** — мэдээлэл, `PATCH /api/users/me` (нэр, аймаг/дүүрэг засах) — 👤 Бишрэлт ✅
- [x] **Sparks store / хичээл нээх** — `POST /api/lessons/:id/unlock`
      (Spark хүрэлцэхгүй бол мессеж) — 👤 Бишрэлт ✅
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

- Усухбаяр → `usukhbayar` branch · Бишрэлт → `bishrelt` branch.
- Дуусах бүрт PR → нөгөө dev review → `main`. `main` руу шууд push хийхгүй.

---

## 📌 Дараагийн алхам

✅ **Дууссан (main-д):** M0 Foundation · M1 Auth (login/register) · Home ·
SparkXP брэнд theme · дахин ашиглах компонентууд.

✅ **Бишрэлт дууссан (`bishrelt` branch-д):** Quiz · AI chat · Profile · Lesson detail + unlock · API modules

**Одоо үлдсэн ажил:**

| Dev | Branch | Дараагийн дэлгэц |
| --- | --- | --- |
| **Усухбаяр** | `usukhbayar` | M2 **Review (SRS)** → Lessons жагсаалт → M3 Leaderboard |
| **Бишрэлт** | `bishrelt` | M4 Өнгөлгөө (skeleton, error state, pull-to-refresh) |

> Усухбаяр **Lessons жагсаалт** дэлгэц хийхдээ `app/lesson/[id].tsx` руу navigate хийвэл
> Бишрэлтийн lesson detail + unlock дэлгэц автоматаар ажиллана.
3. Дараа нь M1 (auth дэлгэц) → M2 (суралцах) → M3 (gamification).
