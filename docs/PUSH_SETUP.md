# Push notification — тохируулах заавар (Firebase + APNs)

> Код бүрэн бэлэн. Энэ бол **чиний (lead) хийх нэг удаагийн тохиргоо** —
> Firebase төсөл, FCM түлхүүр, APNs түлхүүр. Дараа нь дахин хийхгүй.

---

## 0. Эхлээд ойлгох зүйл — "Expo уу, Firebase үү" гэдэг сонголт биш

Апп нь **Expo Push Service**-ээр илгээдэг (`backend/src/notifications/push.service.ts`
→ `exp.host/--/api/v2/push/send`). Гэхдээ Expo нь Android дээр **дотроо FCM-ээр
л явдаг**, iOS дээр APNs-ээр. Тэгэхээр:

```
Backend → Expo Push Service → ┬→ FCM  → Android утас
                              └→ APNs → iPhone
```

**Firebase заавал хэрэгтэй** — Expo ашиглаж байгаа ч гэсэн. Ялгаа нь зөвхөн
дараах хоёрын аль нэгийг сонгох:

| | Expo Push (одоогийн) | Шууд FCM (`@react-native-firebase`) |
|---|---|---|
| Firebase төсөл | ✅ хэрэгтэй | ✅ хэрэгтэй |
| Backend код | ✅ бэлэн | ❌ дахин бичнэ |
| `expo_push_token` багана | ✅ бэлэн | ❌ migration |
| **Expo Go** | ⚠️ push тестлэгдэхгүй, апп ажиллана | ❌ **апп бүхэлдээ эвдэрнэ** |
| Ажил | ~30 мин | 1–2 өдөр |

SDK 54 дээр түгжээтэй, Choi/Boju хоёул Expo Go дээр ажилладаг тул
**Expo Push давхаргыг хэвээр үлдээв.**

---

## 1. Firebase төсөл (Android)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
   → нэр `SparkXP`. **Google Analytics-ийг АСААХГҮЙ.**
   >
   > Firebase доторх Gemini "заавал асаа, мэдэгдлийн нээлтийг хэмждэг" гэж
   > зөвлөсөн нь **манай тохиргоонд буруу**: тэр event-үүд зөвхөн апп дотор
   > Firebase Analytics SDK байвал бүртгэгддэг. Бид ямар ч Firebase SDK
   > суулгахгүй (Expo Go эвдэрнэ) тул дашбоард **хоосон** байна. Мэдэгдлийн
   > нээлтийг PostHog-оор хэмжинэ — доорх §7-г үз.
2. Төсөл дотор **Android апп нэмэх**:
   - **Package name:** `mn.app.sparkxp` ← яг ийм байх ёстой, `app.json`-той таарна
   - Nickname, SHA-1 → хоосон орхиж болно
3. **`google-services.json` татаж авах** → `mobile/google-services.json` болгож хадгал.

   `app.json` дээр заана:
   ```jsonc
   "android": {
     "package": "mn.app.sparkxp",
     "googleServicesFile": "./google-services.json",
     …
   }
   ```
   > ✅ **Энэ файлыг git-д commit хийнэ.** Нууц биш — Google өөрөө ингэж
   > хэлдэг, бас APK дотор ямар ч тохиолдолд шигтгэгддэг тул хэн ч задлаж
   > авч чадна. Repo нь public ч гэсэн адилхан.
   >
   > `.gitignore`-д хийвэл `app.json`-оос `app.config.js` рүү шилжих
   > шаардлагатай болно (static JSON нь env хувьсагч уншиж чадахгүй, EAS file
   > secret нь тэрийг шаарддаг) — launch-ийн өмнө үүнийг хийх нь эрсдэл.
   >
   > ⚠️ Оронд нь **API key-г хязгаарла**: Google Cloud Console →
   > APIs & Services → Credentials → тухайн Android key → Application
   > restrictions → **Android apps** → `mn.app.sparkxp` + SHA-1 нэмнэ.
   > Ингэснээр хуулсан түлхүүр өөр аппаас ажиллахгүй.
   >
   > ❌ Харин **service account JSON бол жинхэнэ нууц** — git-д хэзээ ч
   > бүү оруул. Зөвхөн `eas credentials`-аар upload хийнэ.

4. **FCM V1 service account key:**
   Firebase Console → ⚙️ **Project settings** → **Service accounts** →
   **Generate new private key** → JSON татагдана.

   > FCM-ийн хуучин "Server key" (legacy) 2024 онд хаагдсан. Заавал
   > **service account JSON** байх ёстой.

5. EAS-д өгөх:
   ```bash
   cd mobile
   eas credentials
   # → Android → production → Google Service Account
   # → "Manage your Google Service Account Key for Push Notifications (FCM V1)"
   # → Set up a Google Service Account Key → татсан JSON-оо сонгоно
   ```

---

## 2. iOS (APNs)

Apple Developer данс байгаа тул EAS өөрөө хийж чадна:

```bash
cd mobile
eas credentials
# → iOS → production → Push Notifications: Manage your Apple Push Notifications Key
# → "Set up a new key" → Apple руу нэвтэрнэ → EAS автоматаар үүсгэж хадгална
```

`app.json` дээр нэмэлт зүйл хэрэггүй — `expo-notifications` plugin аль хэдийн
байгаа, `bundleIdentifier` = `mn.app.sparkxp`.

---

## 3. Шалгах

Push нь **Expo Go дээр ажиллахгүй** (Expo SDK 53-аас хассан). Заавал
dev/production build хэрэгтэй.

```bash
cd mobile
eas build --profile development --platform android   # эсвэл ios
# суулгаад аппаа нээ → нэвтэр → зөвшөөрөл асуухад "Зөвшөөрөх"
```

Token бүртгэгдсэн эсэхийг шалгах:
```sql
-- Railway → Postgres
SELECT id, username, expo_push_token, push_enabled
FROM users WHERE expo_push_token IS NOT NULL;
```

Гараар нэг мэдэгдэл илгээж үзэх ([Expo push tool](https://expo.dev/notifications)
эсвэл curl):
```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{"to":"ExponentPushToken[xxxxx]","title":"SparkXP","body":"Тест 🎉"}'
```

Админаас broadcast илгээх: `POST /notifications/broadcast` (admin эрхтэй).

---

## 4. Код тал дээр юу хийгдсэн бэ

| Файл | Юу |
|---|---|
| `src/lib/pushRegistration.ts` | **Шинэ.** Зөвшөөрөл асуух, Expo token авах, backend руу илгээх. Android channel үүсгэнэ, foreground handler тавина |
| `src/auth/AuthContext.tsx` | Нэвтрэх / session сэргээхэд token бүртгэнэ, гарахад устгана |
| `app/settings.tsx` | "Мэдэгдэл" switch одоо `POST /notifications/prefs` рүү бодитоор ханддаг (өмнө нь зөвхөн локал туг байсан) |
| `src/api/notifications.ts` | Хуучирсан "expo-notifications суулгаагүй" тайлбарыг зассан |

**Аюулгүй байдлын зан төлөв:**
- Expo Go → бүх функц **no-op**, алдаа гаргахгүй
- Симулятор → no-op (`Device.isDevice` шалгана)
- Зөвшөөрөл татгалзсан → no-op
- EAS `projectId` байхгүй → no-op
- Алдаа гарвал Sentry рүү мэдэгдээд **нэвтрэлтийг зогсоохгүй**

Тиймээс Firebase тохируулахаас өмнө merge хийсэн ч апп хэвийн ажиллана —
зүгээр л мэдэгдэл ирэхгүй.

---

## 5. Backend аль хэдийн байгаа зүйл

- `POST /notifications/token` · `DELETE /notifications/token` · `POST /notifications/prefs`
- `users.expo_push_token` · `users.push_enabled`
- Өдөр бүр **20:00 (УБ цагаар)** давтах ёстой үгийн сануулга
- `DeviceNotRegistered` token-ыг автоматаар цэвэрлэдэг (устгасан апп руу үүрд
  илгээхгүйн тулд)
- Админы broadcast

---

## 6. Дараалал (санал)

1. Firebase төсөл + `google-services.json` → `app.json`
2. FCM V1 JSON → `eas credentials`
3. APNs key → `eas credentials`
4. `eas build --profile development` → утсандаа суулга
5. Нэвтрээд token DB-д орсныг шалга
6. Гараар тест мэдэгдэл илгээ
7. 20:00-ийн сануулга ирж байгааг маргааш нь батал


---

## 7. Мэдэгдлийн нээлтийг хэмжих (Firebase Analytics-гүйгээр)

Firebase Analytics суулгах шаардлагагүй — `expo-notifications`-ийн
response listener-ээр PostHog руу event илгээж болно:

```ts
// src/lib/pushRegistration.ts дотор нэмэх боломжтой
Notifications.addNotificationResponseReceivedListener((response) => {
  track('push_opened', {
    id: response.notification.request.identifier,
  });
});
```

`AnalyticsEvent` union-д `'push_opened'` нэмэхээ бүү мартаарай
(`src/lib/analytics.ts`). Хүсвэл хэлээрэй, холбоод өгье.
