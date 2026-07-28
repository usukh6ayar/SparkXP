# BE/native хүсэлт (Choi → Өсөхбаяр): push мэдэгдлийн dependency + plugin

**Огноо:** 2026-07-29 · **Блоклогдсон:** ROADMAP-ийн retention ажил №3
(«Ухаалаг сануулга»)

## Backend бэлэн — mobile тал л блоклогдсон

Таны хийсэн зүйлс аль хэдийн ажиллаж байна:

- `POST /notifications/token` · `DELETE /notifications/token` · `POST /notifications/prefs`
- 20:00 (UB) cron: `word_reviews.next_review_at <= now()` ≥ 5 бөгөөд өнөөдөр
  хичээллээгүй хэрэглэгчид «N үг чамайг хүлээж байна» гэж илгээдэг
- `DeviceNotRegistered` token-ыг автоматаар цэвэрлэдэг

Гэвч **token бүртгүүлэх төхөөрөмж алга** — mobile талд push унтраалттай.

## Хэрэгтэй зүйл (native config = зөвхөн lead)

CLAUDE.md-ийн дагуу dependency болон `app.json`-ыг зөвхөн та заслах ёстой:

1. **Dependency нэмэх** (SDK 54-т тохирох хувилбараар):
   ```bash
   cd mobile && npx expo install expo-notifications expo-device
   ```
   ⚠️ `npx expo install --fix` / `--check` **бүү ажиллуул** — 2026-07-28-нд
   бүх SDK-г 56 рүү үсрүүлж, `expo`-г 46 болгож буулгаад Expo Go-г эвдсэн.

2. **`app.json` plugins-д нэмэх:**
   ```json
   ["expo-notifications", {
     "icon": "./assets/icon.png",
     "color": "#6C3BFF"
   }]
   ```

3. **`eas.json` / credentials:** iOS-д APNs key, Android-д FCM (Firebase)
   тохируулга — push зөвхөн native build дээр ажиллана.

## Яагаад би өөрөө хийж чадахгүй байна вэ

- Dependency + `app.json` = таны талбар (CLAUDE.md «Only the lead edits native config/deps»)
- **Expo Go SDK 53-аас хойш remote push дэмжихээ больсон** → би `npm run go`-оор
  ажилладаг тул бичсэн кодоо шалгаж ч чадахгүй. **Dev-client build хэрэгтэй.**

## Mobile талаас бэлэн болсон зүйл

`mobile/src/api/notifications.ts`-д API давхаргыг бичсэн (dependency шаарддаггүй):

- `registerPushToken(pushToken, token)` — idempotent, бүр эхлүүлэлт дээр дуудаж болно
- `deletePushToken(token)` — гарах / зөвшөөрөл цуцлахад
- `setPushPrefs(enabled, token)` — Settings дэх унтраалга
- `EXPO_PUSH_TOKEN_RE` — илгээхийн өмнө хэлбэр шалгах (таны DTO-той ижил regex)

Dependency орж ирмэгц үлдэх ажил:

1. `src/lib/push.ts` — зөвшөөрөл асуух + `getExpoPushTokenAsync()` + бүртгүүлэх
2. `app/settings.tsx`-д «Давтлагын сануулга» унтраалга
3. Гарахад token устгах (`AuthContext.clearSession`)

**Dependency + dev-client build бэлэн болмогц надад хэлээрэй** — 1-3-ыг тэр өдөртөө дуусгана.
