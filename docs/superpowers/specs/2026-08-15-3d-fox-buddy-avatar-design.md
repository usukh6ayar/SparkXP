# 3D үнэг AI Buddy — загвар оруулах + Gemini хоолой/уруул синк (дизайн)

**Огноо:** 2026-08-15 · **Салбар:** `usukhbayar` · **Хамрах хүрээ:** `/backend` +
`/mobile` (+ `/admin`-д жижиг тайлбар)

## Асуудал

Захиалсан 3D дүр ирлээ: `~/Downloads/Fox Delivery/Fox_character.glb` — ясжуулсан
(armature), 52 ARKit blendshape-тэй үнэг. Гэвч аппад **шууд оруулах боломжгүй**:

1. **111 MB** (6 ширхэг 4096² PNG). GPU дээр текстур нь дангаараа ~537 MB.
2. Одоогийн renderer түүнийг **дүрсгүй саарал хөшөө** болгож харуулна (доор).
3. **Анимаци огт байхгүй** (0 clip) — юу ч хийхгүй бол хөдөлгөөнгүй зогсоно.

Үүний зэрэгцээ эзэмшигчийн шийдвэр: **уруулын синкийг Google-ийн Gemini-гээр**
хийнэ.

**Энэ бол шинэ дэд бүтэц биш.** Админ → `avatarAssetUrl` → `BuddyAvatar` гэсэн
3D суваг аль хэдийн бүтэн бичигдсэн, зөвхөн `SHOW_3D_AVATAR = false` тугаар
унтраалттай байгаа. Ажил нь: **загварыг таарууллаж, гурван бодит алдааг зассаны
дараа тугийг асаах.**

## Хязгаарлалт (кодоос шалгасан, таамаг биш)

| Зүйл | Байдал |
| --- | --- |
| GLB доторх зураг | `images[].bufferView` (Blender экспорт). `BuddyAvatar.applyEmbeddedTextures` **зөвхөн `images[].uri`** уншдаг → 6 зураг бүгд алдагдана. Энэ нь `buddyAvatarFlag.ts`-д бичсэн шиг PNG/JPEG-ийн асуудал **биш** (UPNG аль хэдийн орсон). |
| Морф сонголт | `/mouth\|open\|jaw\|aa\|viseme/i` regex нь 52 нэрнээс **27**-г барина (mouth\* 23 + jaw\* 4) ба бүгдийг нэг утгаар шахна → царай мурийна. `jawOpen` тусдаа байдаг. |
| Анимаци | `gltf-transform inspect` → **0 clip**. `pickClip(..., 'idle')` null буцаана. |
| Vertex | 23,820 — утсанд ямар ч асуудалгүй. Хүнд нь **текстур ба морф**. |
| Draco / meshopt | `new GLTFLoader().parse()` decoder бүртгэлгүй → **татгалзана**. |
| KTX2 / Basis | transcoder WASM хэрэгтэй → expo-gl дээр боломжгүй. |
| WebP текстур | UPNG ч, jpeg-js ч задлахгүй. |
| Материал | 6 текстур бүгд `OPAQUE`, alpha суваг хэрэггүй → **JPEG болгоно**. |
| Gemini TTS гаралт | 24 kHz / 16-bit / mono **түүхий PCM** (base64 `inlineData`), mp3 биш. |
| Gemini viseme | **Байхгүй.** Фонем/viseme-ийн цаг буцаадаггүй. |
| `TtsAdapter` | `TTS_PROVIDER` env-ээр солигддог интерфейс аль хэдийн байгаа (`providers.config.ts`). Шинэ provider = нэг branch. |
| `speak()` | `buddy.service.ts:606` — дуу үүсгэх, cache-лах, лог бичих цорын ганц газар. |
| Локал `GEMINI_API_KEY` | **Хоосон** (`backend/.env:57`). Жинхэнэ түлхүүр Railway дээр. |

## Хувилбарууд ба шийдвэр

### Уруулын синк хаанаас цагаа авах вэ

**A. Gemini TTS + чангарлын муруй (СОНГОСОН — эзэмшигчийн шийдвэр).** Дууг
Gemini үүсгэнэ → PCM гарт орно → 50 мс тутмын RMS-ээс ам нээх хэмжээг бодно.
Дуутайгаа яг таарна. Үнэ: **хоолой Google-ийнх болно**, нарийвчлал нь ам
нээх/хаах түвшинд (үсэг тус бүрийн хэлбэр биш).

**B. ElevenLabs `/with-timestamps`.** Хамгийн нарийвчлалтай, хоолой хэвээр,
шинэ provider хэрэггүй. **Татгалзсан** — Gemini ашиглах шийдвэртэй зөрчилдөнө.
Адаптер устахгүй тул `TTS_PROVIDER=elevenlabs` гэж буцаж болно.

**C. Gemini-гээр текстээс viseme бичиг гаргуулах.** Gemini бодит дууг
сонсдоггүй тул цаг нь таамаг — урт хариулт дээр ам, дуу хоёр сална.
**Татгалзсан.**

### Үнэг яаж амьд харагдах вэ

**A. Процедур (СОНГОСОН).** `useFrame` дотор амьсгаа + анивчилт + толгойн
найгалт. Гадны хүн хүлээхгүй, өнөөдөр дуусна.

**B. Blender-ээс idle/wave clip захиалах.** Чанар илүү, гэхдээ хүлээнэ.
**Хойшлуулсан** — clip ирвэл код нь автоматаар давуу эрхээр тоглуулна
(`pickClip` хэвээр), процедур нь зөвхөн clip байхгүй үед ажиллана.

### Хэмжээг яаж багасгах вэ

**A. Текстур 1024 + JPEG, морфыг 13 болгож хасах (СОНГОСОН).** ~111 MB → ~7 MB.
Одоогийн loader-т ямар ч өөрчлөлт шаардахгүй форматууд.

**B. Draco/KTX2-той бүрэн `optimize`.** 2–3 MB болно, гэхдээ **апп дээр огт
ачаалагдахгүй** (decoder алга). **Татгалзсан.**

## Архитектур

Гурван бие даасан хэсэг. Хоорондоо зөвхөн (1) GLB файлын URL, (2)
`mouth_frames` тоон массиваар холбогдоно.

```
[1] Оффлайн:  Fox_character.glb ──optimize-buddy-glb.ts──▶ fox-slim.glb (~7MB)
                                                            │ админаар upload
                                                            ▼
                                              ai_buddies.avatarAssetUrl (R2)

[2] Backend:  хариултын текст ──GeminiTtsAdapter──▶ PCM 24kHz
                                     ├─ wrapPcmAsWav()      ──▶ .wav → R2
                                     └─ mouthFramesFromPcm() ──▶ number[]
                                                   (buddy_voice_cache-д хадгална)

[3] Mobile:   GET turn ─▶ { audio_url, avatar_instruction { mouth_frames } }
                                     │
                          BuddyAvatar: jawOpen ← mouth_frames[t]
                                       idle    ← процедур (амьсгаа/анивчилт)
```

### [1] Загварын оптимизац — `backend/src/scripts/optimize-buddy-glb.ts`

Нэг удаагийн боловч **кодонд үлдэнэ** (дүр шинэчлэгдвэл дахин ажиллуулна).
`@gltf-transform/core` + `functions` ашиглана:

| Алхам | Тайлбар |
| --- | --- |
| `textureResize` 1024 | 4096² → 1024². |
| PNG → JPEG (q80) | Бүгд OPAQUE тул alpha хэрэггүй. |
| normal/roughness хасах | Апп v1-д зөвхөн `baseColorTexture` декодлоно (доор [3]) — задлагдахгүй 4 текстурыг файлд авч явах утгагүй. `-full.glb`-д хэвээр үлдэнэ. |
| Морф хасалт | Доорх 13-аас бусад `primitive.targets` + `extras.targetNames`-ийг хасна. Head mesh 22 MB → ~5 MB. |
| `dedup` + `prune` | Давхардсан/хэрэглэгдээгүй өгөгдөл. |

**Үлдээх 13 blendshape:** `jawOpen` · `eyeBlinkLeft` · `eyeBlinkRight` ·
`mouthSmileLeft` · `mouthSmileRight` · `mouthFrownLeft` · `mouthFrownRight` ·
`browInnerUp` · `browOuterUpLeft` · `browOuterUpRight` · `eyeSquintLeft` ·
`eyeSquintRight` · `mouthPucker`.

Гаралт: `fox-slim.glb` (**≤ 8 MB зорилт**). 52 морфтой бүтэн хувилбарыг R2-д
`…-full.glb` нэрээр хадгална (ирээдүйн facial mocap).

⚠️ **Эх материал repo-д орохгүй:** `.blend` 97 MB, 3 тест видео 340 MB,
4K текстурууд. Зөвхөн оптимизацласан GLB, тэр нь ч git биш **R2** руу.

### [2] Backend — Gemini хоолой + амны муруй

**Шинэ цэвэр функцууд** (`ai-gateway/providers/pcm.ts`, гадны хамааралгүй):

```ts
wrapPcmAsWav(pcm: Buffer, sampleRate: number): Buffer   // 44 байтын толгой
mouthFramesFromPcm(pcm: Buffer, sampleRate: number, frameMs: number): number[]
```

`mouthFramesFromPcm` — 50 мс тутмын RMS → хамгийн чанга фрэймээр норм → `0–100`
бүхэл тоо. 10 секунд яриа = 200 тоо ≈ 800 байт JSON.

**Шинэ адаптер** `GeminiTtsAdapter` (`gemini-tts.adapter.ts`) — одоо байгаа
`TtsAdapter` интерфейсийг хэрэгжүүлнэ. `providers.config.ts`-д
`case 'gemini':` нэмнэ. `TTS_PROVIDER=gemini` (анхдагч нь `elevenlabs` хэвээр
үлдэнэ — env-ээр асаана).

`TtsResult` хоёр талбараар өснө:

```ts
interface TtsResult {
  audio: Buffer;
  durationMs: number;
  model: string;
  voiceId: string;
  mimeType: string;          // ШИНЭ: 'audio/mpeg' | 'audio/wav'
  mouthFrames?: number[];    // ШИНЭ: зөвхөн PCM-тэй provider бөглөнө
}
```

**Яагаад муруйг адаптер дотор бодох вэ:** түүхий PCM-ийг зөвхөн адаптер мэднэ.
ElevenLabs mp3 буцаадаг тул `mouthFrames`-ыг `undefined` орхино → апп хуучин
процедур хөдөлгөөндөө унана. Ингэснээр provider солиход дуудагч талд ямар ч
`if` бичихгүй.

**`speak()`** (`buddy.service.ts`) — `mimeType`-аас файлын өргөтгөлөө сонгож
хадгална, `mouthFrames`-ыг cache-д бичээд буцаана.

**API өөрчлөлт** (нэмэлт, эвдрэлгүй):

```jsonc
"avatar_instruction": {
  "emotion": "happy", "gesture": "idle", "duration_ms": 3200,
  "mouth_frames": [0, 14, 62, 71, …],   // ШИНЭ, байхгүй байж болно
  "mouth_frame_ms": 50                   // ШИНЭ
}
```

**Migration** `AddBuddyVoiceMouthFrames1787300000000` — `buddy_voice_cache`-д
`mouth_frames jsonb NULL`. Хуучин мөр null хэвээр → дараагийн үүсгэлтэд нөхөгдөнө.

⚠️ **Хоолой солигдоно.** `ai_buddies.voiceId` нь одоо ElevenLabs-ийн ID
(`21m00Tcm4TlvDq8ikWAM` гэх мэт). Gemini нь **нэр** хүлээж авна (`Kore`, `Puck`,
`Zephyr` … 30 хоолой). `TTS_PROVIDER=gemini` болгохын өмнө buddy бүрийн
`voiceId`-г админаас солино. Адаптер танихгүй нэр ирвэл `GEMINI_TTS_VOICE`
(анхдагч `Kore`) руу унана — тэгснээр буруу тохиргоо чимээгүй 500 болохгүй.

**Шинэ env:** `GEMINI_TTS_MODEL` (анхдагч `gemini-2.5-flash-preview-tts`),
`GEMINI_TTS_VOICE` (анхдагч `Kore`). `.env.example`-д нэмнэ.

### [3] Mobile — `BuddyAvatar.tsx`

Дөрвөн засвар:

1. **`bufferView` текстур.** `parser.json.images[i].bufferView` → `bufferViews[]`
   → GLB-ийн binary chunk-аас байтууд → одоо байгаа `dataUriToTexture`-ийн
   декодлох хэсгийг дахин ашиглана (`uri` зам хэвээр үлдэнэ — Meshy дүрүүд
   эвдрэхгүй). v1-д зөвхөн `baseColorTexture`; normal/roughness хожим.
2. **`jawOpen` нэрээр.** Эхлээд яг `jawOpen`, олдохгүй бол одоогийн regex.
3. **Процедур idle.** Амьсгаа (~4 сек синус, толгой/цээжний бага масштаб),
   санамсаргүй анивчилт (2–6 сек тутам 120 мс `eyeBlink L/R`), толгойн зөөлөн
   найгалт. **Зөвхөн idle clip байхгүй үед** ажиллана.
4. **Санах ой.** Одоогийн dispose нь `std.map`-ыг л устгадаг —
   `normalMap`/`roughnessMap` болон морфын буферүүд ч орно.

Шинэ prop: `mouthFrames?: number[]`, `mouthFrameMs?: number`, `audioStartedAt?: number`.
Индекс = `floor((Date.now() - audioStartedAt) / mouthFrameMs)`, хооронд нь
шугаман интерполяц. Массив дуусвал 0 руу зөөлөн буурна. `mouthFrames` байхгүй
бол **одоогийн `mouthCurve` jabber** хэвээр (ElevenLabs руу буцсан тохиолдол).

`chat.tsx` дуу тоглуулж эхлэх мөчид `audioStartedAt`-аа тэмдэглэж дамжуулна.

**Туг:** `SHOW_3D_AVATAR = true`. Тугийг **устгахгүй** — төхөөрөмж дээр асуудал
гарвал нэг мөрөөр унтраах хэвээр. Хуучирсан тайлбарыг дарж бичнэ.

## Тест

Цэвэр функцууд — жинхэнэ TDD (эхлээд тест):

| Тест | Юу батлах |
| --- | --- |
| `wrapPcmAsWav` | 44 байтын толгой, `RIFF`/`WAVE` танигч, sampleRate/byteRate талбарууд, биеийн урт = PCM-ийн урт. |
| `mouthFramesFromPcm` | Чимээгүй PCM → бүх утга 0. Тогтмол чанга → 100-д таглагдана. Фрэймийн тоо = `ceil(duration / frameMs)`. |
| Морф сонголт | 52 ARKit нэрнээс **зөвхөн `jawOpen`** сонгоно (27 биш). `jawOpen`-гүй жагсаалтад regex рүү унана. |
| `optimize-buddy-glb` | Гаралтын GLB-д 13 морф үлдсэн, текстур бүр ≤1024, mimeType `image/jpeg`. |

Гараар (заавал, автоматжуулах боломжгүй): Expo Go дээр үнэг **өнгөтэй**
гарч ирэх, амьсгалж/анивчиж байх, ярихад ам нь дуутайгаа таарах.

## Гаргах дараалал

1. **Алхам 0 — хаалт:** `GEMINI_API_KEY`-ээр TTS дуудлага амжилттай эсэхийг
   curl-ээр шалгана. Локал `.env` хоосон тул түлхүүр хэрэгтэй. Хаалттай бол
   [2]-р хэсэг бүхэлдээ зогсоно ([1] ба [3] хамаарахгүй, үргэлжилж болно).
2. Backend: pcm.ts → адаптер → speak() → migration.
3. Оптимизацийн скрипт → `fox-slim.glb` → админаар upload → `avatarAssetUrl`.
4. Mobile: 4 засвар → туг → Expo Go дээр шалгах.
5. `TTS_PROVIDER=gemini` + buddy voiceId-уудыг Railway дээр солих.

**Native build шаардлагагүй** — JS + алсын asset тул OTA-гаар явна.
`expo-gl`, `three`, `@react-three/fiber` аль хэдийн `package.json`-д байгаа тул
`npm install` ч шаардлагагүй; Choi/Boju Expo Go дээр шууд шалгаж чадна.

## Эрсдэл

| Эрсдэл | Хариу |
| --- | --- |
| Gemini түлхүүр дээр TTS хаалттай | Алхам 0-д шалгана. Хаалттай бол `TTS_PROVIDER=elevenlabs` хэвээр үлдэж, зөвхөн 3D нь гарна. |
| Хямд Android дээр FPS унах | `dpr=[1,2]`, `antialias:false`, `low-power` аль хэдийн тавигдсан. Туг унтраах зам нээлттэй. |
| `Date.now()`-д тулгуурласан синк гулсах | Богино хариултад мэдэгдэхгүй. Мэдэгдвэл expo-audio-гийн `currentTime`-аас индекс авна. |
| Хоолой солигдсоныг хэрэглэгч сөрөг хүлээж авах | Beta-д хоёуланг сонсоод шийднэ; env-ээр буцах зам нээлттэй. |

## Хамрахгүй зүйл

Facial mocap (52 морф бүрэн), viseme түвшний уруул, бие бүтэн дохио, 3D-г Home
дэлгэц рүү авчрах, normal/roughness map, Meshy-гийн хуучин дүрүүдийг солих.
