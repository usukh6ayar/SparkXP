# SparkXP — Эхнээс нь launch (заавар)

> **Зорилго:** GitHub → backend prod → native app (TestFlight/Play) → OTA → 3D buddy.  
> **Баг:** 3 dev. Lead = Өсөхбаяр.  
> **Огноо:** 2026-07.

Энэ файл **дарааллыг** тогтооно. Дэлгэрэнгүй OTA: [`HOT_UPDATER.md`](./HOT_UPDATER.md).  
3D Meshy: [`AI_BUDDY_AVATAR_MESHY.md`](./AI_BUDDY_AVATAR_MESHY.md).

---

## 0. Том зураг (ямар дараалал)

```text
①  Repo цэвэр + README          ✅ (энэ PR)
②  Backend prod (Railway Hobby)  ← pause байвал upgrade
③  Mobile env + Hot Updater     ✅ worker бэлэн
④  Apple Developer $99          ← чи хийнэ
⑤  EAS init + first native build
⑥  TestFlight / internal APK
⑦  OTA deploy (JS/UI)
⑧  3D GLB → R2 → admin URL      ← store update ШААРДЛАГАГҮЙ
⑨  App Store / Play submit
```

**Чухал:** 3D model-ийг **CDN URL**-аар холбовол App Store дахин илгээх **хэрэггүй**.  
Гэхдээ **эхний** native binary (three.js/expo-gl орсон) байх ёстой → алхам ⑤–⑥.

---

## 1. Repo / GitHub

```bash
git checkout main && git pull origin main
```

- Root [`README.md`](../README.md) — төслийн танилцуулга  
- [`docs/HOT_UPDATER.md`](./HOT_UPDATER.md) — OTA  
- Secrets **commit битгий**: `.env`, `.env.hotupdater`, `*.glb`

---

## 2. Backend (Railway)

Одоо trial дууссан → **Paused** байсан.

| Алхам | Үйлдэл |
|---|---|
| 1 | Railway → **Upgrade to Hobby** (~$5 base + usage) |
| 2 | Postgres / Redis / SparkXP → **Running** |
| 3 | `curl https://sparkxp-production.up.railway.app/api/health` |
| 4 | (Сонголт) Postgres → Neon Free; API Railway-д үлдээ |

Env (prod): `DATABASE_URL`, `DB_SSL`, `DB_SYNCHRONIZE=false`, `REDIS_URL`, JWT, AI keys, R2.

---

## 3. Mobile env (машин бүрт)

```bash
cd mobile
cp .env.example .env
cp .env.hotupdater.example .env.hotupdater
```

**`.env`:**
```bash
EXPO_PUBLIC_API_URL=https://sparkxp-production.up.railway.app/api
EXPO_PUBLIC_HOT_UPDATER_URL=https://sparkxp-hot-updater.sparkxp.workers.dev
```

**`.env.hotupdater`:** lead-ээс token (эсвэл Cloudflare Dashboard token).  
Шалгах: `npx hot-updater doctor`

---

## 4. Apple + Google account (хүн хийнэ)

| Account | Үнэ | Юунд |
|---|---|---|
| [Apple Developer](https://developer.apple.com/programs/) | **$99 / жил** | iOS build, TestFlight, App Store, push |
| [Google Play Console](https://play.google.com/console) | **$25 нэг удаа** | Android release |
| [Expo](https://expo.dev) | Үнэгүй tier | EAS Build |

Бүртгэл бэлэн болохоос өмнө EAS iOS production submit **болохгүй**.

---

## 5. EAS — эхний native build

### 5.1 Нэг удаа

```bash
cd mobile
npm install
npm install -g eas-cli   # эсвэл npx eas-cli

# Expo login
npx eas-cli login

# Төсөл холбох → app.json-д extra.eas.projectId бичигдэнэ
npx eas-cli init

# (хэрэв eas.json аль хэдийн байвал)
npx eas-cli build:configure   # optional confirm
```

`app.json`-д шаардлагатай:

- `ios.bundleIdentifier`: `com.usukh6ayar.englishxp`
- `android.package`: `com.usukh6ayar.englishxp`
- `extra.eas.projectId`: `eas init`-ийн дараа

### 5.2 Development build (баг дотоод — OTA тест)

```bash
# iOS (физик iPhone + Apple Developer)
npx eas-cli build --platform ios --profile development

# Android APK
npx eas-cli build --platform android --profile development
```

Build дуусахад QR / link-ээр утсанд суулга. **Expo Go биш.**

### 5.3 Preview / Production

```bash
# Internal test
npx eas-cli build --platform all --profile preview

# Store
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production

# Submit (credentials бөглөсний дараа)
npx eas-cli submit --platform ios --profile production
npx eas-cli submit --platform android --profile production
```

`eas.json` → `submit.production.ios` дотор `appleId`, `ascAppId`, `appleTeamId` бөглө.

---

## 6. OTA (native app суусны ДАРАА)

```bash
cd mobile
# JS/UI засвар
npm run ota:deploy
```

- Target version: **1.0.0** (`package.json` script `-t 1.0.0`)
- App version ижил байх ёстой
- App хаагаад нээ → update

Дэлгэрэнгүй: [`HOT_UPDATER.md`](./HOT_UPDATER.md)

---

## 7. 3D AI Buddy — store update **гүйгээр**

### 7.1 Яагаад OK вэ?

- App-д `expo-gl` + `three` + `BuddyAvatar` **аль хэдийн** байна  
- GLB = **remote URL** (`ai_buddies.avatar_asset_url`)  
- Шинэ model = R2 upload + admin URL → **OTA ч, Store ч шаардлагагүй**

### 7.2 Алхам

1. Meshy: **Remesh low poly** (~10–30k faces), texture ≤1024  
2. **Rig** + idle/happy/thinking clips  
3. (Сонголт) Blender → `mouth_open` morph  
4. Export GLB **&lt; 5 MB**  
5. Cloudflare R2 → bucket (ж: `sparkxp` эсвэл `sparkxp-hot-updater`)  
   - Public URL эсвэл CDN  
6. Admin → AI Buddy → `police` (эсвэл spark)  
   - **Avatar GLB URL** = R2 URL  
   - **Thumbnail** = PNG  
7. Mobile: `SHOW_3D_AVATAR = true` (хэрэв flag байвал) + voice stage wire  
8. Утас дээр шалгах — **шинэ store build шаардлагагүй** (native 3D lib орсон binary дээр)

### 7.3 Хэзээ store build хэрэгтэй вэ?

| Нөхцөл | Store? |
|---|---|
| Зөвхөн GLB URL солих | ❌ |
| `SHOW_3D` flag / JS wire | ❌ (OTA) |
| Анх удаа three/expo-gl **нэмэх** | ✅ (аль хэдийн нэмэгдсэн) |
| Unity embed | ✅ том өөрчлөлт |

**Одоогийн `police.glb` (~33MB, unrigged)** — repo-д битгий; optimize хийгээд R2-д тавь.

```bash
# Жишээ R2 upload (wrangler login хийсний дараа)
npx wrangler r2 object put sparkxp/ai-buddy/police.glb \
  --file=./police-optimized.glb \
  --content-type=model/gltf-binary
```

---

## 8. Checklist — “эхнээс дуусах”

### A. Infrastructure
- [ ] Railway Hobby + services Running  
- [ ] API health 200  
- [ ] Cloudflare R2 media + OTA worker амьд  
- [ ] Hot Updater doctor OK  

### B. Accounts
- [ ] Apple Developer ($99)  
- [ ] Google Play ($25) — Android-д  
- [ ] Expo login + `eas init`  

### C. First binary
- [ ] `app.json` package + projectId  
- [ ] Icon / splash файлууд байгаа  
- [ ] `eas build --profile development` iOS + Android  
- [ ] Багийн утсанд суулгасан  

### D. OTA loop
- [ ] `npm run ota:deploy` Successful  
- [ ] App restart → шинэ UI  

### E. 3D
- [ ] Optimized rigged GLB &lt; 5MB  
- [ ] R2 public URL  
- [ ] Admin avatarAssetUrl  
- [ ] Device дээр 3D харагдана  

### F. Store
- [ ] Screenshots, description (MN/EN)  
- [ ] `eas build --profile production`  
- [ ] `eas submit` → TestFlight / Play internal  
- [ ] Review  

---

## 9. Зардал (ойролцоо)

| Зүйл | Үнэ |
|---|---|
| Railway Hobby | ~$5–20/сар |
| Neon Free (сонголт) | $0 |
| Cloudflare R2 | ~$0–1 |
| Apple Developer | $99/жил |
| Google Play | $25 нэг удаа |
| EAS free tier | хязгаартай build/сар |
| AI (ElevenLabs/Claude) | usage — хамгийн том |

---

## 10. “Одоо би юу хийх вэ?” (дараалал)

| # | Хэн | Үйлдэл | Блокер |
|---|---|---|---|
| 1 | Өсөхбаяр | Railway Hobby upgrade | Trial pause |
| 2 | Өсөхбаяр | Apple Developer бүртгэл | $99 |
| 3 | Өсөхбаяр | `eas login` + `eas init` | Expo account |
| 4 | Өсөхбаяр | Development build iOS | Apple account |
| 5 | Баг | Утсанд суулгаад OTA турш | — |
| 6 | Design/Lead | Meshy optimize GLB → R2 | — |
| 7 | Admin | avatarAssetUrl | — |
| 8 | Lead | Production build + TestFlight | — |

---

*SparkXP launch-from-scratch · 2026-07*
