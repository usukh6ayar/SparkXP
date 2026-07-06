# AI Buddy 3D Pipeline — Gap Analysis (docs vs одоогийн код)

> **Эх сурвалж:** [`SparkXP_AI_Buddy_3D_Pipeline_MN.docx`](./SparkXP_AI_Buddy_3D_Pipeline_MN.docx)
> (2026-07-05) — Unity + Meshy + SALSA/uLipSync-д суурилсан IT-багийн техникийн санал.
> **Харьцуулсан:** одоогийн `backend/src/ai-gateway/*` + `mobile/src/components/BuddyAvatar.tsx`.
> **Огноо:** 2026-07-06 · **Хамрах:** backend (Өсөхбаяр) + mobile 3D (Boju).

---

## 0. Дүгнэлт (TL;DR)

1. **"Тархи + дуу хоолой" давхарга ~90% бэлэн.** Backend AI Buddy pipeline
   (STT → LLM structured JSON → TTS → memory → XP → usage limit) аль хэдийн
   баригдсан. docs-ийн шаардсан `reply_text`, `correction`, `follow_up_question`,
   `emotion`, `animation`(gesture), memory давхарга, XP, voice limit — бүгд бий.
2. **🔑 3D аватарыг Unity биш — `three.js`-ээр аль хэдийн хийсэн.**
   `mobile/src/components/BuddyAvatar.tsx` нь Meshy GLB-г `@react-three/fiber`
   (expo-gl)-ээр рендерлэж, idle loop + emotion/gesture clip crossfade + procedural
   lip-sync (mouth morph / jaw bone) + 2D fallback хийдэг. **Энэ бол docs-ийн
   Unity замаас өөр, RN-д хамаагүй хөнгөн, аль хэдийн ажилладаг сонголт.**
3. **Зөвлөмж: Unity-г НЭ БАРИХ** (доор §5). docs-ийн Unity/SALSA хэсгүүдийг
   "reference / alternative", хэрэв three.js чанар low-end төхөөрөмж дээр хүрэлцэхгүй
   бол л эргэж харах fallback гэж үзнэ.
4. **Үлдсэн ажил = жижиг delta-ууд** (contract-д `mistake_tags`/`xp_reward`/`tts_text`,
   `/feedback` endpoint, `/profile` нэгтгэсэн endpoint) + mobile voice UI polish.

---

## 1. AI response contract — docs vs backend

docs §8 JSON vs `backend/src/ai-gateway/buddy-contract.ts` (`BuddyTurnResult`) +
клиентэд буцаах `TurnResponse` (`buddy.service.ts`).

| docs талбар | Backend | Төлөв | Тэмдэглэл / delta |
| --- | --- | --- | --- |
| `transcript` | `user_transcript` | ✅ | нэр өөр |
| `reply_text` | `reply_text` | ✅ | — |
| `correction.has_mistake` | `correction.has_correction` | ✅ | нэр өөр |
| `correction.wrong_sentence` | `correction.original` | ✅ | нэр өөр |
| `correction.correct_sentence` | `correction.corrected` | ✅ | нэр өөр |
| `correction.explanation_mn` | `correction.short_explanation` | 🟨 | **Монгол тайлбар** гэж заагаагүй — prompt-д "explain in Mongolian" нэмбэл яг таарна |
| `follow_up_question` | `follow_up_question` | ✅ | — |
| `emotion` | `emotion` | ✅ | 7 enum: happy/curious/thinking/surprised/calm/encouraging/confused |
| `animation` | `avatar_instruction.gesture` (+ `emotionMap`) | ✅ | docs "animation" = бидний gesture→clip. 6 gesture enum |
| `mistake_tags: []` | — (memory `mistake_pattern` бий) | 🟨 **Нэмэх** | turn бүрийн tag массив байхгүй; зөвхөн memory-д хадгалдаг |
| `xp_reward` | XP `awardOnce` хийдэг ч TurnResponse-д буцаадаггүй | 🟨 **Нэмэх** | XP session-д 1 удаа өгдөг; turn бүрийн `xp_reward` талбар алга |
| `tts_text` | тусад нь байхгүй (`reply_text`→TTS) | 🟨 Сонголт | docs `tts_text` = reply+follow_up нийлбэр. Одоо reply_text л TTS рүү явдаг |
| `audio_url` | `audio_url` | ✅ | Cloudinary + `buddy_voice_cache` |
| `remaining_voice_seconds` | `usage.voice_seconds_limit − used` | ✅ | `usage` объектоор |
| `safety` (docs дурдаагүй) | `safety {flagged, reason}` + `safety_events` | ✅➕ | Backend илүү — safety gate нэмсэн |
| `memory_update` (docs §9 memory) | `memory_update {should_save, memory_type, value}` | ✅➕ | Filtered long-term memory |

**Дүгнэлт:** contract 100% дүйцэхэд ойрхон. Delta = 3 талбар (`mistake_tags`,
`xp_reward`, `tts_text`) + `explanation_mn` prompt засвар. ~хагас өдрийн backend ажил.

---

## 2. API endpoint — docs §10 vs backend

Backend route-ууд: `@Controller('ai/buddy')` + `@Controller('ai')`.

| docs endpoint | Backend | Төлөв |
| --- | --- | --- |
| `POST /ai-buddy/speak` | `POST /ai/buddy/sessions/:id/turn/audio` | ✅ (session-based, path өөр) |
| `POST /ai-buddy/text` | `POST /ai/buddy/sessions/:id/turn/text` | ✅ |
| `GET /ai-buddy/usage` | `GET /ai/buddy/usage` | ✅ |
| `GET /ai-buddy/history` | `GET /ai/buddy/sessions/:id/messages` | ✅ (session тус бүрээр; cross-session summary алга) |
| `GET /ai-buddy/profile` | `GET /ai/buddies` + `GET /ai/buddy/usage` | 🟨 салангид — selected buddy + level + limit + learning profile **нэгтгэсэн** endpoint байхгүй |
| `POST /ai-buddy/change-buddy` | session үүсгэхэд `buddySlug` дамжуулдаг | 🟨 хэрэглэгчийн "buddy солих" тусдаа endpoint байхгүй (session бүрт сонгодог) |
| `POST /ai-buddy/feedback` | — | ❌ **Байхгүй** — user report/feedback endpoint нэмэх |
| — | `POST /ai/buddy/sessions` | ✅➕ session lifecycle (docs-д тусгаагүй) |
| — | `POST /ai/buddy/admin/test-voice`, `GET .../admin/safety-events` | ✅➕ admin |
| — | `GET/POST/PATCH/DELETE /ai/buddies`, `GET /ai/buddy-stats`, `GET/PATCH /ai/limits` | ✅➕ admin CRUD + runtime limits |

**Дүгнэлт:** гол урсгал (speak/text/usage/history) бүрэн. Delta = `/feedback`
(шинэ), `/profile` нэгтгэл (сонголт), `/change-buddy` (session загвартай тул
шаардлагагүй байж болно).

---

## 3. Memory давхарга — docs §9 vs backend

| docs memory layer | Backend | Төлөв |
| --- | --- | --- |
| Short-term (last 5-10 turns) | `messages` (per session) | ✅ |
| Learning memory (mistakes, weak grammar/vocab) | `buddy_memories` type `mistake_pattern` | ✅ |
| Profile memory (CEFR, goals, topics, selected buddy) | memory types `interest/goal/preference/level` + `AiBuddy` | ✅ |
| Progress memory (XP, streak, minutes) | `XpLog` + `ai_usages` (voice minutes) | ✅ |
| Buddy memory (style, voice, avatar, personality) | `AiBuddy` entity (systemPrompt, voice, avatarAssetUrl, emotionMap) | ✅ |

**Дүгнэлт:** 5 давхарга бүгд хамрагдсан. ✅ Gap алга.

---

## 4. 3D Avatar — docs (Unity) vs код (three.js) 🔑

Энэ бол хамгийн том зөрүү бөгөөд **аль хэдийн шийдэгдсэн**.

| Тал | docs санал | Одоогийн код |
| --- | --- | --- |
| Render engine | **Unity embedded module** (RN native bridge) | **three.js / `@react-three/fiber`** (expo-gl) — RN дотор native |
| Avatar source | Meshy AI FBX/GLB | ✅ Meshy **GLB** (`AiBuddy.avatarAssetUrl`) |
| Idle/state animation | Unity Animator | ✅ GLB animation clip + `pickClip('idle')` loop |
| Emotion/gesture | Unity Animator + emotion tag | ✅ `emotionMap` (tag→clip) crossfade — backend-ээс ирнэ |
| Lip-sync | SALSA v2 / uLipSync / jaw fallback | ✅ **Procedural jabber** (mouth morph target эсвэл jaw bone) — docs-ийн "jaw fallback"-тай яг ижил; upgrade зам = ElevenLabs `with-timestamps` → viseme |
| Fallback | — | ✅ GLB load амжилтгүй бол 2D зураг руу graceful degrade |

**Яагаад three.js нь энэ кейст ДЭЭР вэ:**
- **App size:** Unity embed нь аппыг ~x→ +тэн MB болгодог; three.js бол JS сан.
- **Complexity:** RN↔Unity native bridge (iOS/Android build config, message passing)
  байхгүй — бүгд RN component дотор.
- **Аль хэдийн ажилладаг:** emotion/gesture/lip-sync/fallback баригдсан.
- Backend contract (`avatar_instruction {emotion, gesture, duration_ms}`,
  `emotionMap`) three.js-ийг шууд тэжээдэг — Unity-д ч, three.js-д ч ижил.

**three.js-ийн эрсдэл (хянах):** low-end Android дээр GLB polygon/texture хүнд бол
FPS/memory. Энэ нь **avatar asset-ийг optimize хийх** асуудал (docs §6/§11-ийн
шаардлага three.js-д ч мөн хамаатай) — engine солих шалтгаан биш.

---

## 5. Unity-г ХЭЗЭЭ хийх вэ? — тодорхой зөвлөмж

> **Богино хариулт: Launch-д Unity ХИЙХГҮЙ. Магадгүй хэзээ ч үгүй.**

| Шатлал | Шийдвэр |
| --- | --- |
| **Одоо / Launch (MVP)** | three.js `BuddyAvatar` ашиглана. Emotion/gesture clip + procedural lip-sync + 2D fallback хангалттай. **Unity руу орохгүй.** |
| **Update 1-2 (post-launch)** | three.js дээр lip-sync-ийг сайжруулах: ElevenLabs `with-timestamps` → real viseme (docs-д дурдсан upgrade зам). Мөн idle/emotion clip-ийн чанар. |
| **Unity-г зөвхөн ЭНЭ нөхцөлд** | three.js low-end Android дээр (a) 3D чанар/FPS бизнесийн шаардлагад **хүрэхгүй**, эсвэл (b) SALSA-ийн түвшний facial expression заавал шаардлагатай болбол л. Тэр үед POC хийж, app-size/build нөлөөг хэмжинэ. |

**Шалтгаан:** engine солих нь хэдэн долоо хоногийн ажил + build/CI өөрчлөлт +
app-size өсөлт. Одоогийн шийдэл нь ижил contract дээр ажиллаж байгаа тул docs-ийн
Unity санал бол "боломжит альтернатив", "заавал" биш.

---

## 6. Хийх ажлын жагсаалт (delta backlog)

### 🟥 Backend (Өсөхбаяр) — жижиг, өндөр үнэ цэнэтэй
1. Contract-д `mistake_tags: string[]` нэмэх (turn бүрийн грамматик/vocab таг) —
   `buddy-contract.ts` + prompt + `TurnResponse`.
2. `TurnResponse`-д `xp_reward` буцаах (mobile celebration-д хэрэгтэй; одоо XP өгдөг
   ч буцаадаггүй).
3. `correction.short_explanation`-ийг **Монголоор** гаргах prompt заавар (docs
   `explanation_mn`).
4. `POST /ai/buddy/feedback` endpoint (user report/like) — `safety_events`/шинэ
   `buddy_feedback`-д хадгална.
5. (Сонголт) `GET /ai/buddy/profile` — selected buddy + CEFR + remaining limits +
   learning profile-ийг нэг хариултаар нэгтгэх (mobile-ийн олон дуудлагыг багасгана).

### 🟨 Mobile 3D (Boju)
6. Chat дээр voice turn урсгалыг бүрэн холбох (mic record → `turn/audio` → audio
   playback → `BuddyAvatar isSpeaking`).
7. `avatar_instruction`-ийг `BuddyAvatar` emotion/gesture-д дамжуулах (аль хэдийн
   prop бэлэн — зөвхөн утас холбох).
8. Low-end Android дээр GLB FPS/memory тест (docs §11 checklist).
9. Lip-sync upgrade (ElevenLabs timestamps → viseme) — post-launch.

### 🟩 Reference (одоохондоо хийхгүй)
- docs §5, §7.1–7.3 (Unity/SALSA/uLipSync setup) — three.js хүрэлцэхгүй нотлогдвол л.

---

## 7. Нэг мөрөнд

> **Backend = бэлэн (жижиг contract delta).** **3D = three.js-ээр аль хэдийн
> хийгдсэн, Unity шаардлагагүй.** Үлдсэн нь mobile-ийн voice UI холболт + avatar
> optimization + post-launch lip-sync сайжруулалт. docs-ийн Unity зам бол
> "нөөц альтернатив", launch-ийн зам биш.
