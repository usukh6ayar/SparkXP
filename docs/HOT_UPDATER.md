# SparkXP — Hot Updater (OTA) заавар

> **Юу вэ?** App Store / Play Store review **хүлээхгүйгээр** JS + UI + asset
> өөрчлөлтийг утас руу түгээх систем (хуучин CodePush-ийн орлох).  
> **Хэн ашиглах вэ?** Mobile dev (Boju / Choi) + lead (Өсөхбаяр).  
> **Stack:** Expo 54 · `hot-updater` · Cloudflare R2 + D1 + Worker.

---

## 0. 30 секундын дүгнэлт

| Хийх зүйл | Тушаал |
|---|---|
| OTA түгээх (iOS+Android) | `cd mobile && npm run ota:deploy` |
| Зөвхөн iOS | `npm run ota:deploy:ios` |
| Зөвхөн Android | `npm run ota:deploy:android` |
| Console (bundle жагсаалт) | `npm run ota:console` |
| Эрүүл эсэх | `npx hot-updater doctor` |

**OTA ажиллах нөхцөл:**
1. App-ыг **native build**-аар суулгасан байх (`expo run:ios` / `run:android` / EAS) — **Expo Go биш**
2. `EXPO_PUBLIC_HOT_UPDATER_URL` тохируулсан
3. Deploy амжилттай (`npm run ota:deploy`)
4. Утасны app version = deploy-ийн target version (`1.0.0` одоо)

---

## 1. OTA юу хийж чадах / чадахгүй

### ✅ OTA-аар (store update **шаардлагагүй**)

- Screen UI, style, i18n текст
- Bug fix (JS логик)
- API client, navigation
- Зураг/asset (bundle-д орсон)
- Ихэнх business logic

### ❌ OTA-аар **болохгүй** → шинэ store / native build

- Шинэ native library (`npm i` native module)
- `app.json` permission / plugin (camera, …)
- App icon, splash, bundle id
- Expo SDK / React Native version upgrade
- `app.json` **version** өөрчлөх (store version) — native rebuild

> Дүрэм: **зөвхөн JS өөрчлөгдсөн үү?** → OTA.  
> **Native/package native өөрчлөгдсөн үү?** → `prebuild` + store/TestFlight.

---

## 2. Архитектур (энгийн)

```text
  Dev машин                    Cloudflare                     Утас
 ─────────                    ──────────                     ────
 npm run ota:deploy
   │
   ├─ Expo bundle (iOS/Android)
   ├─ Upload ──────────────► R2 (sparkxp-hot-updater)
   └─ Metadata ────────────► D1 (bundles table)
                                      │
                              Worker (check-update)
                                      │
                         ◄────────────┘
                    App нээгдэхэд OTA шалгана
                    (HotUpdater.wrap in _layout.tsx)
```

| Resource | URL / нэр |
|---|---|
| Worker (public) | `https://sparkxp-hot-updater.sparkxp.workers.dev` |
| Check endpoint | `…/api/check-update` (app автоматаар нэмнэ) |
| R2 bucket | `sparkxp-hot-updater` |
| D1 | `sparkxp-hot-updater` |
| Channel | `production` |

---

## 3. Шинэ dev — нэг удаагийн setup

### 3.1 Repo + package

```bash
git checkout main && git pull origin main
cd mobile
npm install
```

### 3.2 Env файлууд

**A) `mobile/.env`** (app runtime — commit **хийхгүй**):

```bash
# Backend API (локал эсвэл prod)
EXPO_PUBLIC_API_URL=https://sparkxp-production.up.railway.app/api

# Hot Updater Worker (trailing slash БИТГИЙ)
EXPO_PUBLIC_HOT_UPDATER_URL=https://sparkxp-hot-updater.sparkxp.workers.dev
```

**B) `mobile/.env.hotupdater`** (deploy secrets — commit **хийхгүй**):

```bash
cp .env.hotupdater.example .env.hotupdater
# Lead-ээс бөглөсөн утгуудыг ав, эсвэл:
```

| Түлхүүр | Тайлбар |
|---|---|
| `HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `HOT_UPDATER_CLOUDFLARE_R2_BUCKET_NAME` | `sparkxp-hot-updater` |
| `HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID` | UUID |
| `HOT_UPDATER_CLOUDFLARE_WORKER_NAME` | `sparkxp-hot-updater` |
| `HOT_UPDATER_CLOUDFLARE_API_TOKEN` | **Заавал** — D1 + (Wrangler path) R2 |
| `HOT_UPDATER_CLOUDFLARE_R2_ACCESS_KEY_ID` | Optional (S3 хурдан path) |
| `HOT_UPDATER_CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Optional |

**API token авах (удаан хугацаанд):**

1. [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)  
2. Create Token → custom  
3. Permissions: **Account → D1 → Edit** (ба R2/Workers шаардлагатай бол нэм)  
4. `.env.hotupdater` руу paste

**R2 S3 keys (илүү хурдан upload — сонголт):**

1. Dashboard → R2 → **Manage R2 API Tokens**  
2. Bucket `sparkxp-hot-updater` · Object Read & Write  
3. Access Key + Secret-ийг `.env.hotupdater`-т тавина  
4. `hot-updater.config.ts` хоёулаа бөглөгдсөн бол автоматаар S3 mode ашиглана

**Түр зуур (dev):** `npx wrangler login` → OAuth token-ийг
`HOT_UPDATER_CLOUDFLARE_API_TOKEN` болгож болно (хугацаатай, ~өдөр дуусна).

### 3.3 Эрүүл эсэх

```bash
cd mobile
npx hot-updater doctor
# → All checks passed. Healthy.
```

### 3.4 Native app (OTA хүлээн авах төхөөрөмж)

```bash
cd mobile
npx expo prebuild          # ios/ + android/ үүсгэнэ (эхний удаа)
npx expo run:ios           # эсвэл run:android
# Утсанд/simulator дээр app сууна — Expo Go биш!
```

EAS ашиглавал:

```bash
eas build --profile development   # эсвэл preview/production
# build-ийг утсанд суулгаад дараа нь OTA deploy хийнэ
```

---

## 4. Өдөр тутмын ажиллагаа (ихэвчлэн зөвхөн энэ)

### 4.1 JS/UI засвар хийсэн

```bash
cd mobile
# 1) код засах, локал турших (expo start / native)
# 2) OTA түгээх:
npm run ota:deploy
```

Амжилттай бол:

```text
✅ iOS Deployment Successful
✅ Android Deployment Successful
🚀 Deployment Successful (iOS, Android)
```

### 4.2 Хэрэглэгч/dev утас дээр

1. App-ыг **бүрэн хаах** (swipe away)  
2. Дахин нээх  
3. Хэсэг секунд: “Шинэчлэл шалгаж байна…” / “Шинэчлэл суулгаж байна…”  
4. Шинэ UI/логик орно  

Хэрэв гарахгүй бол §7 troubleshooting.

### 4.3 Зөвхөн нэг platform

```bash
npm run ota:deploy:ios
npm run ota:deploy:android
```

### 4.4 Force update (яаралтай — app дахин ачаална)

```bash
npx hot-updater deploy -t 1.0.0 -f
# эсвэл interactive:
npx hot-updater deploy -i -f
```

⚠️ **Force-ыг production-д анхдагч болгож БОЛОХГҮЙ.** Bundle ~15 MB тул муу
сүлжээтэй хэрэглэгч татаж дуустал аппаа огт нээж чадахгүй. Force нь зөвхөн
яаралтай засварт (өгөгдөл алдагдуулж буй bug, аюулгүй байдал).

---

### 4.6 🚦 Production release — үе шаттай (staged) rollout

> **App Store дээр гарсны дараа энэ бол ЗААВАЛ. Шууд 100% BATTLE биш.**
>
> Учир нь: эвдэрхий bundle-ыг OTA-гаар буцааж засах баталгаа **байхгүй**.
> `bundle disable` / `rollback` нь **шалгалт хийсээр байгаа** төхөөрөмжид л
> хүрнэ. Hot Updater-ийн native crash-rollback нь bundle **унасан** үед л
> ажилладаг — 2026-08-08-ны алдаа шиг "ажиллаж байгаа мөртлөө OTA-гаа
> унтраасан" bundle-ыг илрүүлэхгүй. Тэр тохиолдолд ганц зам нь хэрэглэгч
> бүр аппаа устгаж дахин суулгах — App Store дээр боломжгүй зүйл.

```bash
cd mobile

# 1) 10% дээр гаргана (force-гүй!)
npx hot-updater deploy -p ios -t 1.0.0 -r 10

# 2) Bundle доторх мөрийг ШАЛГА (§7 дэх скрипт) — 0 гарвал тэр дороо disable

# 3) 1–2 цаг Sentry-г хар: crash-free rate унасан уу? шинэ issue гарсан уу?

# 4) Асуудалгүй бол өргөтгө (cohort count 0–1000, 1000 = 100%)
npx hot-updater bundle update <bundle-id> --rollout-cohort-count 500   # 50%
npx hot-updater bundle update <bundle-id> --rollout-cohort-count 1000  # 100%

# Асуудал гарвал:
npx hot-updater bundle disable <bundle-id> -y
```

| Алхам | Хамрах хүрээ | Юу хардаг |
| --- | --- | --- |
| `-r 10` | 10% | bundle доторх мөр · Sentry crash-free |
| `--rollout-cohort-count 500` | 50% | Sentry · хэрэглэгчийн гомдол |
| `--rollout-cohort-count 1000` | 100% | — |

**Release checklist (production OTA бүрд):**

- [ ] `main` дээрх код, CI ногоон
- [ ] `-r 10`, **force-гүй**
- [ ] Bundle татаж дотор нь `sparkxp-hot-updater` + `…railway.app/api` **хоёулаа** байгааг батлав (§7)
- [ ] Өөрийн утсан дээр нэг нээж туршив
- [ ] 1–2 цаг Sentry ажиглав
- [ ] Шат дараалан 50% → 100%

### 4.5 Console

```bash
npm run ota:console
```

Browser-т bundle жагсаалт, channel, disable/rollback-ийн UI.

---

## 5. Version (маш чухал)

Одоо app version = **`1.0.0`**.

Deploy script:

```json
"ota:deploy": "hot-updater deploy -t 1.0.0"
```

### Яагаад `-t` вэ?

Expo managed үед `ios/`/`android/` байхгүй (эсвэл prebuild хийгээгүй) бол
Hot Updater native-аас version уншиж чадахгүй → **`-t 1.0.0` заавал**.

### Version хэзээ өсгөх вэ?

| Өөрчлөлт | Version | OTA? |
|---|---|---|
| Зөвхөн JS bugfix | `1.0.0` хэвээр | ✅ `npm run ota:deploy` |
| Store-д шинэ release (native) | `1.0.1` / `1.1.0` | Native build + `-t`-ийг **шинэ** version-д тааруул |

### Version bump checklist (store release)

1. `mobile/app.json` → `"version": "1.0.1"`  
2. `mobile/package.json` → `"version": "1.0.1"`  
3. `package.json` scripts → бүх `-t 1.0.0` → `-t 1.0.1`  
4. `npx expo prebuild` (хэрэв native өөрчлөлттэй)  
5. EAS / store build → хэрэглэгчид суулгана  
6. Дараагийн JS fix-үүд: `npm run ota:deploy` (`-t 1.0.1`)

> **OTA зөвхөн ижил target version-тай app-д орно.**  
> Утас дээр `1.0.0` байхад `-t 1.0.1` deploy хийвэл **шинэчлэл харагдахгүй**.

---

## 6. Файл / кодын газрын зураг

| Файл | Үүрэг |
|---|---|
| `mobile/hot-updater.config.ts` | Build (Expo) + R2 + D1 config |
| `mobile/.env.hotupdater` | Deploy secrets (gitignore) |
| `mobile/.env.hotupdater.example` | Template |
| `mobile/.env` | `EXPO_PUBLIC_HOT_UPDATER_URL` + API URL |
| `mobile/app.json` | Plugin `@hot-updater/react-native`, channel `production` |
| `mobile/app/_layout.tsx` | `HotUpdater.wrap` — update check + progress UI |
| `mobile/package.json` | `ota:deploy*` scripts |
| `docs/HOT_UPDATER.md` | Энэ заавар |

**App wrap логик (`_layout.tsx`):**

- `EXPO_PUBLIC_HOT_UPDATER_URL` **байхгүй** эсвэл **Expo Go** → OTA алгасна (crash-гүй)
- Native build + URL байвал → Worker-ээс update шалгана

---

## 7. Алдаа / troubleshooting

### `Target app version not found in native files`

```text
Pass -t <targetAppVersion> explicitly
```

**Шийдэл:** `npm run ota:deploy` ашигла (дотор нь `-t 1.0.0` байна).  
Гараар: `npx hot-updater deploy -t 1.0.0`

---

### `doctor` / auth fail / upload fail

```bash
npx hot-updater doctor
```

- `.env.hotupdater` байгаа эсэх, `API_TOKEN` бөглөгдсөн эсэх  
- OAuth token дууссан бол: permanent API token тавь, эсвэл `npx wrangler login`  
- R2 bucket / D1 id зөв эсэх

---

### Deploy OK, гэхдээ утас шинэчлэгдэхгүй

1. **Expo Go** биш үү? → native build шаардлагатай  
2. App version = deploy `-t` version уу?  
3. App бүрэн хаагаад нээ (шалгалт зөвхөн cold start дээр)  
4. Сүлжээ (Worker URL browser-оор нээгдэх эсэх)  
5. Channel: plugin `production` = deploy channel  
6. `shouldForceUpdate: false` бол **юу ч харагдахгүй** — bundle нь дэвсгэрт
   татагдаад зөвхөн **дараагийн** нээлтэд идэвхжинэ (`wrap.tsx` нь
   `updateBundle()`-ыг await хийхгүй). Шууд харагдуулах бол:
   `npx hot-updater bundle update <id> --force-update true`

---

### ☠️ Bundle доторх мөрийг **заавал** шалга (2026-08-08-ны сургамж)

`hot-updater deploy` нь **локал машин дээр** `expo export` ажиллуулж, тиймээс
`EXPO_PUBLIC_*`-ыг `eas.json`-оос БИШ, `mobile/.env`-ээс уншина. `eas.json`-ы
build профайлд л байгаа хувьсагч OTA bundle-д **инлайн болохгүй**.

Ингэснээр 2026-08-08-нд `EXPO_PUBLIC_HOT_UPDATER_URL`-гүй bundle гарч,
`_layout.tsx`-ийн хамгаалалт (`if (!raw) return App`) OTA-г **өөрөө нь
унтраасан** — тэр bundle суусан төхөөрөмж дахин хэзээ ч шалгахгүй болж,
зөвхөн аппыг устгаад дахин суулгаж сэргээх боломжтой байв.

**Одоо:** Worker URL нь `app/_layout.tsx`-д `HOT_UPDATER_URL` гэсэн **хатуу
анхдагч** (нийтийн хаяг). Env нь зөвхөн override.

**Deploy бүрийн дараа шалга:**

```bash
# check-update-ээс fileUrl авч, bundle-ыг татаад дотор нь хар
unzip -o b.zip -d bundle
python3 -c "
d=open('bundle/index.ios.bundle','rb').read()
for s in ['sparkxp-hot-updater','sparkxp-production.up.railway.app']:
    print(s, d.count(s.encode()))"   # хоёулаа ≥1 байх ёстой
```

⚠️ Hermes нь ASCII биш мөрийг **UTF-16**-аар хадгалдаг тул кирилл мөр хайхад
`s.encode('utf-16-le')` ашигла — `strings`/`grep` нь худал "олдсонгүй" өгнө.

---

### “Шинэчлэл…” дэлгэцэнд гацна

- Сүлжээ / Worker down  
- Bundle том, удаан татаж байна  
- Force close → дахин нээ  
- `npm run ota:console` — bundle enabled эсэх

---

### Native module нэмсний дараа OTA-аар “унана”

Native dep нэмсэн бол **зөвхөн OTA хангалтгүй** — шинэ native binary build заавал.

---

## 8. Rollback / disable

```bash
npm run ota:console
# эсвэл:
npx hot-updater rollback production
```

Console-оос сүүлийн bundle-ийг disable хийж болно. Хэрэглэгчид дараагийн
нээлтээр өмнөх/embedded bundle руу буцна (бодлогоос хамаарна).

Яаралтай:

```bash
npx hot-updater deploy -t 1.0.0 -f -m "hotfix: revert bad UI"
```

---

## 9. Team workflow (3 dev)

| Хэн | Юу хийх |
|---|---|
| **Boju / Choi** | Mobile JS засах → `npm run ota:deploy` (token байвал) |
| **Өсөхбаяр** | `.env.hotupdater` secrets, Cloudflare, Worker, native/EAS release |
| **Бүгд** | `main` pull → conflict-гүй OTA; том native өөрчлөлтийг зарлана |

**PR дүрэм:**
- Зөвхөн JS → merge + OTA  
- Native / `package.json` native deps → PR-д “native rebuild шаардлагатай” гэж тэмдэглэ

`.env.hotupdater` **хэзээ ч commit хийхгүй** (`.gitignore` дотор).

---

## 10. Анхны native + OTA checklist (launch)

- [ ] `mobile/.env` — `EXPO_PUBLIC_HOT_UPDATER_URL` + API URL  
- [ ] `mobile/.env.hotupdater` — API token (lead)  
- [ ] `npx hot-updater doctor` → Healthy  
- [ ] `npx expo prebuild`  
- [ ] `npx expo run:ios` / `run:android` (эсвэл EAS) → утсанд суулга  
- [ ] Жижиг UI өөрчлөлт хий  
- [ ] `npm run ota:deploy` → Successful  
- [ ] App хаагаад нээ → шинэчлэл орсон  
- [ ] App Store / Play-д native build илгээхэд version sync (`-t` + `app.json`)

---

## 11. Түгээмэл командуудын хуулбар

```bash
cd mobile

# Эрүүл мэнд
npx hot-updater doctor

# Бүтэн OTA (iOS + Android), version 1.0.0
npm run ota:deploy

# Нэг platform
npm run ota:deploy:ios
npm run ota:deploy:android

# Force
npx hot-updater deploy -t 1.0.0 -f -m "emergency fix"

# Console
npm run ota:console

# Native (OTA хүлээн авагч app)
npx expo prebuild
npx expo run:ios
npx expo run:android
```

---

## 12. Холбоос

- Hot Updater docs: https://hot-updater.dev  
- Cloudflare R2 tokens: Dashboard → R2 → Manage R2 API Tokens  
- API tokens: https://dash.cloudflare.com/profile/api-tokens  
- Worker: https://sparkxp-hot-updater.sparkxp.workers.dev  

---

*Сүүлд шинэчилсэн: 2026-07-14 · SparkXP mobile Hot Updater v0.35.3 · target app 1.0.0*
