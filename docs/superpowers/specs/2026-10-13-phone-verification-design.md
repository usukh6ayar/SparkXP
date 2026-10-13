# Утасны дугаар баталгаажуулалт (verify.mn) — дизайн

- **Огноо:** 2026-10-13 · **Эзэн:** Өсөхбаяр (backend + admin) · апп дэлгэцүүд = Choi-гийн хэсэг (доор «Эзэмшил»)
- **Дизайн (canvas):** https://claude.ai/artifact/RdFVxctEQJoaQCqzLtDrBN — хувийн; Choi-д Share-ээр нээж өгнө
- **Байр суурь:** Төлбөрийн ажлын **1-р дэд төсөл**. 2-р дэд төсөл = вэб дээрх Byl (byl.mn) төлбөр, тусдаа spec. Вэб төлбөрт хэрэглэгч утсаараа нэвтэрнэ, тиймээс энэ нь эхэлж гарна.

## 1. Зорилго

Утасны дугаарыг дансны үндсэн, баталгаажсан түлхүүр болгох:

1. Шинэ бүртгэл = username + **утас (verify.mn-ээр баталгаажуулна)** + нууц үг + нэр + имэйл (**заавал биш, баталгаажуулахгүй**).
2. Утсаар нэвтрэх: утас + нууц үг, мөн нууц үггүй «SMS-ээр нэвтрэх».
3. Утсаар нууц үг сэргээх.
4. Хуучин данснууд утсаа холбох.

**Хамрахгүй:** Byl төлбөр, вэб checkout, Family багц, Free Basic лимит, аппын багцын дэлгэц (`plan.tsx`).

## 2. Батлагдсан шийдвэрүүд

| # | Шийдвэр |
|---|---|
| 1 | Бүртгэлд утас **заавал**, имэйл заавал биш (баталгаажуулахгүй, «гараар авна»). |
| 2 | **Нэг дугаар = нэг данс.** |
| 3 | Утасгүй хуучин данс: **имэйл/нууц үгээр** бүртгүүлсэн бол gate (утсаа баталгаажуулахгүйгээр үргэлжлүүлэхгүй). **Google/Apple** данс бол заавал биш, Тохиргооноос холбоно (Apple 5.1.1 — SIWA хэрэглэгчээс утас албадах эрсдэл). |
| 4 | Нэвтрэлт: `identifier` нь username / имэйл / **утас**; нэмээд **SMS-ээр нэвтрэх** (нууц үггүй). |
| 5 | verify.mn **callback ашиглахгүй** — апп манай backend-ийг 3 сек тутам асууж, backend verify.mn-ээс шалгана. |

## 3. verify.mn — бидний ашиглах баримт

Эх сурвалж: https://verify.mn (тусдаа docs хуудас байхгүй; нүүр хуудас + Developer Console).

- **MO SMS:** бид SMS илгээдэггүй. **Хэрэглэгч өөрийн дугаараасаа 144773 руу** кодыг илгээнэ. Session нь `phone`-оор үүсдэг тул илгээгчийн дугаартай тулгагдана (`displayInstruction`: «Та өөрийн 99xxxxxx дугаараас…»).
- `POST https://api.verify.mn/sessions` — `Authorization: Bearer $VERIFY_MN_API_KEY`, body `{ phone, text }` (`callback` өгөхгүй — баримт «poll хийх бол хоосон орхи» гэдэг). Хариу: `sessionId, phone, shortcode, text, smsUri, displayInstruction, expiresAt` (TTL **300 сек**).
- `GET https://api.verify.mn/sessions/:sessionId` — **auth-гүй**. `sessionStatus: PENDING | VERIFIED | EXPIRED`.
- Алдаа: 400 validation · 401 буруу түлхүүр · **409 ижил phone+text-тэй идэвхтэй session** · 500.
- Код: захын зайг хассны дараа яг таарна. Session бүрд **шинэ санамсаргүй 6 орон**.
- Polling **≥ 3 сек**; `VERIFIED` болмогц зогсоно; `EXPIRED` → шинэ session.
- Хариу SMS (`responseSms`) найдваргүй (Unitel анхдагч текст, Lime огт үгүй) — **ашиглахгүй**, үр дүнг өөрсдийн UI-д харуулна.
- Үнэ: хэрэглэгч SMS бүрд **150₮** (буруу ч гэсэн) төлнө; бидэнд 40₮. Setup/сарын хураамжгүй. Бүх оператор.

## 4. Backend

### 4.1 Модуль `src/phone-verification/`

```
phone-verification/
  phone-verification.module.ts
  phone-verification.controller.ts   start / status
  phone-verification.service.ts      Redis record, proof үүсгэх/хэрэглэх
  verify-mn.client.ts                verify.mn-ийн 2 дуудлага (fetch), fake горим
  phone.ts                           normalizePhone()
  dto/
```

**`normalizePhone(input)`** — зай, зураас, `+976` / `976` угтварыг хасаад яг **8 орон** (`^[5-9]\d{7}$`) байхыг шаардана; үгүй бол 400 `INVALID_PHONE`.

**Redis record** — түлхүүр `phonever:<verificationId>` (манай UUID), TTL = session-ийн `expiresAt` (5 мин); `verified` болоход 10 мин болгож сунгана:

```json
{ "phone": "99112233", "purpose": "register|login|reset|link",
  "userId": "<link үед л>", "vmSessionId": "...", "expiresAt": "...",
  "status": "pending|verified|consumed" }
```

- verify.mn-ийн `sessionId`-г **апп руу хэзээ ч өгөхгүй** (түүгээр хэн ч auth-гүй төлөв харна). Апп зөвхөн `verificationId`-г мэднэ.
- **Proof** = `status: verified` болсон record. Тухайн **утас + purpose**-д холбогдсон, **нэг удаагийн**: хэрэглэх endpoint нь purpose таарч байгааг шалгаад `consumed` болгоно (Lua/`GETDEL`-ээр атомаар — зэрэг хоёр хүсэлт нэг proof-ыг хэрэглэхгүй). Verified болсноос хойш 10 мин хүчинтэй.

### 4.2 Endpoint-ууд

Хуучин имэйлийн endpoint-уудын гэрээг **хөндөхгүй** (TestFlight build 12–17 ашигладаг) — шинийг хажууд нь нэмнэ.

| Method · Path | Auth | Тайлбар |
|---|---|---|
| `GET /auth/check-availability?username=&phone=` | public, throttled | SMS-ээс **өмнө** username / утас чөлөөтэй эсэх. `{ username: bool, phone: bool }` |
| `POST /auth/phone/start` `{ phone, purpose }` | public, throttled | purpose ∈ `register \| login \| reset`. `register`: утас бүртгэлтэй бол 409 `PHONE_TAKEN`. `login`/`reset`: бүртгэлгүй утас бол 404 `PHONE_NOT_FOUND`. → `{ verificationId, smsUri, displayInstruction, expiresAt }` |
| `POST /users/me/phone/start` `{ phone }` | JWT | purpose = `link`, `userId` = caller. Утас өөр дансанд баталгаажсан бол 409 `PHONE_TAKEN` |
| `GET /auth/phone/status/:verificationId` | public | Backend verify.mn-ээс шалгаад `{ status: pending\|verified\|expired, expiresAt }`. Record-ыг `verified` болгоно |
| `POST /auth/register-phone` | public | `{ verificationId, username, password, fullName, email?, level?, province?, district?, referralCode?, tasteCompleted? }` → `AuthResult` (шууд нэвтэрнэ) |
| `POST /auth/phone/login` `{ verificationId }` | public | → `AuthResult` |
| `POST /auth/phone/reset` `{ verificationId, password }` | public | Нууц үг солиод → `AuthResult` (шууд нэвтэрнэ) |
| `POST /users/me/phone` `{ verificationId }` | JWT | Proof-ын `userId` = caller байх ёстой. → `{ phone, phoneVerified: true }` |
| `DELETE /users/:id/phone` | admin, super_admin | Дугаарыг суллана (`phone`, `phone_verified_at` = NULL). Дахин ашиглуулсан дугаарт |
| `POST /auth/login` (өөрчлөлт) | public | `identifier` = username / имэйл (одоогийнхоор — баталгаажаагүй бол `EMAIL_NOT_VERIFIED`) / **баталгаажсан** утас. 8 оронтой тоо бол утсаар хайна |
| `GET /auth/me` (өөрчлөлт) | JWT | `phone`, `phoneVerified`, `needsPhone` нэмэгдэнэ |

**`needsPhone`** = `!phoneVerified && !hasSocialIdentity` (`user_identities`-д мөр байхгүй). Gate-ийн цорын ганц эх сурвалж — апп өөрөө тооцохгүй.

**Throttle:** `phone/start` болон `check-availability` — IP-д минутад 5, нэг утсанд 10 минутад 3 session (Redis тоолуур). 429 `TOO_MANY_REQUESTS`.

**`register-phone`** — одоогийн `register` + `verifyOtp`-ийн нэгдсэн хувилбар: proof хэрэглэнэ → данс `phone_verified_at = now()`-тайгаар үүснэ → referral болон onboarding XP-г **энд** олгоно (одоо `verifyOtp` дотор байгаа логикийг дундын private method болгож хоёул дуудна — DRY). Имэйл өгсөн бол `email_verified = false`.

**`login` (`EMAIL_NOT_VERIFIED`)** — шалгалт нь `!emailVerified && !phoneVerifiedAt` болно (утсаар бүртгүүлсэн хүн имэйлгүй/баталгаажаагүй байж болно).

### 4.3 Өгөгдөл — migration `AddPhoneVerification<ts>`

1. `users.email` → **NULL зөвшөөрнө**.
2. `email`-ийн одоогийн unique index **хэвээр** (NULL олон байж болно). `register-phone`-д өгсөн имэйл өөр дансанд байвал 409 `EMAIL_TAKEN` — имэйл заавал биш тул хэрэглэгч хоосон орхиод үргэлжилнэ. Partial (зөвхөн баталгаажсан) unique index-ийг **зориуд хийгээгүй**: тэгвэл нэг имэйлтэй олон мөр үүсэж, хуучин build-уудын имэйлийн урсгал (`findByEmail`) хоёрдмол болно.
3. `users.phone_verified_at timestamptz NULL`.
4. `UNIQUE (phone) WHERE phone_verified_at IS NOT NULL`. Зэрэг хоёр бүртгэлийн нэг нь unique зөрчлөөр унана → 409 `PHONE_TAKEN` (race-гүй).
5. Одоогийн `users.phone` утгууд (бичигддэг газар байхгүй тул бараг хоосон) — **баталгаажаагүй** гэж үлдэнэ.

⚠️ Prod: Railway дээр `DB_MIGRATIONS_RUN=true` эсэхийг шалгаж байж deploy хий.

Entity: `User.email: string | null`, `User.phoneVerifiedAt: Date | null`. `usersService.create({ email })` nullable. Утсаар хайх бүх query `phone_verified_at IS NOT NULL` нөхцөлтэй.

### 4.4 Аюулгүй байдлын засварууд (энэ spec-д заавал)

1. **Social нэвтрэлт имэйлээр холбохдоо** (`social-auth.service.ts` ~111 ба ~171): зөвхөн **`emailVerified = true`** дансанд холбоно. Одоо баталгаажаагүй дансанд ч холбож, бүр `markEmailVerified` хийдэг — имэйл баталгаажуулалтгүй болсноор данс булаах цоорхой болно (халдагч хохирогчийн имэйлээр бүртгүүлж, хохирогчийн Google нэвтрэлтийг өөрийн данс руу оруулна). Баталгаажаагүй имэйлтэй таарвал → шинэ данс (username сонгох урсгал).
2. **Имэйлээр нууц үг сэргээх** (`forgotPassword` / `resetPassword`): зөвхөн `emailVerified = true` дансанд код илгээнэ.
3. **`JwtPayload.email`** → `string | null`; уншдаг бүх газрыг шалгана (`jwt.strategy.ts`, `buildAuthResult`, имэйл илгээдэг сервисүүд, admin хэрэглэгчийн жагсаалт).
4. Нэвтрэлт/сэргээлт/холболт нь зөвхөн `phone_verified_at IS NOT NULL` мөрийг тоолно — чөлөөтэй бичигдсэн `phone` хэзээ ч таних түлхүүр болохгүй. `phone` баганад бичих цорын ганц зам = энэ модуль (+ admin салгах).

### 4.5 `VerifyMnClient`

- `createSession(phone, code)` / `getSession(id)` — global `fetch`, 5 сек timeout, түлхүүр лог руу **хэзээ ч** бичигдэхгүй.
- 409 → шинэ код үүсгээд нэг удаа дахин оролдоно.
- 401 → `logger.error` (түлхүүр буруу) + хэрэглэгчид 503.
- 5xx / timeout → 503 `SMS_UNAVAILABLE`.
- **Fake горим:** `VERIFY_MN_FAKE=true` → session нь үүссэнээс 3 сек хойш `VERIFIED`. `NODE_ENV=production` үед энэ тохиргоо байвал **boot унана** (fail closed). Choi/Boju түлхүүргүй, 150₮ төлөхгүйгээр Expo Go дээр туршина.
- `VERIFY_MN_API_KEY` байхгүй + fake биш → бүх phone endpoint 503, boot үед `warn`.

### 4.6 Env (`.env.example`-д нэмнэ)

```
VERIFY_MN_API_KEY=
VERIFY_MN_FAKE=false
```

## 5. Апп (mobile)

Дизайн: canvas-ийн 10 artboard. Брэнд токенууд `REDESIGN_SPEC.md` / `theme.ts`-ээс (hex дэлгэцэнд бичихгүй, `useColors()`).

### 5.1 Дундын хэсэг

- `src/api/phone.ts` — `checkAvailability`, `startPhoneVerification`, `startLinkPhone`, `getPhoneVerificationStatus`, `registerWithPhone`, `loginWithPhone`, `resetWithPhone`, `linkPhone`.
- `src/lib/usePhoneVerification.ts` — `{ start(phone), state: idle|waiting|verified|expired|error, verificationId, smsUri, displayInstruction, secondsLeft, restart() }`. 3 сек polling, `expiresAt` дээр хатуу зогсолт, `verified` болмогц зогсоно, unmount дээр цэвэрлэнэ. Сүлжээ тасарвал алдаа харуулахгүй, хугацаа дуустал асуусаар.
- `src/components/PhoneVerifyCard.tsx` — хүлээн авагч 144773, кодын бөмбөлөг, тоолуур/progress, `displayInstruction` **үгчлэн**, «SMS илгээх» (`Linking.openURL`), «Оператор SMS бүрд 150₮ тооцно», төлөв: waiting / verified / expired («Шинэ код авах»). Verified үед «SMS илгээх» **нуугдана**.
- `sms:` URI-г платформоор угсарна (iOS `sms:144773&body=…`, Android `sms:144773?body=…`) — бодит төхөөрөмж дээр хоёуланг шалгана.
- `PhoneInput` (`+976` угтвар, 8 орон) — бүртгэл, сэргээх, gate гурвуулаа ашиглана.

### 5.2 Дэлгэцүүд

| Дэлгэц | Өөрчлөлт |
|---|---|
| `(auth)/onboarding/account.tsx`, `(auth)/register.tsx` | Талбар: username, утас, нууц үг, нэр, имэйл (заавал биш). «Үргэлжлүүлэх» → `check-availability` → `PhoneVerifyCard` → verified → `register-phone` → нэвтэрнэ. Onboarding-ийн хариултууд (түвшин, өдрийн зорилт) одоогийнхоор дамжина. |
| `(auth)/login.tsx` | Шошго «Нэвтрэх нэр, утас эсвэл имэйл»; «SMS-ээр нэвтрэх» товч → утас → карт → `phone/login`. |
| `(auth)/forgot.tsx` | Утас → карт → «Шинэ нууц үг» → `phone/reset` → нэвтэрнэ. Доор «Имэйлээр сэргээх» (хуучин урсгал). |
| `settings.tsx` | «Утасны дугаар» мөр: байхгүй → «Холбох» (тодруулсан); байгаа → дугаар + ✓. |
| **шинэ** `(auth)/phone-required.tsx` | Gate: тайлбар, `PhoneInput`, «Баталгаажуулах» → карт → `POST /users/me/phone`; «Гарах». Root layout `me.needsPhone` үнэн бол энд чиглүүлнэ. |
| `(auth)/choose-username.tsx` | Хөндөхгүй (social — утас заавал биш). |

i18n: бүх шинэ текст `src/i18n`-д (монгол эхэлж), canvas дээрх үгийг ашиглана.

## 6. Админ

- Хэрэглэгчийн жагсаалт: «Утас» багана + ✓ (баталгаажсан). Утсаар хайлт байгаа.
- Хэрэглэгч засах: «Утас салгах» → `DELETE /users/:id/phone` (баталгаажуулах цонхтой).

## 7. Алдааны код

Апп **код**-оор салгана, мессежээр биш (`EMAIL_NOT_VERIFIED`-ийн жишгээр). Мессеж нь монгол, хэрэглэгчид шууд харагдана.

| HTTP | `code` | Хэзээ |
|---|---|---|
| 400 | `INVALID_PHONE` | 8 оронтой Монгол дугаар биш |
| 400 | `VERIFICATION_EXPIRED` | `verificationId` олдохгүй / хугацаа дууссан |
| 400 | `VERIFICATION_INVALID` | Proof баталгаажаагүй, өөр purpose, аль хэдийн хэрэглэгдсэн, өөр хэрэглэгчийнх |
| 404 | `PHONE_NOT_FOUND` | login/reset — бүртгэлгүй дугаар |
| 409 | `PHONE_TAKEN` | Дугаар өөр дансанд баталгаажсан |
| 409 | `EMAIL_TAKEN` | register-phone — имэйл өөр дансанд байна (хоосон орхиж болно) |
| 409 | (одоогийн) | Username давхардсан |
| 429 | `TOO_MANY_REQUESTS` | Throttle |
| 503 | `SMS_UNAVAILABLE` | verify.mn унасан / түлхүүр буруу / тохируулаагүй |

## 8. Тест

**Backend (jest):**
- `normalizePhone`: `+976 9911-2233` → `99112233`; 7 орон, үсэг, `1xxxxxxx` → алдаа.
- `VerifyMnClient` (fetch mock): PENDING → VERIFIED, EXPIRED, 401, 409 дахин оролдлого, timeout; fake горим; **production + fake → boot алдаа**.
- `PhoneVerificationService`: proof нэг удаагийн (хоёр дахь хэрэглээ → `VERIFICATION_INVALID`), purpose холбоос (register proof-оор reset болохгүй), link proof өөр хэрэглэгчид ажиллахгүй.
- Auth: `register-phone` (амжилт, `PHONE_TAKEN`, `EMAIL_TAKEN`, username давхардал, referral + onboarding XP олгогдсон), `phone/login`, `phone/reset`, `login` identifier = утас, утсаар бүртгүүлсэн имэйлгүй хэрэглэгч `EMAIL_NOT_VERIFIED`-д баригдахгүй.
- **Regression:** баталгаажаагүй имэйлтэй данс → social нэвтрэлт холбогдохгүй; `forgotPassword` баталгаажаагүй имэйл рүү код илгээхгүй.
- Migration-ийг dev DB дээр up/down.

**Гараар (бодит төхөөрөмж):** iOS + Android-аас жинхэнэ SMS (`sms:` URI ялгаа); А дугаараар session үүсгээд Б-ээс илгээхэд `PENDING` хэвээр үлдэхийг нэг удаа батлах; gate → холбох → gate алга болох.

## 9. Гаргах дараалал

1. **Backend** — нэмэлт өөрчлөлт, хуучин build-ууд эвдрэхгүй. Railway: `VERIFY_MN_API_KEY` нэмэх, `DB_MIGRATIONS_RUN` шалгах. Boot лог-оос verify.mn тохиргоо уншигдсаныг харах.
2. **Admin** (Vercel).
3. **Апп** — native өөрчлөлтгүй (шинэ dependency алга) → OTA эсвэл build 18. Gate зөвхөн шинэ bundle-д.
4. **App Store review:** утас нь урьдчилж баталгаажсан demo данс (reviewer Монгол дугаараас SMS илгээж чадахгүй) — App Store Connect-ийн Review Notes-д.
5. `API.md` (§1 Auth + шинэ endpoint-ууд + mobile usage), `CLAUDE.md` Current Status шинэчилнэ.

## 10. Эзэмшил ба зохицуулалт

- `backend/`, `admin/` — Өсөхбаяр.
- `mobile/app/(auth)/*` (бүртгэл, нэвтрэх, сэргээх) — **Choi**. `src/components/`, `src/i18n`, `app/_layout.tsx`, `settings.tsx` — дундын файл: CLAUDE.md-д мэдэгдээд жижиг PR.
- Хэн апп талыг хийхийг хэрэгжүүлэх төлөвлөгөөнд тохирно.

## 11. Мэдэгдэж буй эрсдэл (шийдэхгүй)

- **Дахин ашиглуулсан дугаар:** оператор дугаарыг шинэ хүнд өгвөл тэр хүн SMS-ээр хуучин эзний дансанд орно, шинэ данс нээж чадахгүй. Одоохондоо админ «Утас салгах»-аар шийднэ.
- **SMS-ийн зардал хэрэглэгчид:** нэвтрэх/сэргээх бүр 150₮. Нууц үгээр нэвтрэх үндсэн зам хэвээр тул хүлээн зөвшөөрөгдөхүйц.
- **Баталгаажаагүй имэйл эзэмшигдэх:** хэн нэгэн бусдын имэйлийг бүртгэлдээ бичвэл жинхэнэ эзэн тэр имэйлийг ашиглаж чадахгүй (409). Имэйл заавал биш, нэвтрэлт/сэргээлт/social холболт баталгаажаагүй имэйлийг хүлээн зөвшөөрөхгүй тул хохирол нь зөвхөн тав тухгүй байдал.
- **Enumeration:** `check-availability` ба `phone/start` нь дугаар бүртгэлтэй эсэхийг илчилнэ — throttle-оор хязгаарлана, UX-ийн төлөө зориуд хүлээн зөвшөөрсөн.
