# Вэб төлбөр (byl.mn) — дизайн

- **Огноо:** 2026-10-14 · **Эзэн:** Өсөхбаяр (backend + admin + `SparkXP_web`)
- **Байр суурь:** Төлбөрийн ажлын **2-р дэд төсөл**. 1-р дэд төсөл = утас баталгаажуулалт
  (`2026-10-13-phone-verification-design.md`, PR #284 — prod дээр). Вэб дээр хэрэглэгч утсаараа нэвтэрнэ.

## 1. Зорилго ба хамрах хүрээ

Хэрэглэгч **маркетингийн вэб сайт** (`SparkXP_web`) дээр нэвтэрч, багцаа **Byl**-ээр (QPay, SocialPay,
карт, банкны шилжүүлэг) төлж авна. Апп эрхийг л харуулна.

**Яагаад вэб:** Apple/Google аппын доторх дижитал subscription-д өөрсдийн төлбөрийн системийг
шаарддаг. Захиалагчийн санхүүгийн тооцоо «App Store / Google Play шимтгэл 0₮» гэж авсан нь зөвхөн
төлбөр аппаас гадуур хийгдэхэд үнэн.

**Батлагдсан шийдвэрүүд**

| # | Шийдвэр |
|---|---|
| 1 | Essential (`standard`) 34k · Plus 56k · Premier 85k — **30 хоногийн нэг удаагийн эрх**. Автомат сунгалт байхгүй. |
| 2 | Идэвхтэй багцтай үед: **ижил багц → сунгана**; **өөр багц → өнөөдрөөс эхэлж, хуучны үлдсэн хоногийн үнэ цэнийг шинэ багцын хоног болгож нэмнэ.** |
| 3 | Byl **Checkout + `price_data`** — үнэ зөвхөн манай DB-д. Промо код → `discounts[]`. |
| 4 | **И-баримт энэ шатанд хамрахгүй.** Byl-ийн баримт НӨАТ-ын баримт биш; нягтлан админы CSV-ээс гараар гаргана. |
| 5 | Апп дотор худалдан авах товч, вэб рүү линк, «вэбээс аваарай» бичиг **огт байхгүй** (App Store anti-steering). |

**Хамрахгүй:** Byl Subscriptions (автомат сунгалт), Sparks багц, Family багц, и-баримт автоматжуулалт, буцаалт (refund) — админ гараар.

## 2. Byl — бидний ашиглах баримт

Эх сурвалж: https://byl.mn/docs (`api/checkouts`, `webhook`, `test-mode`, `payment-methods`).

- Бааз `https://byl.mn/api/v1`, `Authorization: Bearer <token>`, `Accept: application/json` (эс бөгөөс алдаа HTML-ээр ирнэ).
- `POST /projects/:id/checkouts` → `{ data: { id, url } }`. Бидний ашиглах талбар:
  `items: [{ price_data: { unit_amount, product_data: { name, client_reference_id: <plan slug> } }, quantity: 1 }]`,
  `discounts?: [{ amount, description }]`, `success_url`, `cancel_url`, `client_reference_id` (≤48, = манай `payment.id`),
  `email_collection: false`, `phone_number_collection: false`.
- `GET /projects/:id/checkouts/:checkout_id` — `status: open | pending | complete | expired`, `amount_total` (**тэмдэгт мөр**, decimal).
- Checkout өгөгдмөлөөр 2 сарын дараа хүчингүй болно.
- **Webhook:** `POST` манай URL руу, JSON `{ id, project_id, type, object, data: { object }, created_at }`.
  `checkout.completed` → `data.object` = checkout (`id`, `status: complete`, `amount_total`, `client_reference_id`, …).
  - Гарын үсэг: `Byl-Signature` header = `hex(HMAC-SHA256(secret, raw body))`; харьцуулахдаа constant-time.
  - **5 сек**-ийн дотор 2xx; үгүй бол backoff-оор ~4 хоног, 8 удаа дахин илгээнэ. Давхар ирж, дараалал алдагдаж болно.
  - 7 хоног тасралтгүй амжилтгүй бол endpoint автоматаар идэвхгүй болно.
- Банкны шилжүүлэг: `payment.awaiting_verification` нь төлөгдсөн гэсэн үг **биш** — мерчант баталгаажуулсны дараа ердийн `checkout.completed` ирнэ.
- **Test горим:** гүйлгээ бүр **тогтмол 100₮**. Live: бизнес баталгаажуулалт + Byl багц + үндсэн данс.
- Алдаа: 422 валидац / бизнес (`error` талбар), 503 тохиргоо (`missing_bank_account`, `valid_subscription_required`, `payment_method_error`…).
- QPay шимтгэл ~1% (Byl өөрөө гүйлгээнээс авдаггүй).

## 3. Backend

### 3.1 Файлууд

```
backend/src/payments/
  byl/byl.client.ts            createCheckout / getCheckout (fetch, 10 сек timeout)
  byl/byl-signature.ts         verifyBylSignature(rawBody, header, secret)
  plan-access.ts               planAccessAfterPurchase() — цэвэр функц
  payments.service.ts          quote / createCheckout / handleWebhook / findOne (+ одоогийн жагсаалтууд)
  payments.controller.ts       шинэ route-ууд; confirm устгана
  dto/                         CreatePaymentDto { planId, promoCode? }, QuoteDto
backend/src/migrations/<ts>-PlansMatchClientBrief.ts
```

### 3.2 Endpoint-ууд

| Method · Path | Auth | Тайлбар |
|---|---|---|
| `GET /payments/quote?planId=&promoCode=` | JWT | `{ planId, planName, price, discount, finalPrice, accessUntil }` — `accessUntil` нь `planAccessAfterPurchase`-аар |
| `POST /payments` | JWT + `PaymentsEnabledGuard` | `{ planId, promoCode? }` → `Payment(pending, provider 'byl')` → Byl checkout → `{ paymentId, checkoutUrl }` |
| `GET /payments/:id` | JWT (зөвхөн өөрийнх) | `{ id, status, planName, accessUntil? }` — вэбийн «амжилттай» хуудас асууна |
| `POST /payments/webhook/byl` | **Public**, гарын үсэг | Доорх 3.4 |
| ~~`POST /payments/:id/confirm`~~ | — | **Устгана** (клиент өөртөө premium олгож болох цоорхой) |
| `GET /payments` | admin (одоогийн) | + шүүлт `status`, + `?format=csv` |

`GET /payments/my`, `GET/POST /payments/plans` хэвээр.

### 3.3 Checkout үүсгэх (`POST /payments`)

1. Багц идэвхтэй эсэх → үгүй бол 404 `PLAN_NOT_FOUND`.
2. Үнэ: `plan.priceAmount`; `promoCode` байвал `promos.quote(userId, code, planId)` → `finalPrice`, `promoId`.
3. `Payment` үүсгэнэ: `amount = finalPrice`, `currency 'MNT'`, `provider 'byl'`, `status pending`,
   `metadata = { type: 'plan', planId, planSlug, planName, durationDays, listPrice, discount, promoId? }`.
4. Byl checkout: нэг item (`unit_amount = listPrice`, нэр «SparkXP Plus — 30 хоног»), хөнгөлөлт байвал `discounts: [{ amount: discount, description: 'Промо код <CODE>' }]`,
   `client_reference_id = payment.id`, `success_url = ${WEB_URL}/checkout/success?payment=<id>`,
   `cancel_url = ${WEB_URL}/checkout?plan=<slug>&canceled=1`, `email_collection: false`.
5. `payment.providerRef = checkout.id` хадгалаад `{ paymentId, checkoutUrl: checkout.url }`.
6. Byl алдаа → `payment.status = failed`, 503 `PAYMENT_UNAVAILABLE` (Byl-ийн 503 тохиргооны алдаа бол `logger.error`).

Промо кодын хэрэглээ checkout үед **тоологдохгүй** — зөвхөн төлөгдсөн үед (одоогийн зарчим).

### 3.4 Webhook

1. **Түүхий body:** `main.ts`-ийн `json({ limit, verify: (req, _res, buf) => { req.rawBody = buf } })`.
2. `verifyBylSignature(req.rawBody, req.headers['byl-signature'], BYL_WEBHOOK_SECRET)` — `timingSafeEqual`, урт зөрвөл false. Буруу → 401.
3. `type !== 'checkout.completed'` → 200, юу ч хийхгүй.
4. Idempotency: Redis `byl:event:<id>` `SET NX EX 7d` — аль хэдийн байвал 200.
5. `payment = findOne(data.object.client_reference_id)`; олдохгүй / `provider !== 'byl'` → 200 + `warn`.
6. `payment.status === paid` → 200 (давхар).
7. **Нэмэлт шалгалт:** `getCheckout(payment.providerRef)` → `status === 'complete'` байх ёстой; `Number(amount_total) === payment.amount` (Live). `BYL_TEST_MODE=true` бол дүнгийн зөрүүг зөвхөн логлоно (Test горим = 100₮). Таарахгүй (Live) → `metadata.mismatch = true`, эрх **олгохгүй**, `logger.error`, 200.
8. Нэг transaction: `status = paid` → `planAccessAfterPurchase` → `users.plan_id`, `plan_expires_at` → `promos.recordDiscountUse` → `referrals.creditFirstPurchaseBonus` (одоогийн `confirm`-ийн логик).
9. 200. Бүх алхам DB/Redis + нэг Byl GET — 5 сек-ээс хол бага.

Энэ endpoint `@SkipThrottle()` (Byl дахин илгээлт throttle-д баригдах ёсгүй) — гарын үсэг нь хамгаалалт.

### 3.5 `planAccessAfterPurchase(current, purchased, now)`

```
current = { planId, planExpiresAt, planPrice } (идэвхгүй бол planId = null)
purchased = { planId, price, durationDays }

идэвхгүй (planId null / дууссан)       → now + durationDays
ижил багц                              → max(now, planExpiresAt) + durationDays
өөр багц                               → now + durationDays + floor(remainingDays × planPrice / price)
  remainingDays = (planExpiresAt − now) / 1 өдөр  (бутархайг хадгалаад эцэст нь floor)
  planExpiresAt = null (хугацаагүй, ж: admin олгосон) → өөр багц руу шилжихийг 409 `PLAN_SWITCH_BLOCKED`
```

Үнийн харьцааг тооцоход **жагсаалтын үнэ** (`plan.priceAmount`) ашиглана, хөнгөлөлттэй үнэ биш.
Downgrade (үнэтэйгээс хямд руу) мөн ижил томьёогоор — үлдсэн хоног илүү олон хоног болно.

### 3.6 Migration `PlansMatchClientBrief`

Захиалагчийн 2026-09-28-ны баримтын дагуу:
- `standard`: `name = 'Essential'` (slug хэвээр).
- `plus`: `voice_minutes_limit = 70`, `stt_minutes_limit = 200`.
- `premier`: `voice_minutes_limit = 105`, `stt_minutes_limit = 300`.
Down нь өмнөх утга (Standard; Plus 50/120; Premier NULL/NULL).

### 3.7 CORS ба env

- `main.ts` `allowedOrigins`-д `WEB_ORIGIN` (таслалаар) нэмнэ — `https://spark-xp-web.vercel.app` + preview.
- `.env.example`: `BYL_API_TOKEN`, `BYL_PROJECT_ID`, `BYL_WEBHOOK_SECRET`, `BYL_TEST_MODE=true`, `WEB_URL`, `WEB_ORIGIN`.
- `BYL_API_TOKEN` / `BYL_PROJECT_ID` байхгүй бол `POST /payments` 503 (fail closed), boot үед `warn`.
- `BYL_WEBHOOK_SECRET` байхгүй бол webhook бүгдийг 401 (fail closed).

## 4. Вэб (`SparkXP_web`, Next.js 16)

| Хуудас | Агуулга |
|---|---|
| `/login` | Таб «Нууц үгээр» (`POST /auth/login`, identifier = нэр/утас/имэйл) · «SMS-ээр» (`/auth/phone/start` purpose `login` → код + `displayInstruction` → 3 сек polling → `/auth/phone/login`). Token → `localStorage`. Данс байхгүй бол «Бүртгэлээ аппаас үүсгэнэ» + апп татах линк. `?next=` дэмжинэ. |
| `/checkout?plan=<slug>` | Нэвтрээгүй → `/login?next=`. Багцын сонголт (`GET /payments/plans`), одоогийн багц (`GET /users/me/plan`), промо код, урьдчилсан тооцоо (`GET /payments/quote`) → «Төлөх» → `POST /payments` → `window.location = checkoutUrl`. `?canceled=1` → «Төлбөр цуцлагдлаа». |
| `/checkout/success?payment=<id>` | `GET /payments/:id`-ийг 3 сек тутам (≤ 3 мин) → `paid` → «Plus 2026-11-20 хүртэл идэвхтэй боллоо. Аппаа нээгээд үргэлжлүүлээрэй.» Хүлээгдсээр байвал «Төлбөр баталгаажихыг хүлээж байна — банкны шилжүүлэг бол хэдэн цаг болж магадгүй». |

- Үнийн хэсгийн карт бүрт «Худалдан авах» → `/checkout?plan=<slug>`.
- API base: `NEXT_PUBLIC_API_URL`. Дундын `lib/api.ts` (fetch + token + алдааны `code`).
- Загвар: одоогийн маркетингийн сайтын токен/компонентууд.

## 5. Апп

- `app/plan.tsx`: «Тун удахгүй» upgrade CTA-г **хасна**. Идэвхтэй багц + дуусах өдөр хэвээр (`GET /users/me/plan`, дэлгэц нээгдэх бүрд).
- Худалдан авалттай холбоотой ямар ч текст/линк нэмэхгүй.
- JS-only — дараагийн build-д.

## 6. Админ

- Төлбөрийн хуудас (одоогийн Monitor/payments): огноо · хэрэглэгч (username / утас) · багц · дүн · хөнгөлөлт · төлөв (`pending/paid/failed`, `mismatch` тэмдэг) · Byl checkout id. Шүүлт: төлөв. **«CSV татах»** (`GET /payments?format=csv`).

## 7. Алдааны код

| HTTP | `code` | Хэзээ |
|---|---|---|
| 404 | `PLAN_NOT_FOUND` | Багц байхгүй / идэвхгүй |
| 409 | `PLAN_SWITCH_BLOCKED` | Хугацаагүй багцтай хэрэглэгч өөр багц авах гэсэн |
| 4xx | (promos) | Промо кодын одоогийн алдаанууд |
| 503 | `PAYMENT_UNAVAILABLE` | Byl унасан / тохиргоо дутуу / токен байхгүй |
| 503 | (одоогийн) | `PAYMENTS_ENABLED` хаалттай |
| 401 | — | Webhook гарын үсэг буруу |

## 8. Тест

- `planAccessAfterPurchase`: идэвхгүй, дууссан, ижил багц, upgrade (34k→56k, 10 хоног → +6), downgrade, хугацаагүй → блок.
- `verifyBylSignature`: зөв, буруу, урт зөрүү, **дахин stringify хийсэн body → false**.
- `BylClient` (fetch mock): checkout үүсгэх body, 422, 503, timeout.
- Webhook (service түвшинд): эрх олгоно; давхар event → нэг л удаа; аль хэдийн `paid` → юу ч үгүй; Live дүн зөрвөл олгохгүй; Test горимд зөрүүг тэвчинэ; өөр `type` алгасна; `client_reference_id` олдохгүй → 200.
- `POST /payments/:id/confirm` → 404 (route устсан).
- **Бодит (Byl Test, 100₮):** вэб нэвтрэх → checkout → QPay 100₮ → webhook → `GET /users/me/plan` идэвхтэй → апп дээр харагдана.

## 9. Гаргах дараалал

1. **Таны:** Byl-д Test горимын API токен, төслийн ID, webhook signing secret; Railway-д `BYL_*` + `WEB_URL` + `WEB_ORIGIN` тавих; Byl-д webhook URL бүртгэх: `https://sparkxp-production.up.railway.app/api/payments/webhook/byl`.
2. Backend (PR) → prod, `PAYMENTS_ENABLED` **хаалттай хэвээр** (зөвхөн quote/webhook бэлэн).
3. `SparkXP_web` (PR) → Vercel.
4. Test горимд бүтэн урсгал (Railway дээр түр `PAYMENTS_ENABLED=true`).
5. **Live:** бизнес баталгаажуулалт (Aether Tech Core LLC) + Byl багц + үндсэн данс → Live → Live токен/secret → `BYL_TEST_MODE=false`, `PAYMENTS_ENABLED=true`.
6. Апп: `plan.tsx` CTA хасалт дараагийн build-д.
7. `API.md`, `CLAUDE.md` шинэчилнэ.

## 10. Мэдэгдэж буй эрсдэл

- **Webhook алдагдвал:** Byl ~4 хоног дахин илгээнэ; endpoint 7 хоног унавал идэвхгүй болно → Railway-ийн downtime-ийг хянах. Нөөц болгож админ төлбөрийг Byl-ээс дахин шалгах товчийг дараа нь нэмж болно.
- **И-баримт:** гараар — нягтлангийн ажлын ачаалал хэрэглэгчийн тоогоор өснө.
- **Буцаалт:** Byl API-д refund байхгүй (баримтад) → админ банкаар гараар, `Payment.status = refunded`-ийг гараар.
- **Вэбийн token `localStorage`-д:** XSS-д эмзэг; сайт статик бөгөөд гуравдагч script-гүй байлгах.
