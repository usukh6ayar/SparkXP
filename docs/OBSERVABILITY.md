# Observability — Sentry + PostHog (mobile)

Аппыг ажиллуулж эхэлсний дараа "юу эвдэрсэн", "хэн юу хийж байна", "хаана удаан
байна" гэдгийг харах давхарга. **Зөвхөн `/mobile`** дээр (backend/admin дээр
хараахан алга).

| Хэрэгсэл | Юуг хариуцах | Багц |
| --- | --- | --- |
| **Sentry** | Crash · JS алдаа · 5xx · performance trace | `@sentry/react-native` |
| **PostHog** | Product analytics (screen view, funnel, retention) | `posthog-react-native` |
| ~~EAS Observe~~ | **Одоохондоо БОЛОМЖГҮЙ** — доороос уншина уу | `expo-observe` |

---

## ⛔ EAS Observe яагаад алга вэ

`expo-observe` нь **Expo SDK 55+** шаарддаг. Энэ төсөл SDK 54 дээр зориудаар
түгжээтэй (`CLAUDE.md` → "Expo SDK-г 54-өөс ДЭЭШЛҮҮЛЖ БОЛОХГҮЙ", 2026-08-04):
App Store дээрх iOS Expo Go 54.0.2 дээр царцсан, Choi/Boju хоёулаа iPhone дээр
Expo Go-гоор тестэлдэг, dev build нь $99 Apple Developer данс шаардана.

**Оронд нь Sentry Performance** ажиллаж байна — startup, дэлгэц ачаалах хугацаа,
удаан API дуудлагыг харуулна (`navigationIntegration`, `src/lib/monitoring.ts`).

Apple данс аваад SDK 55 рүү шилжсэний дараа Observe-ийг нэмэх нь ~30 минутын
ажил: `expo-observe` суулгаад root layout-ыг `ObserveRoot.wrap()`-аар ороож,
эхлэх дэлгэц бүрд `markInteractive()` дуудна.

---

## Одоо хийх ёстой зүйл (нэг удаа)

Код бэлэн; **түлхүүр байхгүй бол бүх зүйл унтарсан хэвээр** — апп яг урьдын
адил ажиллана. Асаахын тулд:

1. **Sentry** төсөл үүсгэх (platform: React Native) → `DSN`-ийг хуулах.
2. **PostHog** төсөл үүсгэх → `Project API Key` (`phc_…`) хуулах.
3. `mobile/.env`-д:
   ```bash
   EXPO_PUBLIC_SENTRY_DSN=https://…@o….ingest.sentry.io/…
   EXPO_PUBLIC_POSTHOG_KEY=phc_…
   # EU төсөл бол:
   # EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
   ```
4. `mobile/app.json` → `plugins` → `"@sentry/react-native"` доторх
   `REPLACE_WITH_SENTRY_ORG_SLUG` / `REPLACE_WITH_SENTRY_PROJECT_SLUG`-ийг
   бодит slug-аар солих.
5. **Source map** (stack trace-ийг уншиж болохуйц болгоно) — EAS дээр нууц
   хувьсагч болгож нэмнэ. `.env`-д ХЭЗЭЭ Ч бүү бич, энэ бол жинхэнэ нууц:
   ```bash
   eas env:create --name SENTRY_AUTH_TOKEN --value "sntrys_…" --visibility sensitive
   ```
   Байхгүй байсан ч build амжилттай болно — зүгээр л stack trace минифайкдсан
   хэвээр байна.

Прод дээр эхлээд `EXPO_PUBLIC_SENTRY_TRACES_RATE`-ийг `0.2` (20%) хэвээр үлдээ.
Мөрдөн шалгах үедээ түр өсгө, дараа нь буцааж бууруул — trace бүр мөнгө.

---

## Аюулгүй байдал / нууцлал

Аппыг **сургуулийн сурагчид** ашигладаг тул хоёулаа хатуу тохируулсан:

- Sentry: `sendDefaultPii: false`, `beforeSend` нь `email` / `username` /
  `ip_address`-ийг устгана. Sentry зөвхөн **UUID** мэднэ.
- PostHog: `identify` нь UUID + `role` + `level` л явуулна. Имэйл, нэр
  **явахгүй**.
- **`disableGeoip: true` заавал үлдээнэ.** PostHog нь анхдагчаар (`false`)
  хүсэлтийн IP-гээс `$geoip_city_name`, `$geoip_country_name` г.м-ийг **сервер
  талдаа** гаргаж авдаг — өөрөөр хэлбэл `identify`-д байршил бичээгүй нь
  хангалтгүй. Энэ тохиргоо л "байршил явахгүй" гэдгийг үнэн болгож байгаа юм.
- **Touch autocapture унтраалттай** — бичсэн текст элементийн шошгонд орж
  болзошгүй.
- **Session replay унтраалттай** — дэлгэц бичих нь native build + тусдаа
  нууцлалын дүгнэлт шаардана.

> ⚠️ Эдгээрийг сулруулах шаардлага гарвал эхлээд эзэмшигчээс зөвшөөрөл ав.

---

## Expo Go

- **Sentry** — JS алдаа барина; native crash, frame tracking, time-to-display
  ажиллахгүй (`isRunningInExpoGo()`-оор автоматаар унтардаг). Унахгүй.
- **PostHog** — бүрэн ажиллана (JS-only).
- Дефолтоор dev дээр хоёул **чимээгүй**. Туршихыг хүсвэл:
  `EXPO_PUBLIC_MONITORING_IN_DEV=1` · `EXPO_PUBLIC_ANALYTICS_IN_DEV=1`.

---

## Код дотор хэрхэн ашиглах вэ

**Дүрэм: `@sentry/react-native` эсвэл `posthog-react-native`-ийг дэлгэцээс шууд
import хийхгүй.** Зөвхөн доорх хоёр модулиар дамжина (CODING_RULES · DRY).

### Алдаа мэдээлэх

```ts
import { captureError, addTrace } from '../../src/lib/monitoring';

try {
  await doSomething();
} catch (err) {
  captureError(err, { where: 'lesson/video', lessonId });  // хувийн мэдээлэл БҮҮ хий
}
```

`api/client.ts` нь **5xx**-ийг автоматаар мэдээлнэ. 4xx (буруу нууц үг, зүрх
дууссан г.м.) нь хэвийн байдал тул мэдээлдэггүй; сүлжээ тасрахад зөвхөн
breadcrumb үлдээнэ.

### Event илгээх

```ts
import { track } from '../../src/lib/analytics';

track('lesson_completed', { lessonId, score });
```

`AnalyticsEvent` бол **хаалттай union** — шинэ event нэмэхдээ эхлээд
`src/lib/analytics.ts`-ийн жагсаалтад нэрийг нь бич, эс бөгөөс TypeScript алдаа
өгнө. (Зориуд: чөлөөт текст нэр бол хэн ч анзаардаггүй хоосон график төрүүлдэг.)

Нэрлэх заавар: `object_verb_past_tense` (`lesson_completed`,
`quiz_abandoned`). Хувийн мэдээлэл бүү тавь.

### Дэлгэцийн үзэлт

Автоматаар — `AnalyticsProvider` дотор `usePathname()`-аар. Гар ажиллагаа
шаардлагагүй. `/lesson/<uuid>` гэх мэт зам нь `/lesson/:id` болж нэгтгэгдэнэ.

---

## Одоо цуглуулж байгаа event-үүд

| Event | Хаанаас |
| --- | --- |
| `$screen` | route солигдох бүрд (автомат) |
| `Application Opened/Backgrounded/Installed/Updated` | PostHog lifecycle (автомат) |
| `onboarding_started` | Welcome дэлгэцийн "Эхлэх" |
| `onboarding_step_completed` (`step`, `answer`) | зорилго · түвшин · минут |
| `onboarding_buddy_demo_completed` | AI Buddy demo |
| `onboarding_finished` (`exit`: register/guest/login) | 7-р дэлгэцээс гарах бүрд |
| `signed_up` · `logged_in` · `logged_out` | `AuthContext` |

Хичээл, сорил, AI Buddy-н event-үүдийг тухайн дэлгэцийг эзэмшдэг хүн (Choi /
Boju) нэмнэ — дээрх 3 мөрийн жороор.

---

## Bundle хэмжээ

Хоёр SDK нь JS bundle-ийг **~12.7 MB → 14.6 MB** болгож өсгөсөн. Hot Updater
OTA-аар татагддаг тул анхны шинэчлэл арай хүнд болно. Хэрэв энэ асуудал болвол
эхлээд PostHog-оос татгалзах нь Sentry-гээс татгалзахаас илүү зөв (crash харах
нь илүү чухал).

## OTA-гийн анхааруулга

Hot Updater-аар JS шинэчилсний дараа тухайн build-ийн source map нь ажиллаж
байгаа JS-тэй таарахгүй тул **stack trace буруу мөр заж болно**. Тогтвортой
болгох хүртэл гол crash-уудыг OTA биш, шинэ build дээр шалгаж байх нь дээр.
