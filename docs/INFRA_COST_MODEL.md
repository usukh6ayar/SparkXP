# SparkXP — Infrastructure зардлын загвар (AI API-гүй)

> Хамрах хүрээ: **зөвхөн сервер, database, storage, сүлжээ, туслах үйлчилгээ.**
> OpenAI / ElevenLabs / STT / Gemini зэрэг AI inference зардал **энд ороогүй**
> (тэдгээр нь `docs/FUTURE_PLAN.md` §4-д).
> Огноо: 2026-07-29 · Эзэн: Өсөхбаяр · Валют: **1 USD = 3,600₮**

---

## 0. TL;DR — хоёр гол тоо

| Хувилбар | Хэрэглэгч | Сарын infra зардал (Expected) | Хүрээ (min → safe) | ₮ (expected) |
| --- | --- | --- | --- | --- |
| **A** | **10,000 MAU** (≈ 2,200 DAU) | **$180 / сар** | $61 → $303 | **~648,000₮** |
| **B** | **10,000 DAU** (≈ 45,000 MAU) | **$341 / сар** | $174 → $624 | **~1,228,000₮** |

*(Хувилбар A = 2,200 DAU — §10c-ийн 1,000 DAU ($159) ба 5,000 DAU ($241) баганы
хооронд интерполяци.)*

**Гэхдээ энэ хоёр тоо аль аль нь нэг нөхцөлтэй:** медиа (зураг/аудио/видео)
**Cloudflare R2-оос** түгээгдэж байх ёстой. Хэрэв медиа Railway/Cloudinary дээр
үлдвэл Хувилбар B-д **egress дангаараа $375–1,050/сар нэмэгдэнэ** — бусад бүх
зардлын нийлбэрээс их. Дэлгэрэнгүйг §6.

**Хамгийн чухал дүгнэлт:** `docs/CLOUDFLARE_MIGRATION_PLAN.md`-ийн Фаз 2 (аудио)
ба Фаз 3 (зураг) нь "сайхан байх" ажил биш — **10,000 DAU-д хүрэхийн урьдчилсан
нөхцөл**. R2-ийн egress = $0.00, Railway-гийн egress = $0.05/GB.

---

## 1. Ашиглаж буй системийн бүтэц (одоо байгаагаар)

| Давхарга | Технологи | Байршил |
| --- | --- | --- |
| Mobile | React Native + Expo (Expo Router) | App Store / Play Store |
| Backend | **NestJS (TypeScript, Node.js)** | **Railway** |
| Database | **PostgreSQL + TypeORM** — **managed** (Railway plugin) | Railway |
| Cache | **Redis (ioredis)** — managed | Railway |
| Admin web | Vite + React | Vercel |
| Медиа storage | Cloudinary (зураг/аудио) + **Cloudflare R2** (GLB) | холимог |
| OTA | Hot Updater — **өөрсдийн hosting** (EAS Update биш) | Cloudflare |
| Push | Expo Push (`expo-notifications`) | Expo |
| Error tracking | Sentry (`initSentry()` — `main.ts:14`) | Sentry |

### Architecture (одоогийн)

```
 Mobile (Expo)                     Admin (Vite/React, Vercel)
      │  HTTPS/JSON                          │  HTTPS/JSON
      │  multipart audio (buddy turn, ≤2MB)  │
      ▼                                      ▼
 ┌──────────────────────────────────────────────────┐
 │  Railway edge  →  NestJS API (single service)     │
 │  helmet · ValidationPipe · Throttler · gzip@edge  │
 └───────┬───────────────┬───────────────┬──────────┘
         │               │               │
   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼──────────┐
   │ Postgres  │   │  Redis    │   │ AI Gateway     │→ Gemini/OpenAI/ElevenLabs
   │ (managed) │   │ (cache)   │   │ (энэ тооцоонд  │   (зардал нь энд ороогүй)
   └───────────┘   └───────────┘   │  ороогүй)      │
                                   └────────┬───────┘
                                            │ storeMedia()
                                   ┌────────▼─────────┐
   Mobile ◄── медиа татах (CDN) ───│ Cloudinary / R2  │
                                   └──────────────────┘
```

**Онцлох архитектурын баримтууд (кодоос баталгаажсан):**

- **WebSocket огт байхгүй.** `@WebSocketGateway`, `socket.io`, `@nestjs/websockets`
  — гурвуулаа repo-д алга. AI Buddy бол **HTTP request/response**
  (`POST /ai/buddy/sessions/:id/turn/audio`).
- **Background worker сервер байхгүй.** Bulk AI ажлууд ижил process дотор
  `setTimeout`/async-аар явдаг (`words.service.ts` ai-bulk, batch media).
- **Mobile талд polling байхгүй** — `setInterval` / `refetchInterval` олдсонгүй.
  Тиймээс RPS нь **зөвхөн хэрэглэгчийн үйлдлээс** хамаарна (background ачаалалгүй).
- **Медиаг төхөөрөмж дээр кэшлэдэг** — `AppImage.tsx:41` `cachePolicy="memory-disk"`
  (expo-image). Давтан үзэлт egress үүсгэхгүй. Энэ нь §6-ийн тооцоог 2-3 дахин
  бууруулж байгаа гол хүчин зүйл.
- **gzip аль хэдийн ажиллаж байна** (Railway edge: 19,104 → 5,178 байт).

---

## 2. Серверийн хэрэгцээ

### Production эхлэх үед (0 → 1,000 DAU)

| Үзүүлэлт | Утга | Шалтгаан |
| --- | --- | --- |
| Backend instance | **1** | 6 RPS peak — нэг instance хангалттай |
| vCPU / instance | 1 vCPU (burst 2) | Node single-threaded; DB-bound ачаалал |
| RAM / instance | **2 GB** | 👇 доорх RAM-ийн анхааруулга |
| Disk | 0 GB (stateless) | Медиа R2/Cloudinary дээр; `uploads/` ашиглахаа болих |
| Background worker | **Хэрэггүй** (одоо) | AI bulk л ашигладаг, ажлын цагаар |
| Load balancer | **Хэрэггүй** | Railway edge өөрөө TLS + routing хийнэ |
| Auto-scaling | **Хэрэггүй** | 1 replica + vertical headroom хангалттай |

> ⚠️ **RAM-ийн бодит эрсдэл — WebSocket биш, multipart buffer.**
> `buddy.controller.ts:51` дээр аудио turn нь `memoryStorage()`-д
> `MAX_AUDIO_BYTES = 2 MB` хүртэл буферлэдэг. Зэрэг 50 buddy turn =
> **~100 MB зөвхөн буфер**. 1 GB container-ыг CPU биш, **энэ** OOM хийнэ.
> Тиймээс 2 GB-ээс доош бүү тавь.

### Хэрэглэгчийн тоогоор өсөх байдал

| DAU | Instance | vCPU нийт | RAM нийт | LB | Auto-scale | Worker |
| --- | --- | --- | --- | --- | --- | --- |
| 1,000 | 1 | 1 | 2 GB | ✗ | ✗ | ✗ |
| 5,000 | 2 (HA) | 2 | 4 GB | Railway дотоод | ✗ | ✗ |
| **10,000** | **2** | **2–3** | **4–6 GB** | Railway дотоод | 🔶 санал болгоно | 🔶 санал болгоно |
| 20,000 | 3–4 | 4–6 | 8–12 GB | ✓ | **✓ заавал** | **✓ заавал** |

- **2 replica-г 5,000 DAU-аас** — гүйцэтгэлийн бус, **deploy-ийн зогсолтгүй байдлын**
  төлөө (одоо deploy бүрт таслалт үүсдэг).
- **Worker-ыг 10,000 DAU-аас салгах** — bulk AI ажил хэрэглэгчийн хүсэлттэй нэг
  process-д CPU булаалдахгүй байх ёстой.

---

## 3. Хэрэглэгчийн ачаалал

### Peak concurrent-ийн томьёо (шалгаж болохуйц)

```
Peak concurrent = DAU × дундаж_идэвхтэй_мин/өдөр ÷ peak_цонх_мин × peak_хувь
```

Таамаглал: **12 мин/өдөр** идэвхтэй хэрэглээ, өдрийн хэрэглээний **25%** нь
**2 цагийн** оройн цонхонд (сурагчид, 19:00–21:00) төвлөрнө.

| Үзүүлэлт | 1,000 DAU | 5,000 DAU | **10,000 DAU** | 20,000 DAU |
| --- | --- | --- | --- | --- |
| MAU (DAU÷0.22) | ~4,500 | ~23,000 | **~45,000** | ~90,000 |
| Хэрэглээ (user-min/өдөр) | 12,000 | 60,000 | 120,000 | 240,000 |
| **Peak concurrent** | **25** | **125** | **250** | **500** |
| Peak concurrent (safe ×1.5) | 38 | 190 | **375** | 750 |
| API req / хэрэглэгч / өдөр | 80 | 80 | **80** | 80 |
| Нийт req / өдөр | 80k | 400k | **800k** | 1.6M |
| **Peak RPS** | **3** | **14** | **28** | **56** |
| Peak RPS (burst ×2) | 6 | 28 | **56** | 112 |
| DB read / хэрэглэгч / өдөр | 240 | 240 | **240** | 240 |
| DB write / хэрэглэгч / өдөр | 30 | 30 | **30** | 30 |
| Peak DB read/s | 9 | 42 | **84** | 168 |
| Peak DB write/s | 1 | 5 | **11** | 21 |

**Request/response хэмжээ** (бодит хэмжилтээс):

| | Хэмжээ | Эх сурвалж |
| --- | --- | --- |
| Request (ихэвчлэн GET) | ~0.5–1 KB | header давамгайлна |
| Response, дундаж | ~6 KB түүхий / **~2 KB gzip** | `/api/words?limit=20` = 19,104 → 5,178 B |
| Buddy аудио upload | ≤ **2 MB** / turn | `MAX_AUDIO_BYTES` |
| Нийт JSON egress / хэрэглэгч / сар | 80 × 2 KB × 30 ≈ **5 MB** | |

**80 req/өдөр гэсэн таамаглалын задаргаа:** апп нээх (~8: `/me`, lessons,
leaderboard, notifications, hearts, streak) × 1.4 сессийн; хичээл/сорил
(~20, асуулт бүрт `POST /quizzes/:id/check`); SRS review (~20 үг);
swipe/saved/reading (~15); buddy turn (~5). Background polling **байхгүй** тул
энэ бүхэн нь идэвхтэй үйлдэл.

---

## 4. Database

### Нэг хэрэглэгчийн өгөгдөл

| Хүснэгт | Мөрийн тоо | Мөр бүрийн хэмжээ (индекстэй) | Дүн |
| --- | --- | --- | --- |
| `users` (profile, XP, streak, settings jsonb) | 1 | ~1 KB | **1 KB** (нэг удаа) |
| `word_reviews` (SRS төлөв) | 300 үг | ~150 B | 45 KB (хуримтлагдана) |
| `xp_logs` | 5/өдөр = 150/сар | ~120 B | **18 KB/сар** |
| `quiz_attempts` | 2/өдөр = 60/сар | ~200 B | 12 KB/сар |
| `sparks_logs` | ~30/сар | ~100 B | 3 KB/сар |
| `messages` (buddy: `text` + `raw_text` + `meta` jsonb) | ~370/сар | ~400 B | **148 KB/сар** |
| `buddy_memories` (шүүсэн товчлол) | ~50 нийт | ~200 B | 10 KB |
| `notifications` | 30/сар | ~200 B | 6 KB/сар |
| `assignment_completions`, `lesson_unlocks` | цөөн | — | ~2 KB/сар |

- **Идэвхтэй төлбөрт хэрэглэгч: суурь ~50 KB + ~190 KB/сар.**
- **Free / хөнгөн хэрэглэгч: ~30 KB суурь + ~40 KB/сар** (buddy-гүй → `messages` алга).
- **Бүртгүүлээд идэвхгүй: ~5 KB нэг удаа.**

> `messages.text` / `raw_text` бол цорын ганц **хязгааргүй өсдөг** per-user багана.
> Бусад нь бүгд тогтмол хэмжээтэй мөр.

### Нийт database хэмжээ

Blended (төлбөрт+free холимог): **~120 KB/идэвхтэй хэрэглэгч/сар**.
Индекс, TOAST, WAL, bloat → түүхий дүнг **×2**.

| | 10,000 MAU (Хувилбар A) | 10,000 DAU (Хувилбар B) |
| --- | --- | --- |
| Суурь (profile + SRS) | ~0.9 GB | ~4 GB |
| **Сарын өсөлт** | **~1.2 GB → ×2 = 2.4 GB/сар** | **~5.4 GB → ×2 = 11 GB/сар** |
| 12 сарын дараа нийт | **~30 GB** | **~135 GB** |
| Контентын хүснэгт (words/lessons/quizzes — зөвхөн URL) | ~10 MB | ~10 MB |

> **Контентын хүснэгтүүд DB-д ач холбогдолгүй жижиг** — 10,000 үг × 1.3 KB = 13 MB.
> Медиа нь DB биш, R2/Cloudinary дээр байдаг (§6).
> Бодит хэмжилт: prod-д өнөөдөр **207 үг, 0 хичээл** байна — доорх бүх контентын
> тоо бол **төлөвлөсөн** сан, ажиглагдсан биш.

### Backup, replica, холболт

| Асуулт | Хариулт |
| --- | --- |
| Backup давтамж | **Өдөрт 1 бүтэн** + PITR (WAL) 7 хоног |
| Backup нэмэлт storage | **+100–150%** (7 хоногийн PITR + шахсан бүтэн хуулбар) |
| Read replica | 10,000 DAU хүртэл **хэрэггүй** (peak 84 read/s — Redis кэшээр давна). 20,000 DAU-аас 🔶 |
| DB connection limit | App: `poolSize` **тохируулаагүй → default 10/instance**. 2 instance = 20. Postgres талд **100–200** (managed default) хангалттай. ⚠️ 3+ instance болбол **PgBouncer** эсвэл `extra.max` заавал тохируулна |
| 10,000 DAU-д ямар instance | **2 vCPU / 8 GB RAM / 200 GB SSD** managed Postgres |

---

## 5. AI Buddy memory

| Асуулт | Хариулт (кодоос) |
| --- | --- |
| Conversation бүтнээр хадгалдаг уу? | **Хоёулаа.** `messages` — бүтэн түүх (UI-д харуулах); `buddy_memories` — шүүсэн урт хугацааны товчлол. Prompt-д зөвхөн товчлол явдаг. |
| Сарын conversation data / хэрэглэгч | **~150 KB** (≈370 мөр × 400 B) |
| Аудио файл хадгалдаг уу? | **Тийм** — TTS нь `buddy_voice_cache`-д CDN URL-аар. **Хэрэглэгчийн илгээсэн аудио хадгалагддаггүй** (RAM-д буферлээд STT рүү явуулаад хаядаг). Энэ нь зөв — GDPR-ийн хувьд ч, зардлын хувьд ч. |
| Memory хаана? | **Postgres text.** `buddy_memories` дээр embedding багана **алга**, pgvector **ашиглаагүй**. |
| Vector DB зардал | **$0/сар — одоогоор ашиглаагүй.** Хэрэв ирээдүйд хэрэгтэй бол pgvector нь **тухайн Postgres дотроо нэмэлт $0** (тусад нь Pinecone $70/сар авах шаардлагагүй). |
| **100 MB per-user limit үнэхээр хэрэгтэй юү?** | **Үгүй — infra-гийн хязгаар биш, маркетингийн тоо.** Бодит хэрэглээ **~150 KB/сар** буюу 100 MB-д хүрэхэд **55 жил** шаардлагатай. Энэ нь plan-ыг ялгах "мэдрэмжийн" үзүүлэлт (Standard 100 MB / Premium 250 MB) — серверийн хувьд ямар ч утгагүй. **Хэрэглэгчид ойлгомжтой байвал үлдээ, гэхдээ үүн дээр тулгуурлаж storage төлөвлөх хэрэггүй.** |

---

## 6. Медиа: storage ба egress — **энэ бол гол зардал**

### 6a. Контент сан (хэрэглэгчийн тооноос ХАМААРАХГҮЙ)

> ⚠️ Prod-д өнөөдөр **207 үг, 0 хичээл**. Доорх нь **зорилтот** сан.

| Медиа | Тоо | Дундаж хэмжээ | Нийт |
| --- | --- | --- | --- |
| Үгийн зураг (WebP) | 10,000 | 150 KB | 1.5 GB |
| Үгийн аудио (mp3) | 10,000 | 30 KB | 0.3 GB |
| Хэлц үг (зураг+аудио) | 1,000 | 180 KB | 0.2 GB |
| Reading — өгүүлбэрийн аудио | 500 × 20 | 25 KB | 0.25 GB |
| Reading — cover | 500 | 150 KB | 0.08 GB |
| **Хичээлийн видео (720p, ~5 мин)** | **200** | **50 MB** | **10 GB** |
| Avatar GLB + анимаци | 10 | 8 MB | 0.08 GB |
| Buddy TTS кэш (өсдөг) | — | — | ~5 GB |
| **Нийт** | | | **~18 GB → 50 GB төлөвлө** |

**R2 дээр 50 GB × $0.015 = $0.75/сар.** Storage бол зардал биш. **Egress л зардал.**

### 6b. Egress — хувилбар бүрээр

Нэг идэвхтэй хэрэглэгчийн сарын татах хэмжээ (expo-image disk кэш тооцсон):

| Бүрэлдэхүүн | Minimum | Expected | High |
| --- | --- | --- | --- |
| **Хичээлийн видео** | 1/долоо хоног × 30 MB = 120 MB | **3/долоо хоног × 40 MB = 480 MB** | 1/өдөр × 60 MB = 1,800 MB |
| Үгийн зураг (шинэ үгс) | 30 MB | 45 MB | 90 MB |
| Аудио (үг + reading) | 20 MB | 30 MB | 60 MB |
| Buddy TTS тоглуулалт | 5 MB | 11 MB | 20 MB |
| JSON API (gzip) | 5 MB | 5 MB | 10 MB |
| **Дүн / хэрэглэгч / сар** | **~180 MB** | **~570 MB** | **~2.0 GB** |

**Нийт сарын egress:**

| | Minimum | Expected | High |
| --- | --- | --- | --- |
| **A: 10,000 MAU** (2,200 DAU) | 0.4 TB | **1.3 TB** | 4.4 TB |
| **B: 10,000 DAU** | 1.8 TB | **5.7 TB** | 20 TB |
| 20,000 DAU | 3.6 TB | 11.4 TB | 40 TB |

### 6c. 💥 Хоёр салаа зам — ялгаа нь бүх зардлаас том

| Egress | Cloudflare **R2** | **Railway** ($0.05/GB) |
| --- | --- | --- |
| A expected — 1.3 TB | **$0.00** | $65 |
| **B expected — 5.7 TB** | **$0.00** | **$285** |
| B high — 20 TB | **$0.00** | **$1,000** |
| 20,000 DAU high — 40 TB | **$0.00** | $2,000 |

**Cloudinary** нь bandwidth-ыг "credit"-ээр багцалдаг бөгөөд TB хэмжээнд R2-оос
1–2 эрэмбээр үнэтэй. **Яг дүнг Cloudinary dashboard-аас баталгаажуулах ёстой** —
энд таамаг тоо бичихгүй. Аль ч тохиолдолд дүгнэлт нэг: **R2 руу нүү.**

| Асуулт | Хариулт |
| --- | --- |
| CDN ашиглах уу? | **Тийм.** R2-г custom domain-д холбоход **Cloudflare CDN үнэгүй** дагалдана. Кэшийн hit нь R2 Class B ops-ыг ч бууруулна. |
| Device дээр кэшлэх үү? | **Аль хэдийн хийгдсэн** — `AppImage` = expo-image `memory-disk`. Видеонд `expo-video` кэш нэмэх нь дараагийн том хэмнэлт. |

---

## 7. Realtime AI Buddy — серверийн ачаалал

> AI API үнэ ороогүй, зөвхөн манай backend.

| Асуулт | Хариулт |
| --- | --- |
| WebSocket ашиглах уу? | **Үгүй — n/a.** Repo-д WebSocket gateway байхгүй. HTTP turn-based: `POST /ai/buddy/sessions/:id/turn/audio`. |
| Session үргэлжлэх хугацаа | ~5–8 мин (Standard: 25 voice мин/сар ≈ 4 session) |
| Peak үед зэрэг session | 10,000 DAU-д peak concurrent 250-ийн ~20% нь buddy-д = **~50 зэрэг session**. Turn нь 3–8 сек тул **зэрэг нислэгт хүсэлт ~10–20**. |
| Холболт бүрийн RAM | **WebSocket байхгүй тул тэг.** Оронд нь: нислэгт multipart **2 MB/turn** (`memoryStorage`). 20 зэрэг turn = **~40 MB**, 50 = **~100 MB**. |
| Аудио манай серверээр дамжих уу? | **Хэсэгчлэн.** ⬆️ **Upload (STT) — тийм** (client → манай сервер → ElevenLabs). ⬇️ **Playback (TTS) — үгүй**: `buddy.service.ts:555` TTS-ийг R2/Cloudinary руу хийгээд **URL буцаадаг**; төхөөрөмж CDN-ээс татна. |
| Сарын bandwidth | **Ingress** (upload): 10,000 DAU × 4 turn/өдөр × 0.5 MB × 30 = **600 GB/сар — үүлэн үйлчилгээнүүд ingress-ийг үнэгүй авдаг → $0**. **Egress** (TTS сонсох) нь §6-д аль хэдийн орсон (11 MB/хэрэглэгч/сар). |

**Ачааллын хувьд AI Buddy бол хямд** — CPU-г ElevenLabs/Claude хийж байгаа, манай
сервер зөвхөн проксилж, лог бичиж байна. Цорын ганц эрсдэл нь дээрх RAM буфер.

---

## 8. Бусад үйлчилгээ

| Үйлчилгээ | Provider | Plan | Сарын үнэ | Тайлбар |
| --- | --- | --- | --- | --- |
| Authentication | **Өөрсдийн** (JWT, `src/auth`) | — | **$0** | Auth0/Clerk хэрэггүй |
| Push notification | **Expo Push** | Free | **$0** | Expo push нь хязгааргүй үнэгүй |
| Email (мэдэгдэл) | **Resend** | Free → Pro | **$0 → $20** | OTP нь SMS руу шилжсэн тул зөвхөн мэдэгдэл/тайланд |
| **SMS / OTP** | **CallPro** | гэрээт | **$12 → $49** | **22₮/мсж (НӨАТ-тай)**. Бүртгэл + нууц үг сэргээх. §8b-г үз |
| Төлбөр | **QPay** | гэрээт | **орлогын 1%** | Infra биш — гүйлгээний зардал. §8c-г үз |
| Analytics | PostHog Cloud free / өөрсдийн | Free | **$0 → $0** | 1M event/сар үнэгүй |
| Error tracking | **Sentry** | Team | **$26** | Аль хэдийн код дотор холбогдсон (`initSentry`) |
| Logs | Railway дотоод → Better Stack | Free → $10 | **$0 → $10** | Railway лог 7 хоног хадгална; илүү удаан хэрэгтэй бол |
| Monitoring / uptime | Better Stack / UptimeRobot | Free | **$0** | `/api/health` аль хэдийн бэлэн |
| Security / firewall | **Cloudflare** | Free | **$0** | WAF free tier |
| DDoS protection | **Cloudflare** | Free | **$0** | Хязгааргүй L3/L4 хамгаалалт үнэгүй |
| Automated backup | Managed DB дотор | — | **$3–20** | §4-ийн storage-аар тооцно |
| Domain + SSL | Cloudflare Registrar | — | **~$1.5** | ~$18/жил; SSL үнэгүй |
| Admin hosting | **Vercel** | Hobby → Pro | **$0 → $20** | Арилжааны хэрэглээнд Pro шаардана |
| CI/CD | **GitHub Actions** | Free | **$0** | Public/жижиг repo-д 2,000 мин үнэгүй |
| Staging server | Railway | жижиг instance | **$5–10** | 0.5 vCPU / 1 GB, өдрийн цагаар |
| Dev/test server | локал | — | **$0** | Хөгжүүлэгч бүр өөрийн машин дээр |
| Mobile build | **EAS** | Free → Starter | **$0 → $19** | OTA нь **Hot Updater (өөрсдийн)** тул EAS Update MAU төлбөр **ороогүй** |

**Туслах үйлчилгээний дүн: ~$35 (min) · ~$96 (expected) · ~$135 (safe)** — SMS
энд ороогүй, доор тусад нь.

### 8b. SMS OTP — CallPro (шинэ, 2026-07-29)

Бүртгэл ба OTP нь **утасны дугаараар** явна. CallPro тариф: **22₮/мессеж (НӨАТ-тай)**.

| | 10,000 MAU (тогтвортой) | 10,000 DAU (өсөж буй) |
| --- | --- | --- |
| Сарын шинэ бүртгэл | ~1,500 | ~6,000 |
| + дахин илгээх (25%) | 375 | 1,500 |
| Нууц үг сэргээх | ~100 | ~400 |
| **Нийт SMS/сар** | **~2,000** | **~7,900** |
| **Зардал** | **44,000₮ (~$12)** | **174,000₮ (~$48)** |

**Нэг удаагийн launch spike:** 45,000 хэрэглэгч 3–4 сард бүртгүүлбэл
45,000 × 1.25 × 22₮ ≈ **1.24 сая₮** тэр хугацаанд тархана.

> ⚠️ **SMS бол цорын ганц урвуулан ашиглаж болох зардлын мөр.** Bot санамсаргүй
> дугаар руу бүртгэл дуудвал мессеж бүр **22₮ шатна**. Заавал:
> - IP тутам **цагт 3 OTP** (`@nestjs/throttler` аль хэдийн байгаа)
> - Дугаар тутам **өдөрт 5 OTP**
> - Дахин илгээхэд **60 сек cooldown**
> - Зөвхөн Монголын форматыг зөвшөөрөх (`+976`, 8 орон)
>
> Эдгээргүйгээр сарын SMS данс хэдэн зуун мянган төгрөгөөр огцом өсөх боломжтой.

### 8c. QPay — төлбөрийн шимтгэл (infra БИШ)

**Гүйлгээний дүнгийн 1%.** Бүртгэлийн болон суурь хураамжгүй.

| Төлбөрт хэрэглэгч | Сарын орлого (34,000₮) | QPay 1% |
| --- | --- | --- |
| 1,000 | 34 сая₮ | **340,000₮** |
| 10,000 | 340 сая₮ | **3.4 сая₮** |

> Харьцуулбал: 10,000 төлбөрт хэрэглэгчтэй үед **QPay-гийн шимтгэл (3.4 сая₮) нь
> нийт infrastructure зардлаас (1.23 сая₮) ~3 дахин их.** Гэхдээ App Store IAP
> (15–30%) -тай харьцуулахад 1% нь маш хямд — `FUTURE_PLAN.md`-ийн "IAP-аас
> зайлсхий" зөвлөмж зөв байсан нь батлагдаж байна.

---

## 9. Free ба paid хэрэглэгч

| | Paid | Free |
| --- | --- | --- |
| AI Buddy voice | 25–50 мин/сар | 0 (эсвэл маш бага) |
| `messages` мөр | ~370/сар | ~20/сар |
| DB / сар | ~190 KB | ~40 KB |
| Медиа egress / сар | ~570 MB | **~350 MB** (видео/зураг адилхан үздэг) |
| API request | 80/өдөр | ~50/өдөр |

> **Гол дүгнэлт: free хэрэглэгч infra-д бараг адилхан үнэтэй.** Учир нь зардлыг
> үүсгэж буй зүйл нь AI биш — **медиа egress**, тэр нь free хэрэглэгч ч ижил
> татдаг. Free хэрэглэгчийн зардлыг "бага" гэж бүү тооц.

**Таамаглал:** 10,000 **төлбөрт** хэрэглэгчид ногдох free = **3–5 дахин**
(freemium-ийн ердийн 5–20% conversion) → **30,000–50,000 free бүртгэлтэй**,
тэдгээрийн ~20% нь идэвхтэй.

- Free-гийн egress аль хэдийн дээрх DAU тоонд **орсон** (DAU = paid + free идэвхтэй).
- **Идэвхгүй бүртгэл:** 50,000 × ~5 KB = **250 MB** — ач холбогдолгүй.
  1 жил идэвхгүй бол `messages`-ыг архивлах cron нэмэхэд DB өсөлт 20–30% буурна.

---

## 10. Сарын зардлын задаргаа

### 10a. Provider-ийн албан ёсны нэгж үнэ (2026-07-29-нд шалгасан)

| Provider | Нэгж | Албан ёсны үнэ | Сарын дүн болгосон нь (730 ц = 2,628,000 сек) |
| --- | --- | --- | --- |
| **Railway** | vCPU | **$0.00000772 / vCPU / сек** | **= $20.29 / vCPU / сар** |
| Railway | RAM | **$0.00000386 / GB / сек** | **= $10.14 / GB / сар** |
| Railway | Volume | **$0.00000006 / GB / сек** | **= $0.158 / GB / сар** |
| Railway | **Egress** | **$0.05 / GB** | — |
| Railway | Seat | Hobby $5 / Pro **$20 per seat** | — |
| **Cloudflare R2** | Storage | **$0.015 / GB-сар** | 10 GB үнэгүй |
| R2 | Class A (бичих) | **$4.50 / сая** | 1 сая үнэгүй |
| R2 | Class B (унших) | **$0.36 / сая** | 10 сая үнэгүй |
| R2 | **Egress** | **$0.00 — үнэгүй** | ⭐ |
| **Neon** (DB хувилбар) | Storage | **$0.35 / GB-сар** | Free: 0.5 GB + 100 CU-ц |
| Neon | Compute | **$0.106 / CU-ц** (Launch) · **$0.222** (Scale) | PAYG, доод хязгааргүй |
| **Upstash** Redis | PAYG | **$0.20 / 100k command** + $0.25/GB | Free: 256 MB / 500k cmd |
| Upstash | Fixed 1 GB | **$20 / сар** | хязгааргүй command |
| **Sentry** | Team | **$26 / сар** | 50k алдаа |
| **Expo EAS** | Starter | **$19 / сар** + $45 credit | Free: 15+15 build |
| **Hetzner** CX33 | 4 vCPU / 8 GB / 80 GB | **€8.49 / сар** | **20 TB traffic дотроо** |

*(Railway-гийн сарын дүнг би секундын үнээс өөрөө тооцсон — pricing хуудас нь
зөвхөн секундын үнэ зарладаг. Тооцоо: $0.00000772 × 2,628,000 = $20.29.)*

### 10b. Expected setup — 10,000 DAU (медиа R2 дээр)

> ⚠️ **Railway нь provisioned биш, БОДИТ хэрэглээг секунд тутам билл хийдэг.**
> Тиймээс доорх мөрүүдэд **CPU/RAM** багана нь `хязгаар / дундаж билл хийгдэх`
> хэлбэртэй, ба **$/сар нь дундажаас** §10a-гийн ханшаар гарсан. Тооцоог мөр
> бүрт бичсэн тул шалгах боломжтой.

| Service | Provider | Plan/instance | CPU (хязгаар/дундаж) | RAM (хязгаар/дундаж) | Storage | Bandwidth | Тооцоо | $/сар | Яагаад энэ plan хэрэгтэй вэ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API compute | Railway | 2 replica | 2 / **1.4** vCPU | 4 / **4** GB | — | — | `1.4×20.29 + 4×10.14` | **$69** | Peak 28 RPS + deploy-д зогсолтгүй байх |
| Postgres | Railway managed | 2 vCPU / 8 GB | 2 / **1.4** vCPU | 8 / **4.4** GB | **200 GB** | дотоод | `1.4×20.29 + 4.4×10.14 + 200×0.158` | **$104** | Peak 84 read/s + 11 write/s. 200 GB = **12 сарын өсөлт (135 GB) + WAL/түр зай** |
| Redis | Railway managed | жижиг | 0.5 / **0.25** vCPU | 1 / **1** GB | — | дотоод | `0.25×20.29 + 1×10.14` | **$15** | Hearts, limits, кэшлэсэн жагсаалт |
| Медиа storage | Cloudflare R2 | Standard | — | — | 50 GB | — | 50 GB | **$0.75** | Бүх зураг/аудио/видео |
| R2 operations | Cloudflare | Standard | — | — | — | — | ~15M Class B | **$2** | CDN кэш ихэнхийг барина |
| **Медиа egress** | **Cloudflare R2** | — | — | — | — | **5.7 TB** | 10k DAU | **$0** | ⭐ **R2 egress үнэгүй** |
| API JSON egress | Railway | — | — | — | — | 150 GB | gzip хийсэн | **$8** | Медиа биш, зөвхөн JSON |
| Backup | Railway/Neon | өдөр бүр + 7 хоног PITR | — | — | ~200 GB | — | — | **$16** | Аваар нөхөн сэргээлт |
| Staging | Railway | 0.5 vCPU / 1 GB | 0.5 / **0.5** | 1 / **1** | — | — | `(0.5×20.29 + 1×10.14) × 50% uptime` | **$10** | Prod руу шууд deploy хийхгүй байх |
| Admin hosting | Vercel | Pro | — | — | — | — | — | **$20** | Арилжааны хэрэглээ |
| Error tracking | Sentry | Team | — | — | — | — | 50k алдаа | **$26** | Аль хэдийн холбогдсон |
| Logs | Better Stack | Starter | — | — | — | — | — | **$10** | Railway 7 хоног хадгална |
| Email | Resend | Pro | — | — | — | — | 50k имэйл | **$20** | OTP + сэргээлт |
| Push | Expo | Free | — | — | — | — | хязгааргүй | **$0** | — |
| CDN/WAF/DDoS | Cloudflare | Free | — | — | — | — | — | **$0** | — |
| Domain + SSL | Cloudflare | — | — | — | — | — | — | **$1.5** | — |
| Mobile build | EAS | Starter | — | — | — | — | — | **$19** | OTA нь өөрсдийнх |
| CI/CD | GitHub Actions | Free | — | — | — | — | — | **$0** | — |
| Railway seat | Railway | Pro × 1 | — | — | — | — | — | **$20** | Багийн тохиргоо |
| | | | | | | | **НИЙТ** | **$341** | ≈ **1,228,000₮** |

### 10c. Гурван хувилбар × дөрвөн хэмжээ (DAU, USD/сар, медиа R2 дээр)

**1 — Minimum setup** (1 replica, staging-гүй, үнэгүй tier дээр тулгуурласан):

| | 1,000 DAU | 5,000 DAU | **10,000 DAU** | 20,000 DAU |
| --- | --- | --- | --- | --- |
| API compute | $15 | $30 | $50 | $95 |
| Postgres | $20 | $35 | $60 | $110 |
| Redis | $0 (Upstash free) | $10 | $15 | $20 |
| R2 (storage+ops) | $1 | $2 | $3 | $5 |
| JSON egress | $1 | $4 | $8 | $15 |
| Backup | $2 | $5 | $10 | $18 |
| Туслах үйлчилгээ | $2 | $22 | $28 | $48 |
| **НИЙТ** | **$41** | **$108** | **$174** | **$311** |
| ₮ | 148k | 389k | **626k** | 1.12 сая |

**2 — Expected setup** (санал болгож буй — 2 replica, staging, Sentry, Pro tier):

| | 1,000 DAU | 5,000 DAU | **10,000 DAU** | 20,000 DAU |
| --- | --- | --- | --- | --- |
| API compute | $25 | $45 | $69 | $135 |
| Postgres | $30 | $60 | $104 | $190 |
| Redis | $10 | $15 | $15 | $30 |
| R2 (storage+ops) | $2 | $2 | $3 | $6 |
| JSON egress | $1 | $4 | $8 | $15 |
| Backup | $4 | $9 | $16 | $30 |
| Staging | $10 | $10 | $10 | $15 |
| Туслах үйлчилгээ | $77 | $96 | $116 | $126 |
| **НИЙТ** | **$159** | **$241** | **$341** | **$547** |
| ₮ | 572k | 868k | **1.23 сая** | 1.97 сая |

*Бүх Railway мөр §10a-гийн ханшаас **дундаж хэрэглээгээр** гарсан (§10b-г үз).
Жишээ шалгалт — 20,000 DAU-гийн Postgres: `2.5×20.29 + 8×10.14 + 400×0.158 =
$50.7 + $81.1 + $63.2 = $195 ≈ $190`.*

**3 — High-usage / safe setup** (3 replica, read replica, worker, өндөр egress):

| | 1,000 DAU | 5,000 DAU | **10,000 DAU** | 20,000 DAU |
| --- | --- | --- | --- | --- |
| API compute (+worker) | $45 | $90 | $150 | $280 |
| Postgres (+read replica) | $50 | $110 | $200 | $380 |
| Redis | $20 | $20 | $30 | $60 |
| R2 (storage+ops) | $3 | $5 | $8 | $15 |
| JSON egress | $2 | $8 | $16 | $30 |
| Backup (30 хоног PITR) | $8 | $20 | $35 | $65 |
| Staging + dev | $20 | $20 | $25 | $30 |
| Туслах үйлчилгээ | $110 | $135 | $160 | $190 |
| **НИЙТ** | **$258** | **$408** | **$624** | **$1,050** |
| ₮ | 929k | 1.47 сая | **2.25 сая** | 3.78 сая |

### 10d. ⚠️ Медиа R2 дээр БАЙХГҮЙ бол (Railway egress $0.05/GB)

| | 1,000 DAU | 5,000 DAU | **10,000 DAU** | 20,000 DAU |
| --- | --- | --- | --- | --- |
| Egress (expected) | +$29 | +$143 | **+$285** | +$570 |
| Egress (high) | +$100 | +$500 | **+$1,000** | +$2,000 |
| **Expected setup дүн** | $188 | $384 | **$626** | $1,117 |

**10,000 DAU дээр R2 руу нүүх нь сард $285–1,000 хэмнэнэ.** Энэ бол
`CLOUDFLARE_MIGRATION_PLAN.md` Фаз 2–3-ийн бүх зөвтгөл.

### 10e. Database-ийн өөр сонголт — Neon (10,000 DAU дээр)

| | Railway managed PG | **Neon Launch** |
| --- | --- | --- |
| Storage (135 GB) | 200 GB × $0.158 = $32 | 135 GB × **$0.35** = **$47** |
| Compute | 1.4 vCPU + 4.4 GB = $73 | ~2 CU × 730 ц × **$0.106** = **$155** |
| **Дүн** | **$104** | **~$202** |
| Давуу тал | хямд, нэг данс | branch/PITR 7 хоног, scale-to-zero, autoscale |

**10,000 DAU дээр Railway managed PG хямд.** Neon нь **тогтмол бус ачаалалтай**
(scale-to-zero) staging/dev-д, эсвэл per-branch DB хэрэгтэй үед л ашигтай.
Тиймээс энэ загварт Railway-г үндсэн болгож авсан.

### 10f. Хямд хувилбар — Hetzner (өөрсдөө удирдах)

| Setup | Тохиргоо | €/сар |
| --- | --- | --- |
| App + DB нэг сервер дээр | CX33 (4 vCPU / 8 GB / 20 TB traffic) | **€8.49** |
| App + тусдаа DB сервер | CX33 × 2 | €17 |
| + managed backup, Cloudflare урд | | ~€25 |

**20 TB traffic дотроо багтдаг** нь гол давуу тал — R2-гүйгээр ч egress асуудал
шийдэгддэг. Гэхдээ: өөрсдөө patch хийх, PG tuning, failover, monitoring —
**DevOps цаг = нуугдмал зардал**. 3 хөгжүүлэгчтэй, DevOps-гүй багт **эхний
жилдээ Railway илүү зөв**; 20,000 DAU-аас цааш Hetzner рүү шилжих нь утга учиртай.
⚠️ Hetzner үнэ **2026 оны 6-р сарын 15-нд эрс өссөн** (CPX/CCX 2 дахин их) —
CX цуврал л хямд хэвээр.

---

## 11. Load test

| Асуулт | Хариулт |
| --- | --- |
| Load test хийсэн үү? | **ҮГҮЙ.** Repo-д k6 / artillery / JMeter байхгүй. **Дээрх бүх RPS/concurrent тоо бол загварчилсан таамаг, хэмжсэн үзүүлэлт БИШ.** |
| Ямар tool? | **k6** (Grafana) — Node/REST-д хамгийн энгийн, CI-д ордог |
| Хэдэн concurrent simulate хийх? | 3 үе шат: **50 VU** (1k DAU), **250 VU** (10k DAU peak), **500 VU** (safe ×2) |
| Max RPS хэд гарсан? | — (хийгээгүй) · **Зорилт: 60 RPS тогтвортой, p95 < 400 мс** |
| CPU/RAM/DB хэдэн хувь? | — (хийгээгүй) · **Зорилт: CPU < 70%, RAM < 75%, DB conn < 60%** |
| Хэзээ удааширсан бэ? | — (хийгээгүй) |
| 10,000 хэрэглэгчийг load test-ээр батлах боломжтой юу? | **Тийм.** Staging дээр prod-той ижил хэмжээний DB (seed хийсэн) + k6 → дээрх тоонуудыг 1 өдөрт баталгаажуулна. |

### Санал болгож буй load test scenario

```
k6 ramp: 0 → 250 VU (5 мин) → 250 VU барих (15 мин) → 500 VU (5 мин)
Хольц (бодит хэрэглээний дагуу):
  40%  GET  /lessons, /words, /leaderboard   (унших, кэшлэх боломжтой)
  25%  POST /quizzes/:id/check               (бичих + XP)
  20%  GET  /me, /notifications, /hearts     (апп нээх)
  10%  POST /reviews                          (SRS бичих)
   5%  POST /ai/buddy/sessions/:id/turn/text  (buddy, AI mock-той)
Хэмжих: p50/p95/p99, RPS, алдааны хувь, Railway CPU/RAM, pg_stat_activity
```

**Юуг эхлээд шалгах вэ:** §12-ийн DB latency асуудал засагдсан эсэх. Одоогийн
байдлаар query бүр ~180 мс тул load test хийхэд **28 RPS дээр ч холболтын pool
(default 10) дүүрч** гацна. Load test-ийг **засварын дараа** хий.

---

## 12. ⚠️ Тооцоог гажуудуулж буй одоогийн нэг асуудал

2026-07-29-нд prod дээр хэмжсэн: **Postgres query бүр ~180 мс** нэмдэг
(байх ёстой нь 1–2 мс).

| Хүсэлт | TTFB | DB-гүй суурьтай харьцуулбал |
| --- | --- | --- |
| `/api/__nope` (404, DB хүрэхгүй) | 292 мс | суурь (цэвэр сүлжээ) |
| `/api/lessons` (**хоосон**, 42 байт) | 470 мс | +178 мс = 1 query |
| `/api/words?limit=20` | 840 мс | +548 мс = 3 query |

**Шалгасан зүйлс:**

| Таамаг | Үр дүн |
| --- | --- |
| ~~Нийтийн proxy хост (`*.proxy.rlwy.net`)~~ | ❌ **Үгүй.** `DATABASE_URL` = `postgres.railway.internal:5432` — дотоод сүлжээ дээр зөв байна |
| ~~Буруу бүс (region)~~ | ❌ **Үгүй.** Сингапур нь Монголоос хамгийн ойр (§12b) |
| **Холболтын pool-ын эргэлт** | ✅ **Тийм — үүн дээр** |

**Шалтгаан:** `node-postgres`-ийн анхны утга нь **`min: 0` + `idleTimeoutMillis:
10000`** (`node_modules/pg-pool/index.js:98`). Ачаалал багатай API дээр холболт
сул болоод **10 секундын дараа хаагддаг**, дараагийн хүсэлт бүрэн шинэ холболт
үүсгэдэг:

```
DNS (railway.internal = IPv6-only) → TCP → TLS handshake (DB_SSL=true) → SCRAM auth
≈ 170 мс, query бүрийн ӨМНӨ
```

Миний curl тестүүд хэдэн секундын зайтай явсан тул **бараг бүр удаа шинэ холболт
төлсөн** — тиймээс "query бүр 180 мс" мэт харагдсан.

**Засвар (хийгдсэн, 2026-07-29):** `src/config/typeorm.config.ts`-д pool тохиргоо
нэмэв — `min: 2` (халуун холболт хэзээ ч хаагдахгүй), `idleTimeoutMillis: 600_000`,
`keepAlive: true`, `max: 20`, `connectionTimeoutMillis: 5_000`.
Нэмэлт: `DB_SSL=false` болгох (дотоод сүлжээнд TLS хэрэггүй) нь үлдсэн handshake-ыг
ч хасна.

> ⚠️ **Deploy хийж, дахин хэмтэл энэ нь батлагдаагүй таамаг хэвээр.**
> Баталгаажуулах: `curl -s -o /dev/null -w "%{time_starttransfer}\n"
> https://sparkxp-production.up.railway.app/api/lessons` — 470 мс → **~300 мс**
> болох ёстой (292 мс суурь + бодит query).

### 12b. Бүс — аль хэдийн оновчтой (өөрчлөх шаардлагагүй)

Монголоос хэмжсэн TCP RTT:

| Бүс | RTT |
| --- | --- |
| **Railway Singapore (одоогийн)** | **~93 мс** |
| AWS Singapore | 116 мс |
| AWS Seoul | 130 мс |
| AWS Tokyo | 189 мс |
| AWS Frankfurt | 205 мс |
| AWS US West | 293 мс |

Монголын ISP-ууд Сингапур чиглэлээр route хийдэг. **Railway-гийн одоогийн бүс нь
AWS-ийн аль ч бүсээс хурдан** — host солих нь хурдыг сайжруулахгүй, дордуулна.

---

## 13. Бүх таамаглалын жагсаалт

| # | Таамаглал | Утга | Мэдрэмтгий байдал |
| --- | --- | --- | --- |
| 1 | DAU/MAU харьцаа | 22% | Дунд |
| 2 | Идэвхтэй хэрэглээ | 12 мин/өдөр | Өндөр (peak concurrent) |
| 3 | Peak цонх | 2 цаг, өдрийн хэрэглээний 25% | Өндөр |
| 4 | API request | 80 / хэрэглэгч / өдөр | Дунд |
| 5 | Response (gzip) | ~2 KB дундаж | Бага |
| 6 | DB read/write | 240 / 30 нэг хэрэглэгчид өдөрт | Дунд |
| 7 | Per-user DB өсөлт | ~120 KB/сар blended (×2 индекс) | Дунд |
| 8 | **Видео үзэлт** | **3/долоо хоног × 40 MB** | **МАШ ӨНДӨР** ⚠️ |
| 9 | Контент сан | 10k үг, 200 видео, 500 reading | Storage-д өндөр, зардалд бага |
| 10 | Device кэш үр дүн | давтан үзэлт egress үүсгэхгүй | Өндөр |
| 11 | Free:paid харьцаа | 3–5 : 1 | Дунд |
| 12 | Валют | 1 USD = 3,600₮ | Бага |

**№8 бол хамгийн эмзэг таамаглал.** Видеоны хэмжээ/давтамжийг өөрчлөхөд нийт
дүн 2 дахин хэлбэлзэнэ. Тиймээс: видеог заавал **720p-ээс дээш болгохгүй**,
HLS/adaptive bitrate ашиглах, `expo-video` кэш идэвхжүүлэх нь infra-гийн хамгийн
том хөшүүрэг.

---

## 14. Хийх ажлын дараалал (зардлын нөлөөгөөр)

| # | Ажил | Хэмнэлт / нөлөө | Хүчин чармайлт |
| --- | --- | --- | --- |
| 1 | ✅ **Хийсэн** — pool тохиргоо (`min:2`, keepAlive) §12 | 840 мс → ~300 мс *(deploy хийж батлах)* | **Хийгдсэн** |
| 2 | **R2 Фаз 2 (аудио) + Фаз 3 (зураг)** | 10k DAU-д **$285–1,000/сар** | 2–3 өдөр |
| 3 | Видео R2 + adaptive bitrate + device кэш | egress-ийн 60–80% | 3–5 өдөр |
| 4 | `lessons`/`words` жагсаалтыг Redis-д кэшлэх | DB instance-ыг жижиг байлгана | 1 өдөр |
| 5 | `poolSize` / PgBouncer тохируулах | 3+ replica-д заавал | 0.5 өдөр |
| 6 | Buddy аудиог disk/stream рүү (memoryStorage-аас) | RAM OOM эрсдэл | 1 өдөр |
| 7 | k6 load test staging дээр | Дээрх бүх тоог батална | 1 өдөр |
| 8 | Идэвхгүй `messages` архивлах cron | DB өсөлт −25% | 1 өдөр |

---

## Эх сурвалж

- [Railway pricing](https://railway.com/pricing)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Neon pricing](https://neon.com/pricing)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Sentry pricing](https://sentry.io/pricing/)
- [Expo EAS pricing](https://expo.dev/pricing)
- [Hetzner Cloud (regular performance)](https://www.hetzner.com/cloud/regular-performance)
- [Hetzner 2026 үнийн өөрчлөлт](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [Hetzner үнийн тооцоолуур (2026-06-29)](https://costgoat.com/pricing/hetzner)
- Дотоод: `docs/CLOUDFLARE_MIGRATION_PLAN.md`, `docs/FUTURE_PLAN.md` §4–5
