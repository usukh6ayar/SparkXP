# Push Notification — Судалгаа + Бүрэн Төлөвлөгөө

> SparkXP мэдэгдлийн (notification) системийн бүрэн план. Багийн лавлах баримт.
> Огноо: 2026-07-03 · Судалгаа: Choi (mobile).

## 0. Товч дүгнэлт (TL;DR)
- Мэдэгдэлд **2 давхарга** бий: (A) **апп доторх жагсаалт** (бэлэн), (B) **бодит
  push** (утас хаалттай үед "дзиг" — бусад апп шиг).
- **Push-ийн технологи:** Expo Push Service (`expo-notifications` + `expo-server-sdk`)
  → FCM (Android) / APNs (iOS).
- **Зардал:** Expo push, Firebase (Android) = **үнэгүй**. iOS-д **Apple Developer
  $99/жил** заавал. Google Play $25 (нэг удаа, release).
- **Гол хязгаарлалт:** Expo Go дээр push **ажиллахгүй** (SDK 53+; апп SDK 54) →
  **EAS development build** заавал.
- **Шийдвэр:** iOS+Android хоёулаа, **launch-ийн дараа** хийнэ. Одоо (A) давхарга
  нь launch-ийн шийдэл.

---

## 1. Хоёр давхарга

### Давхарга A — In-app notification center ✅ (бэлэн, PR #93)
Апп дотор bell дарж мэдэгдлүүдийг жагсаалтаар харна.
- `mobile/app/notifications.tsx` — жагсаалт (loading/empty/error, pull-to-refresh,
  "x өмнө" цаг).
- `mobile/src/api/notifications.ts` — `getMyNotifications()`.
- `mobile/src/lib/useUnreadNotifications.ts` — client-side last-seen unread цэг.
- Home header bell + Profile мөр → `/notifications`.
- **Дутуу (Өсөхбаяр):** `GET /notifications/me` — JWT (аль ч role), `Notification[]`
  where `target_role IS NULL OR target_role = user.role`, newest first (limit ~50).

### Давхарга B — Бодит push notification ⬅ энэ баримтын гол сэдэв
Утас унтралттай/апп хаалттай үед мэдэгдэл түлхэх. Зөвхөн код биш — **гадаад дэд
бүтэц** (Firebase, Apple/Google account, EAS build) шаарддаг.

---

## 2. Технологи ба архитектур
Апп нь Expo (SDK 54) тул хамгийн бага ажилтай, найдвартай зам = **Expo Push Service**.
Нэг `ExpoPushToken`-оор хоёр платформ руу илгээнэ; Expo нь FCM/APNs-ийг ард нь зохицуулна.

```
[App: expo-notifications]
   getExpoPushTokenAsync({ projectId }) → "ExpoPushToken[xxxx]"
        │  POST /users/me/push-token
        ▼
[Backend: User.expoPushToken хадгална]
   admin broadcast → expo-server-sdk → https://exp.host/--/api/v2/push/send
        ▼
[Expo Push Service]  ──► FCM  ──► Android утас
                     └─► APNs ─► iOS утас
```

---

## 3. Зардал (2026-07 судалгаагаар)
| Зүйл | Төлбөр | Тайлбар |
|------|--------|---------|
| **Expo Push Service** | **Үнэгүй** | Message-ийн төлбөргүй. Лимит 600 notif/сек/project. |
| **Firebase Cloud Messaging (Android)** | **Үнэгүй** | Android хүргэлтэд заавал. Firebase project үнэгүй. |
| **Apple Developer Program (iOS)** | **$99 / жил** | iOS push + App Store-д заавал. Тойрч гарах аргагүй. |
| **Google Play Console** | **$25 (нэг удаа)** | Play Store release-д (push-д биш). |
| **EAS Build** | Үнэгүй tier / локал build | Хязгаартай сарын build; локалаар үнэгүй. |

→ **Push-ийн цорын ганц зайлшгүй нэмэлт зардал = Apple $99/жил** (App Store-д гаргахад
ямар ч байсан хэрэгтэй). Android тал бүрэн үнэгүй.

---

## 4. ⚠️ Гол анхаарах зүйлс (алдаагүй болгоход)
1. **Expo Go push дэмждэггүй (SDK 53+).** Тестлэхэд **EAS development build** заавал.
   `npx expo start` (Expo Go) дээр push ажиллахгүй.
2. **`projectId` дутуу** — `app.json`-д `extra.eas.projectId` алга. `eas init`-ээр
   үүсгэнэ (token авахад заавал).
3. **`android.package` дутуу** — `app.json` `android`-д `package` талбар алга
   (жишээ: `com.usukh6ayar.englishxp`). FCM/build-д заавал.
4. **Физик төхөөрөмж** — emulator/simulator дээр push token гарахгүй.
5. **Token-ийн амьдрал** — token хугацаа дуусах/солигдох тул нэвтрэх бүрд дахин
   бүртгэх; backend талд `DeviceNotRegistered` receipt ирвэл token устгах.

---

## 5. Гүйцэтгэл — эзэмшигчээр

### 5.1 Дэд бүтэц / эрх (Team lead + Өсөхбаяр — org account)
- **Expo account** (үнэгүй) → `cd mobile && eas init` → `projectId`-г `app.json`
  `extra.eas.projectId`-д бичих. `eas build:configure` → `eas.json`.
- **Firebase project** → Android app (`com.usukh6ayar.englishxp`) нэмэх → **FCM V1**
  тохируулж `google-services.json` татаад EAS Android credentials-д өгөх.
- **Apple Developer Program** ($99/жил) → EAS эхний iOS build дээр **APNs** key
  автоматаар үүснэ.
- **EAS development build** (Android + iOS) → багийн утсанд суулгах (Expo Go биш).

### 5.2 Mobile апп (Choi) — шинэ dep: `expo-notifications`, `expo-device`
- **`app.json`**: `plugins`-д `expo-notifications` (icon/өнгө/дуу), `android.package`,
  `extra.eas.projectId` нэмэх.
- **`mobile/src/lib/registerPushToken.ts`** (шинэ): физик төхөөрөмж шалгах →
  зөвшөөрөл асуух → `getExpoPushTokenAsync({ projectId })` → `savePushToken()` →
  Android-д `setNotificationChannelAsync('default', …)`.
- **`mobile/src/auth/AuthContext.tsx`**: token байгаа үед (`persist` + mount)
  `registerPushToken()` дуудах. Гарахад token устгах (сонголт).
- **`mobile/app/_layout.tsx`**: `setNotificationHandler(...)` (foreground харуулах) +
  `addNotificationResponseReceivedListener` → мэдэгдэл дээр дарвал `/notifications`
  (эсвэл payload доторх deep-link).
- **`mobile/src/api/notifications.ts`**: `savePushToken(token, platform)` →
  `POST /users/me/push-token`.

### 5.3 Backend (Өсөхбаяр) — шинэ dep: `expo-server-sdk`
- **`User` entity**: `expoPushToken` (`varchar`, nullable) + `pushPlatform`.
  *(MVP = нэг төхөөрөмж/хэрэглэгч. Олон төхөөрөмж хэрэгтэй бол дараа `device_tokens`
  хүснэгт.)*
- **`users.controller.ts`**: `@Post('me/push-token')` (одоогийн `@Patch('me')`,
  `@Post('me/avatar')`-ийн хажууд).
- **`notifications.service.ts`** `broadcast()`: одоогийн `// TODO`-г бодит болгох —
  target token цуглуулах, `expo-server-sdk`-аар chunk хийж илгээх, **receipt** шалгаж
  `DeviceNotRegistered` token устгах, `sentCount` шинэчлэх, 600/сек throttle+retry.
- **Migration**: `User`-ийн шинэ багануудад (prod `DB_SYNCHRONIZE=false`).

---

## 6. Дахин ашиглах (давхардуулахгүй)
- In-app center (PR #93) бэлэн — push нь зөвхөн **нэмэлт хүргэх суваг**. Push дээр
  дарвал тэр л `/notifications` screen нээгдэнэ.
- `apiRequest`/`client.ts`, `AuthContext` token flow, `Notification` entity, `broadcast`
  DTO/targetRole логик — бүгд бий. Зөвхөн илгээх хэсэг нэмнэ.

---

## 7. Verification (dev build дээр)
1. `eas build --profile development` (Android эхэлж, дараа iOS) → утсанд суулгах.
2. Апп нээж зөвшөөрөл өгөх → `ExpoPushToken[...]` backend-д хадгалагдсаныг DB/log-оор шалгах.
3. **Expo Push Tool** (expo.dev/notifications) эсвэл admin broadcast-аар мэдэгдэл илгээх
   → апп background/хаалттай үед утсанд push гарах.
4. Push дээр дарвал `/notifications` screen нээгдэх.
5. Invalid token → `DeviceNotRegistered` → backend token устгаж байгааг шалгах.

---

## 8. Phasing
- **Одоо (launch хүртэл):** In-app center = мэдэгдлийн шийдэл (бэлэн). `GET
  /notifications/me` endpoint л дутуу (Өсөхбаяр).
- **Launch-ийн дараа — Push Phase 2a (Android, үнэгүй):** §5.1–5.3-ыг Android дээр
  бүрэн хийж туршина.
- **Push Phase 2b (iOS):** Apple Developer ($99/жил) авсны дараа APNs идэвхжүүлж iOS
  build дээр туршина.

---

## 9. Эх сурвалж
- Expo — Push notifications setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Expo — Push notifications FAQ (зардал/лимит): https://docs.expo.dev/push-notifications/faq/
- Expo — Sending notifications (server): https://docs.expo.dev/push-notifications/sending-notifications/
