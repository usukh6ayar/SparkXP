# Azure HD Voice + viseme lip-sync — хэрэгжүүлэлтийн төлөв

Эх баримт: `docs/SparkXP_Azure_HD_AI_Buddy_Engineering_Brief_MN (1).docx`
Шийдвэр: **Frostember болон lip-sync freelancer ашиглахгүй.** Gemini → reply text +
emotion, Azure HD Voice → audio + viseme timing, Three.js → ARKit blendshape.

> Энэ файл нь тэр даалгаврын **юу хийгдсэн / юу үлдсэн**-ийг барьдаг.
> Client (`/mobile`) тал = Boju. Backend + Azure бүртгэл = Өсөхбаяр.

---

## 1. Client тал — ДУУССАН (2026-08-21, `/mobile`)

Азурын cue ирэх өдрийг хүлээхгүйгээр бүтнээр нь бичсэн. Cue ирэхэд **аппын код
өөрчлөхгүйгээр** шууд ажиллана; ирэх хүртэл өмнөх, текстээс таасан хувилбараар
явна.

| Файл | Юу |
| --- | --- |
| `src/components/azureVisemes.ts` | **шинэ.** Azure-ийн 22 viseme id (0–21) → ARKit pose хүснэгт; timeline цэвэрлэх (`toVisemeTimeline`); audio цагаар хайх (`azurePoseAt`) |
| `src/components/buddyFace.ts` | `composeFace()` (§6 давхаргалалт), `ARKIT_52` + `missingArkitShapes()` (§5 rig шалгалт) |
| `src/components/BuddyAvatar.tsx` | `visemes` + `speechPositionMs` prop; audio-clock драйв; rig оношилгоо; blendshape-гүй rig-ийн jaw fallback засвар |
| `src/components/BuddyVoiceStage.tsx` | prop дамжуулалт |
| `app/(tabs)/chat.tsx` | cue-г turn-ээс авах, master clock дамжуулах, таслах (interrupt) цэвэрлэгээ, §7 хэмжилт |
| `src/api/ai.ts` | `TurnResponse.visemes?` (заавал бус) |
| `src/lib/analytics.ts` | `buddy_turn_latency` event |

### Гол шийдлүүд

**Master clock = audio player.** Уруул нь локал таймераар биш, `expo-audio`-гийн
`currentTime`-аар жолоодогддог. Avatar нь тайлан хоорондох зайд өөрийн цагаа
урагшлуулж, тайлан ирэх бүрд түүн рүү **эргэж таарна**. Frame алдагдвал дараагийн
хайлт хожуу байрлал уншиж, **тухайн агшны** хэлбэрийг шууд авна — алдсанаа
дахин тоглуулахгүй (§4.4).

**`setTimeout` ашиглаагүй** — бүх хайлт binary search-аар цагийн шугам дээр
хийгддэг (§4.4 шаардлага).

**Давхаргалалт (§6).** Өмнө нь emotion, viseme, blink гурав `maxPose`-оор
нийлдэг байсан нь эсрэг shape-уудыг зэрэг асаадаг байв. Одоо `composeFace`:
- emotion → нүд/хөмсөг эзэмшинэ; ярианы үед амны жин нь `×0.25`, **дээд тал нь
  0.12** (өнгө оруулна, тэмцэхгүй);
- viseme → амыг **орлуулна** (max биш);
- `mouthClose > 0.4` үед `jawOpen`-ыг хаана (p/b/m дээр уруул үнэхээр нийлнэ);
- blink нь `eyeWide`/`eyeSquint`-ийг `(1 − blink)`-ээр дардаг тул нүд бүрэн анина;
- бүх жин 0–1 хооронд clamp.

**Fallback.** `visemes` хоосон бол `textToVisemes` (хуучин зам) ажиллана. Хоёулаа
нэг `composeFace`-ээр дамждаг тул Azure ирэхээс өмнө ч дээрх засварууд идэвхтэй.

### Шалгасан

`azureVisemes` + `buddyFace`-ийг тусад нь compile хийж **21 шалгалт** ажиллуулсан
(хүснэгтийн бүрэн бүтэн байдал, timeline эрэмбэ/шүүлт, frame-drop catch-up,
cross-fade, §6-ийн мөргөлдөөн бүрэн арилсан эсэх, clamp, rig оношилгоо) — бүгд
давсан. ⚠️ `/mobile`-д jest суулгаагүй тул тестийг **commit хийгээгүй**; jest
нэмэгдэх өдөр `azureVisemes.spec.ts` болгож буулгах ажил үлдсэн.

---

## 2. Backend тал — ДУУССАН (2026-08-21, `/backend`)

| Файл | Юу |
| --- | --- |
| `src/ai-gateway/providers/azure-tts.adapter.ts` | **шинэ.** Azure Speech SDK-аар синтез + `visemeReceived` цуглуулга; mp3 гаралт; timeout; standard voice руу нэг удаа fallback |
| `src/ai-gateway/providers/tts.adapter.ts` | `TtsResult` дээр `visemes` · `mimeType` · `fileExtension` |
| `src/ai-gateway/providers/providers.config.ts` | `TTS_PROVIDER=azure` branch |
| `src/ai-gateway/buddy.service.ts` | turn хариунд `visemes`; cache-д хадгалах; шатны хугацаа (`TurnTimer`) |
| `src/ai-gateway/buddy-contract.ts` | `capWords()` + 20 үгийн таслалт, prompt-д тусгав |
| `src/ai-gateway/ai-gateway.service.ts` | `maxReplyWords` limit (Redis-ээс тохируулна) |
| `src/entities/buddy-voice-cache.entity.ts` + migration | `visemes jsonb` багана |
| `.env.example` | Azure түлхүүрүүд; мөн `STT_PROVIDER`/`TTS_PROVIDER`-ийн **хуучирсан `elevenlabs`** утгыг зассан |

### Гэрээ (апп юу хүлээж авдаг вэ)

```jsonc
{
  "reply_text": "...",
  "audio_url": "https://.../reply.mp3",
  "visemes": [ { "id": 0, "offset_ms": 0 }, { "id": 21, "offset_ms": 120 } ]
}
```

- `id` = Azure viseme id **0–21**; мужаас гаднахыг апп чимээгүй хаяна.
- `offset_ms` — Azure-ийн `AudioOffset` нь **100 наносекундын tick** тул адаптер
  `/10000` хийж ms болгодог.
- **Талбар байхгүй бол апп өмнөх зангаараа** (бичвэрээс таамаглах) ажиллана —
  тиймээс `TTS_PROVIDER=gemini` хэвээр үлдээхэд юу ч эвдрэхгүй.

### Хамт зассан гурван зүйл

1. **Аудионы формат буруу шошготой байсан.** WAV буферийг `.mp3` нэр +
   `audio/mpeg` MIME-ээр хадгалдаг байв. Одоо адаптер өөрөө форматаа зарлана
   (Gemini → `audio/wav`, Azure → `audio/mpeg`).
2. **`maxReplyChars` limit үхмэл байсан** — `ai:limits:default`-д байсан ч
   `buddy-contract.ts` өөрийн const-оо ашигладаг тул тохируулга нөлөөгүй байв.
   Одоо хоёулаа `parseBuddyTurn(raw, opts)`-оор дамжина.
3. **Аудионы хэмжээ.** Gemini TTS = шахалтгүй 24 kHz PCM ≈ **48 KB/сек**
   (6 сек ≈ 290 KB, R2 руу нэг удаа, утас руу дахин). Azure = 48 kbit mp3 ≈
   **6 KB/сек**, ойролцоогоор **8× бага**.

### ⏳ Үлдсэн — Azure бүртгэл шаардана (§4.1, Go/No-Go хаалга)

Энэ хэсгийг **түлхүүргүйгээр хийх боломжгүй**:

1. Azure Speech resource үүсгэж `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`-ыг
   Railway-гийн env-д тавих (`.env.example` бол зөвхөн баримт — deploy уншдаггүй).
2. 3–5 HD voice-ийг ижил 10 өгүүлбэрээр сонсож харьцуулах.
3. **Voice бүр дээр `VisemeReceived` бодитоор ирж байгааг батлах.** Ирдэггүй
   voice-ыг шууд хасна. Код нь `<mstts:viseme type="redlips_front"/>` асуудаг ч
   зарим voice огт өгөхгүй байх магадлалтай — энэ бол баримтаар биш **бодит
   дуудлагаар** шалгах ёстой цорын ганц зүйл.
4. Монголын бодит сүлжээнээс first-byte latency хэмжих.
5. Батлагдвал `TTS_PROVIDER=azure` болгоно.

⚠️ **Шалгах хамгийн хурдан арга:** `POST /ai/buddy/admin/test-voice` (flag-аас
үл хамааран нээлттэй). Хариу `visemes` дүүрэн ирвэл тухайн voice тэнцсэн.

### ⚠️ Латентын үлдсэн өр (§7-ийн зорилт биелэхэд шаардлагатай)

`TurnTimer` одоо шат бүрийг мессежийн `metadata.latency`-д бичдэг тул эдгээрийг
**таамаглахгүйгээр** хэмжинэ. Хараахан хийгээгүй:

- Аудионы **upload → URL → апп татах** гэсэн 2 нэмэлт аялал (`storage_ms` үүнийг
  ил гаргана). Хариунд base64-аар өгвөл алга болно.
- LLM-ийн **JSON retry** (`buddy.service.ts` `completeTurn`) — буруу JSON ирвэл
  бүтэн 2 дахь дуудлага. Structured output/tool-use ашиглавал арилна.
- Turn эхлэх үеийн **4 цуваа DB унших** → `Promise.all`; `aiInputTokens` /
  `aiOutputTokens` хоёр increment → нэг UPDATE.
- `logUsage` · memory · XP-г хариу буцаасны дараа fire-and-forget болгох.

## 3. Хүлээн авах шалгуур — client талын төлөв (§9)

| Шалгуур | Төлөв |
| --- | --- |
| Audio + viseme зэрэг ирэх | ⏳ Azure түлхүүр хүлээж байна (код бэлэн) |
| P/B/M · F/V · O/U · E/I · S/Z · TH · R/L ялгарах | ✅ 22 id-ийн хүснэгт бэлэн, тестээр баталсан |
| Pause/resume үед timeline хамт зогсох | ✅ clock нь player-ийнх тул автоматаар |
| Interrupt → 150 ms дотор reset | ✅ `stopSpeaking()` — audio + timeline нэг мөчид |
| Frame drop дээр хоцролгүй | ✅ binary search catch-up |
| Emotion + lip-sync зэрэг | ✅ `composeFace` |
| p50/p95 latency тайлан | ✅ client `buddy_turn_latency` (T0→audible, T0→reply) PostHog дээр; сервер тал `metadata.latency` (stt/llm/tts/storage) SQL-ээр |
| 35 мин limit enforce | ✅ backend дээр аль хэдийн бий |

## 4. Rig шалгалт (§5)

`__DEV__` үед buddy ачаалагдах бүрд console-д гарна:

```
[BuddyAvatar] rig has 52 morph targets, 52/52 ARKit
[BuddyAvatar] rig has 40 morph targets, 38/52 ARKit — missing: cheekPuff, noseSneerLeft, …
```

Ингэснээр "яагаад энэ buddy уруулаа хаадаггүй юм бэ" гэдэг нь таамаг биш
**баримт** болно. Дутуу shape нь апп унагаадаггүй — тэр жин хаана ч бичигдэхгүй
өнгөрдөг тул чимээгүй.

⚠️ Одоогийн avatar-ууд 52-г бүрэн агуулдаг эсэх нь **шалгагдаагүй** — эх код дахь
"52 ARKit" гэдэг нь зөвхөн тайлбар байсан. Дээрх лог нь эхний buddy ачаалахад
хариуг нь өгнө. Mesh/teeth/tongue эвдрэлийг (docx §5-ийн хүснэгт) нүдээр шалгах
ажил тусад нь үлдэж байна.
