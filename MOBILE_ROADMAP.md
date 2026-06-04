# EnglishXP — Mobile App Roadmap (Frontend)

React Native + Expo оюутны апп-ийн төлөвлөгөө. Backend (`/backend`) бэлэн тул
дэлгэц бүрийг **жинхэнэ API endpoint**-той холбоно. Зарчим: MVP эхэнд, дараа нь
scale. Монгол хэл primary.

> Тэмдэглэгээ: `[x]` дууссан · `[~]` хийгдэж байгаа · `[ ]` хийгээгүй
> Backend roadmap: `ROADMAP.md` · Дүрэм: `CLAUDE.md`

---

## 🎨 Дизайн

- Дизайны жишээ (mockup)-ийг үндэслэнэ — өнгө, фонт, layout түүнээс авна.
- Зураг нэмэгдсэн үед энд линк/замыг тэмдэглэнэ: `_(дизайн нэмэгдээгүй)_`
- Cyrillic-safe фонт ашиглана (CLAUDE.md) — кирилл бүрэн дэмждэг (ж: Inter, Manrope).

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

## 🎯 Phase M0 — Foundation `[ ]`

- [ ] Expo + TypeScript төсөл (`/mobile`) үүсгэх
- [ ] Folder бүтэц + theme/фонт (Cyrillic-safe) + i18n (mn/en)
- [ ] `api/client.ts` — fetch wrapper, baseUrl env-ээс, Bearer token автомат,
      алдааг стандарт хэлбэрээр
- [ ] `AuthContext` — login/logout, token-г secure-store-д, `/auth/me` сэргээх
- [ ] Expo Router navigation: auth stack ↔ tabs (нэвтэрсэн эсэхээр салгах)
- **DoD:** Апп асаж, нэвтрээгүй бол login руу, токентой бол tabs руу чиглүүлнэ.

## 🎯 Phase M1 — Auth дэлгэцүүд `[ ]`

- [ ] **Login** дэлгэц → `POST /api/auth/login` → token хадгалах
- [ ] **Register** дэлгэц → `POST /api/auth/register`
      (нэр, имэйл, нууц үг + аймаг/дүүрэг picker — `MN_PROVINCES`/`UB_DISTRICTS`)
- [ ] Алдаа/loading төлөв, validation (нууц үг ≥6)
- **DoD:** Шинэ хэрэглэгч бүртгүүлж, нэвтэрч, апп руу орно.

## 🎯 Phase M2 — Үндсэн суралцах дэлгэцүүд `[ ]`

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

## 🎯 Phase M3 — Gamification UI `[ ]`

- [ ] **Leaderboard** — `GET /api/leaderboard?period=&scope=`
      (weekly/monthly/all-time таб + global/аймаг/дүүрэг/класс scope), миний байр
- [ ] **Profile** — мэдээлэл, `PATCH /api/users/me` (нэр, аймаг/дүүрэг засах)
- [ ] **Sparks store / хичээл нээх** — `POST /api/lessons/:id/unlock`
      (Spark хүрэлцэхгүй бол мессеж)
- **DoD:** Оюутан рейтингээ, профайлаа харж, Spark-аар хичээл нээнэ.

## 🎯 Phase M4 — Өнгөлгөө `[ ]`

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
