# Хүсэлт (Choi → Өсөхбаяр): C4 (guest/taste-task) + IELTS 3a endpoint-ууд

**Огноо:** 2026-07-21 · **Хэсэг:** `backend/src` (шинэ модулиуд) · **Ач холбогдол:** Дунд
(launch blocker C4 + IELTS mobile-ыг эхлүүлэхэд эдгээр endpoint шаардлагатай)

> Mobile (`/mobile`) тал **бэлэн болмогц** би FE-г нь барина. Одоо эдгээр endpoint
> байхгүй тул FE-г эхлүүлэх боломжгүй. Доор яг юу хэрэгтэйг тодорхойлов.

---

## 1. C4 — Taste-task онбординг + guest mode

**Зорилго:** Хэрэглэгч **бүртгүүлэхээсээ өмнө** аппын үнэ цэнийг мэдрэх — 1–2 жижиг
дасгал хийж, бага зэрэг XP аваад, дараа нь бүртгүүлэхэд тэр ахиц нь **хадгалагдана**.

### 1a. Public sample контент (auth-гүй)
| Method + Path | Auth | Зорилго | Хариу |
| --- | --- | --- | --- |
| `GET /public/onboarding-sample` | **Public** (guard-гүй) | Онбордингийн taste-task-д зориулсан бага хэмжээний контент (жишээ 3–5 үг + 1 богино quiz). Нэвтрэлгүй хандана. | `{ words: Word[], quiz: Quiz }` (одоо байгаа Word/Quiz бүтэцтэй) |

- `main.ts`-ийн global JWT guard-аас **чөлөөлөх** хэрэгтэй (`@Public()` декоратор эсвэл
  тусдаа controller). `GET /words` public байгаа шиг.
- Контент нь DB-ээс (админ тусгайлан `isSample`/`tag` тэмдэглэсэн, эсвэл эхний
  нийтэлсэн хэдэн үг/quiz). Хатуу кодлохгүй (core rule).

### 1b. Guest ахицыг данс руу шилжүүлэх
Guest үед FE нь XP/зөв хариултын тоог **локалаар** барина. Бүртгүүлэхэд backend руу
дамжуулж, нэг удаа кредит болгоно.

| Method + Path | Auth | Зорилго | Body |
| --- | --- | --- | --- |
| `POST /users/me/onboarding-claim` | JWT | Онбордингийн бонус XP-г **нэг удаа** (idempotent per user) олгох. Давхар дуудвал дахин олгохгүй. | `{ xp?: number, correctCount?: number }` → `{ xpAwarded, alreadyClaimed }` |

- Эсвэл `POST /auth/register` / `POST /auth/verify-otp` body-д optional `guestXp`
  нэмээд verify хийхэд кредит болгож болно — аль нь танд тохирно.
- XpLog-д `XpSource.ONBOARDING` (шинэ) эсвэл байгаа source-оор бичих.

---

## 2. IELTS 3a — Listening / Reading runner (band харуулах)

**Зорилго:** `/ielts` hub → IELTS Listening/Reading тестүүд → асуулт хийж, **band
score** (0–9) харуулах. Backend-ийн **IELTS Plan 2 (admin authoring)**-д тулгуурлана.

| Method + Path | Auth | Зорилго | Params / Body |
| --- | --- | --- | --- |
| `GET /ielts/tests` | JWT | IELTS тестийн жагсаалт (шүүлттэй) | query `skill=listening\|reading`, `limit`, `page` → `[{ id, title, skill, sectionCount, questionCount, level? }]` |
| `GET /ielts/tests/:id` | JWT | Нэг тестийн бүрэн контент (Listening = audio URL(ууд) + асуулт; Reading = passage(ууд) + асуулт). Зөв хариу **нуугдана**. | path `id` → `{ id, title, skill, audioUrl?, passages?, questions: [...] }` |
| `POST /ielts/tests/:id/submit` | JWT | Хариу шалгаж **band** тооцох (raw→band mapping backend дээр) + XP олгох | `{ answers: [...] }` → `{ correct, total, band, breakdown }` |

**Тэмдэглэл:**
- Band-ыг **backend дээр** тооцох (raw score → IELTS band хөрвүүлэлт нь тестийн
  урттай холбоотой; FE дээр хатуу кодлохгүй).
- Асуултын төрөл: MCQ, gap-fill, matching г.м. — одоогийн `Quiz.questions` jsonb
  бүтцийг дахин ашиглаж болвол хамгийн хялбар.
- Writing/Speaking (Plan 3b) нь **Boju**-гийн хэсэг — энэ хүсэлтэд ороогүй.

---

## Дараа нь (mobile тал)
Эдгээр гармагц би:
- **C4:** taste-task онбординг дэлгэц + guest mode + бүртгэлийн дараах claim.
- **IELTS 3a:** `/ielts` hub + Listening/Reading runner + band үр дүнгийн дэлгэц.

`API.md`-д нэмсний дараа mobile `src/api/`-д client функц бичээд FE-г барина.
