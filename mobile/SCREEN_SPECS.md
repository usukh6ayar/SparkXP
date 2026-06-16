# SparkXP — Дэлгэц бүрийн Requirement (Screen Specs)

> Оюутны mobile аппын **дэлгэц тус бүрийн** дэлгэрэнгүй шаардлага. Figma mockup +
> RN код хийхэд барих лавлах. Хослуулж унших: `DESIGN_BRIEF.md` (ерөнхий),
> `DESIGN_SYSTEM.md` (token/компонент), `API.md` (endpoint).
>
> Тэмдэглэгээ: 🔑 = нэвтэрсэн байх шаардлагатай · бүх дата дэлгэцэд
> **loading / empty / error** state заавал.

---

## Дэлгэцийн зураглал (navigation map)

```
(auth)
  Onboarding → Login ⇄ Register → [app]
(tabs)   ← доод TabBar: Нүүр · Хичээл · [AI Найз төв] · Сорил · Профайл
  Нүүр (Home)
    → Lessons (?type=) → Lesson detail → Quiz
    → Swipe (үг сурах)
  Хичээл (Lessons)
  Сорил (Soril)
  AI Найз (Chat)
  Профайл (Profile) → Leaderboard · Profile засах
Review (SRS), Swipe, Leaderboard, Lesson detail, Quiz = stack (tab-аас гадуур)
```

---

## 1. Onboarding 🆕

**Зорилго:** Анх нээсэн хэрэглэгчид аппыг танилцуулж, бүртгэл рүү залгах.

**Дата:** API байхгүй. "Үзсэн" төлөвийг `expo-secure-store`/AsyncStorage-д хадгална
(дахин харуулахгүй).

**UI бүрэлдэхүүн:**
- 2–3 слайд (swipe эсвэл dots): үнэг mascot зураг + `h1` гарчиг + `body` тайлбар.
  - Слайд 1: "Англи хэлийг тоглож сур" · 2: "XP цуглуул, түвшингээ ах­иулаа" · 3: "AI найзтайгаа дадлага хий".
- Доод хэсэг: `Дараах` (эсвэл dots) → сүүлд `Эхлэх` (primary Button).
- Дээд баруун: `Алгасах` (ghost).

**Үйлдэл:** `Эхлэх`/`Алгасах` → Register. Доор "Бүртгэлтэй юу? **Нэвтрэх**" → Login.

**DoD:** Анх 1 удаа л харагдана. Дараа нь шууд Login/app руу.

---

## 2. Login

**Зорилго:** Бүртгэлтэй хэрэглэгч нэвтрэх.

**Дата:** `POST /api/auth/login { email, password }` → `{ token, user }`.
Token-г secure-store-д, `AuthContext`-д user.

**UI бүрэлдэхүүн:**
- Лого + `h1` "Тавтай морил".
- `TextField` имэйл (email keyboard, autocapitalize off).
- `TextField` нууц үг (secure, "нүд" toggle).
- `Button` primary "Нэвтрэх" (loading spinner).
- `FormError` (буруу мэдээлэл → "Имэйл эсвэл нууц үг буруу").
- Доор: "Бүртгэлгүй юу? **Бүртгүүлэх**" → Register.

**Төлөв:** input хоосон → товч disabled · loading · 401 error мессеж.

**DoD:** Зөв мэдээллээр нэвтэрч tabs руу орно. Алдаа найрсаг.

---

## 3. Register

**Зорилго:** Шинэ оюутан бүртгүүлэх (default role = student).

**Дата:** `POST /api/auth/register { fullName, email, password, province?, district? }`
→ `{ token, user }` (шууд нэвтэрнэ).

**UI бүрэлдэхүүн:**
- `h1` "Бүртгүүлэх".
- `TextField`: бүтэн нэр · имэйл · нууц үг (доод хязгаар шалгах).
- `SelectField` аймаг/хот (`MN_PROVINCES`). Улаанбаатар сонгвол → `SelectField` дүүрэг (`UB_DISTRICTS`).
- `Button` primary "Бүртгүүлэх".
- Доор: "Бүртгэлтэй юу? **Нэвтрэх**".

**Төлөв:** validation (нэр/имэйл/нууц үг шаардлага) · имэйл давхцвал error · loading.

**DoD:** Шинэ хэрэглэгч бүртгүүлж шууд app руу. Байршил leaderboard-д хэрэглэгдэнэ.

---

## 4. Home / Dashboard 🔑

**Зорилго:** Өдрийн эхлэл — прогресс, өдрийн зорилго, сурах замууд.

**Дата:** `GET /users/me/stats` → `{ xp, sparks }` · `GET /reviews/due` → давтах үгийн тоо.
Pull-to-refresh-д дахин ачаална.

**UI бүрэлдэхүүн:**
- **TopBar:** streak 🔥 + Sparks badge (баруун).
- **Мэндчилгээ:** `h1` "Сайн уу, {нэр} 👋" + `body` дэд мөр.
- **Hero карт** (`ink` хар): streak chip + өдрийн зорилго гарчиг + дэд + CTA Button
  (due > 0 → "Давтаж эхлэх" → Swipe; үгүй → "Үг сурах").
- **Stat мөр:** 3 `StatCard` — XP (алт) · Очирхон (cyan) · Цуврал (flame).
- **"Юу сурах вэ?"** `SectionHeader` + 2-багана grid 4 чадвар:
  Сонсгол`listening` · Унших`reading` · Нөхөх`fill` · Бичих`writing`
  → дарахад `Lessons?type=`.

**Төлөв:** stats ачаалж байх үед session-ийн утга харуулна (анивчихгүй) · алдаа → сүүлийн утга.

**DoD:** Оюутан XP/Sparks/Streak-ээ хараад, 1 товшилтоор сурч эхэлнэ.

---

## 5. Lessons (жагсаалт) 🔑

**Зорилго:** Хичээлүүдийг (заавал чадвараар шүүж) үзэх.

**Дата:** `GET /lessons?type=&level=&isPublished=true&limit=50` → `{ items }`.
`type` нь Home grid-ээс ирнэ (`useLocalSearchParams`).

**UI бүрэлдэхүүн:**
- **TopBar:** гарчиг = скиллийн нэр (type байвал) эсвэл "Хичээлүүд", back.
- (Сонголт) дээд level chip шүүлт (A1–C2).
- **Хичээл карт** (давтан): дугаарласан tint thumb (№) + `h3` гарчиг +
  `caption` тайлбар + level Pill + (`priceSparks>0` → 🔒 + үнэ Pill; үгүй → "Үнэгүй" + chevron).

**Төлөв:** loading skeleton · empty ("{Скилл}-ийн хичээл удахгүй нэмэгдэнэ 🦊") · error.

**Үйлдэл:** карт дарах → `Lesson detail`.

**DoD:** Чадвараар шүүгдсэн жагсаалт, түгжээ/үнэ тодорхой.

---

## 6. Lesson detail 🔑

**Зорилго:** Нэг хичээлийн агуулга үзэх, түгжээтэй бол Spark-аар нээх.

**Дата:** `GET /lessons/:id` · `GET /lessons/:id/access` → `{ hasAccess }` ·
`POST /lessons/:id/unlock` (нээх) · холбоотой quiz: `GET /quizzes?lessonId=`.

**UI бүрэлдэхүүн:**
- **TopBar** back + гарчиг.
- Толгой: `h1` гарчиг · level Pill · type Pill.
- **Контент** (`content` jsonb, type-аас хамаарч):
  - listening → аудио тоглуулагч (одоо "тун удахгүй") + текст
  - reading → текст блок
  - fill → нөхөх дасгал (хоосон зай)
  - writing/vocabulary → notes/үгс
- Түгжээтэй (`!hasAccess && priceSparks>0`): **unlock sheet** — үнэ + Sparks
  үлдэгдэл + "Нээх" Button (хүрэлцэхгүй → disabled + мессеж).
- Доор: "Тест өгөх" Button → холбоотой `Quiz`.

**Төлөв:** loading · unlock loading · Spark дутвал alert · нээгдсэн → контент.

**DoD:** Үнэгүй хичээл шууд нээгдэнэ; төлбөртэйг Spark-аар нээж байнга хандана.

---

## 7. Review (SRS — давтах) 🔑

**Зорилго:** Хугацаа нь болсон үгсийг SM-2-оор давтах.

**Дата:** `GET /reviews/due` → `[{ id, wordId, word{english,mongolian,exampleSentence} }]` ·
`POST /reviews/:wordId { quality 0–5 }`.

**UI бүрэлдэхүүн:**
- **TopBar** back + ProgressBar (давтсан/нийт).
- **Үгийн карт:** урд = english (`display`) → дарж эргүүлэх → mongolian + жишээ өгүүлбэр.
- **4 үнэлгээ товч** (эргүүлсний дараа): **Again**(0) · **Hard**(3) · **Good**(4) · **Easy**(5)
  — өнгөөр (улаан/амбер/ногоон/индиго). Дарвал submit → дараагийн үг.

**Төлөв:** loading · бүгд дууссан → "Өнөөдрийн давталт дууслаа 🎉" + XP/тоо + "Нүүр рүү".

**DoD:** quality илгээхэд дараагийн давталтын огноо зөв (1→6→16 өдөр), буруунд reset.

---

## 8. Swipe (үг сурах) 🔑

**Зорилго:** Шинэ үг Tinder-style картаар сурах.

**Дата:** `GET /reviews/learn` → `[{ id, english, mongolian, exampleSentence }]` ·
баруун шудрах = `markKnown` (quality 5).

**UI бүрэлдэхүүн:**
- **TopBar** back + ProgressBar (мэдсэн/нийт) + "{known} мэдсэн · {left} үлдсэн".
- **Карт стек:** одоогийн (drag/rotate) + дараагийн peek. Дарж эргүүлэх (english↔mongolian+жишээ).
  Баруун шудрах → "МЭДНЭ" badge (ногоон), зүүн → "МЭДЭХГҮЙ" (улаан, ард ордог).
- **3 товч:** ✗ (мэдэхгүй) · ↺ (эргүүлэх) · ✓ (мэднэ).

**Төлөв:** loading · дек хоосон → "Бүх үгийг мэдлээ! 🎉" + тоо + "Нүүр рүү".

**DoD:** Баруун шудрах үгийг known болгож устгана; зүүн нь арын ээлжинд.

---

## 9. Soril / Games 🔑

**Зорилго:** Хөгжилтэй дасгал тоглоомууд (одоо "тун удахгүй").

**Дата:** одоохондоо API байхгүй (placeholder). Дараа quiz/exercise-тэй холбоно.

**UI бүрэлдэхүүн:**
- `h1` "Сорил & тоглоом" + дэд.
- 2-багана тоглоом карт (IconTile + `h3` + `caption` + XP Pill): Үг таах · Сонсох ·
  Дүрэм · Хурдан хариулт · Холбох · Дүүргэх.
- **Өдрийн сорил** хар карт: ProgressBar (x/3) + нэмэлт XP урамшуулал.

**Үйлдэл:** карт дарах → одоо alert "Тун удахгүй". Дараа → тоглоомын дэлгэц.

**DoD:** Бүтэц бэлэн, "coming soon" найрсаг.

---

## 10. Quiz 🔑

**Зорилго:** Хичээлийн сорил өгч оноо + XP авах.

**Дата:** `GET /quizzes/:id` → `{ questions[] }` (`correct`/`answer` сервер талд нуугдсан) ·
`POST /quizzes/:id/submit { answers:[{questionIndex, answer}] }` →
`{ score, total, percentage, passed, xpEarned, breakdown[] }`.

**UI бүрэлдэхүүн:**
- **TopBar** back + ProgressBar (асуулт x/n).
- **Асуулт** (`h2`). Төрлөөр:
  - `multiple_choice` → сонголт радио карт (сонгосон=индиго).
  - `fill_blank` → `TextField` хариу.
- Доод `Button` "Дараах" / сүүлд "Дуусгах".
- **Үр дүн дэлгэц:** оноо (`display`) + хувь + passed badge + **+XP** + асуулт бүрийн
  breakdown (зөв/буруу) + "Дахин" / "Хичээл рүү".

**Төлөв:** хариу сонгоогүй → товч disabled · submit loading · алдаа.

**DoD:** Илгээхэд оноо/XP буцаж, XpLog-д мөр (anti-abuse: зөвхөн зөв хариунаас XP).

---

## 11. AI Найз (chat) 🔑

**Зорилго:** Текст AI tutor-тай англи дадлага хийх.

**Дата:** `POST /ai/chat { message, conversationId? }` → `{ reply, conversationId }`.
Бүх AI зөвхөн backend **AI Gateway**-аар (limit/log/cost). Voice = "тун удахгүй".

**UI бүрэлдэхүүн:**
- **TopBar** "AI Найз" + badge.
- **Дүр сонголт** (хэвтээ): Спарк🦊(идэвхтэй) + бусад (түгжээтэй "тун удахгүй").
  Идэвхтэйг дарвал шинэ яриа эхэлнэ.
- **Bubble жагсаалт:** AI = surface (зүүн, үнэг avatar) · user = индиго (баруун).
- **Empty state:** үнэг + "Сайн уу! Би Спарк 👋".
- **Input bar:** 🎤 (тун удахгүй) + multiline TextField + илгээх (↑).
- AI бичиж байх үед "Спарк бичиж байна..." indicator.

**Төлөв:** илгээх loading · алдаа → "Дахин оролдоорой" bubble · limit хэтрэх → мессеж.

**DoD:** Хариу авч, түүх хадгалагдаж (`Message`), AiUsage-д бүртгэгдэнэ.

---

## 12. Leaderboard 🔑

**Зорилго:** XP-ээр өрсөлдөж байрлалаа харах.

**Дата:** `GET /leaderboard?period=&scope=` → `{ entries[], me{rank,xp} }`.
period: weekly/monthly/all_time · scope: global/province/district/class/organization.

**UI бүрэлдэхүүн:**
- **TopBar** "Тэргүүлэгчид" back.
- **Segmented:** хугацаа (Долоо хоног/Сар/Бүх цаг).
- **Chip:** scope (Глобал/Аймаг/Дүүрэг).
- **"Миний байр"** хар карт: rank + нэр + XP.
- **Жагсаалт мөр:** rank badge (top3 = алт/мөнгө/хүрэл) + avatar + нэр + ⚡XP.
  Өөрийн мөр oncлоно. (Та) тэмдэг.

**Төлөв:** loading · дата алга ("Энэ хугацаанд дата алга 🦊") · error.

**DoD:** weekly/monthly/all-time × scope-оор зөв эрэмбэ + миний байр.
> Рейтинг = **XP** (Sparks-аар БИШ).

---

## 13. Profile 🔑

**Зорилго:** Хувийн мэдээлэл, статистик, амжилт, тохиргоо.

**Дата:** `AuthContext` user · `GET /reviews/stats` → `{ known }` ·
`PATCH /users/me { fullName, province?, district? }` (засах).

**UI бүрэлдэхүүн:**
- **TopBar** "Профайл" + badge.
- **Толгой карт:** avatar (үнэг) + нэр + имэйл + level Pill + edit товч.
- **Stat мөр:** XP · Очирхон · Цуврал (`StatCard`).
- **"Мэдэх үг"** карт → дарж Swipe (`known` тоо).
- **Leaderboard banner** (хар) → Leaderboard.
- **Амжилтын тэмдэг** (хэвтээ): earned/locked badge.
- **Тохиргоо** ListRow: Хэл · Мэдэгдэл · Тусламж · Бидний тухай · **Гарах**.
- **Profile засах modal:** нэр + аймаг/дүүрэг → `PATCH /users/me`.

**Төлөв:** known ачаалж байх · засах loading/амжилт/алдаа · гарах баталгаажуулалт.

**DoD:** Оюутан мэдээлэл/статистикаа хараад, нэр/байршлаа засна.

---

## Бүх дэлгэцэд нийтлэг шаардлага (Definition of Done)

- [ ] **State 3-ул:** loading (skeleton/spinner) · empty (найрсаг) · error (дахин оролдох).
- [ ] **Дата:** зөвхөн `src/api/` дамжуулан (raw fetch screen дотор үгүй).
- [ ] **UI:** зөвхөн `theme` token + `src/components/` (hardcode hex/spacing үгүй).
- [ ] **Текст:** `src/i18n` (Монгол primary). Cyrillic урт үг wrap зөв.
- [ ] **Accessibility:** контраст ≥4.5:1, hit ≥44px.
- [ ] **Responsive:** SE → Pro Max эвдрэхгүй. Доод TabBar/notch зайг хүндэтгэнэ.
- [ ] **Navigation:** back, deep-link (`/lesson/:id`, `/quiz/:id`) ажиллана.
