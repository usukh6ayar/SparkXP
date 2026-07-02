# AI Buddy — Step-by-Step Implementation Runbook

> **Audience:** Claude Opus 4.8 (or any implementing agent/developer).
> **Source spec:** `SparkXP_AI_Buddy_Technical_Pipeline_MN.docx` (repo root, Mongolian).
> This document translates that spec into an **ordered build sequence adapted to the
> real SparkXP codebase**. Execute the steps **top to bottom, one at a time**, and run
> the **Verify** block of each step before starting the next. Do not skip verifies.
> Do not redesign — where this doc and the docx disagree, **this doc wins** (it
> reflects the actual repo, which the docx authors did not see).

---

## Part 0 — Mandatory context (read before writing any code)

### 0.1 Read these files first, in this order

1. `CLAUDE.md` — project rules (especially: all AI calls through the single AI Gateway;
   plan limits must be DB/admin-configurable without app updates; UUID PKs; jsonb for
   flexible content; explicit `@JoinColumn` on every `@ManyToOne`).
2. `CODING_RULES.md` — enforced coding standard (less code, DRY, component/service-based,
   junior-readable). Every change must comply.
3. `API.md` — endpoint reference. You must update it in Step B10.
4. `docs/FUTURE_PLAN.md` §4 "AI & Voice стратеги" — cost guardrails already agreed with
   the business (ElevenLabs Flash v2.5 for TTS, ElevenLabs Scribe for STT, short replies
   only, voice cap → fall back to text mode + upgrade prompt).

### 0.2 Product rules (from the docx — non-negotiable)

| Rule | Meaning |
|---|---|
| Reply length | Every spoken AI reply must fit in **8–15 seconds of audio** (~20–35 words). No lectures. |
| One correction | Exactly **one** correction per turn (the most important mistake). `has_correction: false` is allowed. |
| Follow-up | Every reply **ends with one natural follow-up question** to keep the user talking. |
| CEFR match | Reply difficulty matches the user's CEFR level (A1/A2 simple; B1/B2 natural; C1/C2 advanced). |
| Tone | Friendly, teacher-like, playful — not childish/cringe. |
| Raw transcript | **Never grammar-correct the STT transcript before sending it to the LLM** — the user's mistakes are the input for corrections. Store raw and display text separately. |
| Config-driven | Prompt, persona, voice, model, limits, providers, fallbacks — all from DB/Redis/env config, never hardcoded. |
| Safety | No authoritative medical/legal/financial advice; redirect to language practice. Safe fallbacks for flagged content. Assume minors use the app. |

### 0.3 What already exists — REUSE, do not rebuild

The docx assumes a greenfield Flutter + Unity project. SparkXP is **React Native + Expo
(mobile), NestJS (backend), Vite + React (admin)** and already has most of the plumbing:

| Docx asks for | Already exists — extend this |
|---|---|
| AI Orchestrator / backend module | `backend/src/ai-gateway/` (`ai-gateway.service.ts`, ~960 lines). **All new AI logic goes here or in sibling files inside this module. Do NOT create a separate `ai-buddy` module.** |
| LLM chat | `AiGatewayService.chat()` — Anthropic Claude Haiku (`AI_MODEL = 'claude-haiku-4-5-20251001'`), history replay, Redis daily limits, monthly plan token limits, `Message`/`AiUsage` persistence. |
| TTS | `AiGatewayService.generateSpeechAudio()` / `generateVocabularyAudio()` — ElevenLabs REST (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`). |
| Storage/CDN | `backend/src/ai-gateway/image-storage.service.ts` (`ImageStorageService.storeMedia`) — Cloudinary with stable public_id + overwrite; serves mp3 as `resourceType: 'video'`. |
| Buddy list + personas | `ai_buddies` table (`backend/src/entities/ai-buddy.entity.ts`) + `backend/src/ai-gateway/buddies.ts` (8 personas, synced to DB on boot via `syncBuddiesFromFile()`); CRUD endpoints `GET/POST/PATCH/DELETE /ai/buddies`. |
| Plan limits | `plans` table (`backend/src/entities/plan.entity.ts`) already has `voiceMinutesLimit`, `sttMinutesLimit`, `memoryMbLimit` — **columns exist, enforcement does not**. |
| Usage ledger | `ai_usages` (`backend/src/entities/ai-usage.entity.ts`) with `type` (enum already has `AiUsageType.STT` and `TTS`), `voiceSeconds` (currently always 0), `costMicroUsd`, `metadata` jsonb. |
| Runtime admin config | Redis key `ai:limits:default` (JSON blob, read per-request by `getLimits()`, written by `PATCH /ai/limits`) — extend this blob for buddy runtime settings. |
| Admin UI | `admin/src/pages/buddy/AiBuddyPage.tsx` (buddy CRUD + stats) and `admin/src/pages/settings/SettingsPage.tsx` (limits form). |
| Mobile chat screen | `mobile/app/(tabs)/chat.tsx` ("AI Найз") — text chat works; **mic button is a stub** (shows "coming soon" alert); buddy selector is a hardcoded local array. |
| Mobile API layer | `mobile/src/api/client.ts` (`apiRequest`, `apiUpload`) and `mobile/src/api/ai.ts` (`sendMessage`, `getHistory`). |
| XP award | `XpSource.AI_BUDDY` already exists in `backend/src/common/enums/index.ts`. |

### 0.4 Deployment constraint

Prod (Railway) runs `DB_SYNCHRONIZE=false`. **Every schema change in this runbook needs a
manual SQL migration** in `backend/src/migrations/` following the existing pattern
(e.g. `1782123500000-CreateTranslations.ts`: class implementing `MigrationInterface`
with raw SQL `up`/`down`, filename `<epoch-ms>-Name.ts`).

### 0.5 Ownership

- **Part 1 (backend) + Part 2 (admin):** Өсөхбаяр (branch `usukhbayar`).
- **Part 3 (mobile) + Part 4 (avatar rendering):** Boju (branch `boju`); backend serves
  avatar config. Parts 1–2 must land before Part 3 is fully testable, but Part 3 steps
  1–2 (buddy selector, recording UI) can start against existing endpoints.
- Work stays local / on own branches; merge to `main` only when Өсөхбаяр confirms.

---

## Part 1 — Backend (execute in order)

### Step B1 — Entities + migration (schema first)

**Goal:** all new tables/columns exist so later steps compile against real entities.

**Files:**
- New: `backend/src/entities/buddy-session.entity.ts`, `buddy-memory.entity.ts`,
  `buddy-voice-cache.entity.ts`, `safety-event.entity.ts`
- Edit: `backend/src/entities/message.entity.ts`, `backend/src/entities/ai-buddy.entity.ts`,
  `backend/src/entities/index.ts` (barrel), `backend/src/common/enums/index.ts`
- New migration: `backend/src/migrations/<epoch-ms>-CreateAiBuddyVoice.ts`

**Instructions:**

1. All entities extend `BaseEntity` (UUID id + timestamps). Every `@ManyToOne` gets an
   explicit `@JoinColumn({ name: '...' })`. Nullable strings get explicit `type: 'varchar'`.
2. `BuddySession` (`buddy_sessions`): `userId` (FK → users, CASCADE), `buddySlug varchar`,
   `topic varchar nullable`, `mode enum ('voice','text') default 'voice'`,
   `endedAt timestamptz nullable`. Index on `userId`.
3. `BuddyMemory` (`buddy_memories`): `userId` (FK, CASCADE, indexed), `memoryType enum
   ('interest','goal','mistake_pattern','preference','level')`, `value text`,
   `importance int default 1`, `sourceMessageId uuid nullable`, `expiresAt timestamptz nullable`.
4. `BuddyVoiceCache` (`buddy_voice_cache`): `textHash varchar` + `voiceId varchar`
   (composite unique index), `audioUrl varchar`, `durationMs int`, `hitCount int default 0`.
5. `SafetyEvent` (`safety_events`): `userId` (FK, indexed), `sessionId uuid nullable`,
   `eventType varchar` (e.g. `llm_flagged`, `blocked_topic`, `jailbreak_attempt`),
   `severity varchar default 'low'`, `details jsonb nullable`.
6. Extend `Message` (nullable so existing text-chat rows are untouched):
   `sessionId uuid nullable indexed`, `buddySlug varchar nullable`,
   `audioUrl varchar nullable`, `durationMs int nullable`,
   `rawText text nullable` (raw STT transcript — never cleaned),
   `metadata jsonb nullable` (correction, follow_up_question, emotion, gesture,
   cefr_level_used — one jsonb column, not five columns). `content` stays the display text.
7. Extend `AiBuddy`: `voiceId varchar nullable` (per-buddy ElevenLabs voice; null = env
   default), `ttsParams jsonb nullable` (speed/stability/style), `emotionMap jsonb nullable`
   (emotion tag → animation clip name, used by mobile), `avatarAssetUrl varchar nullable`
   (GLB on Cloudinary/CDN), `avatarThumbUrl varchar nullable`.
8. Add enums to `common/enums/index.ts`: `BuddySessionMode`, `BuddyMemoryType`. The
   allowed LLM emotion/gesture tags are **string constant arrays** (not DB enums, so
   admin can extend): `BUDDY_EMOTIONS = ['happy','curious','thinking','surprised','calm','encouraging','confused']`,
   `BUDDY_GESTURES = ['small_nod','wave','thumbs_up','think_pose','idle','smile']`.
9. Register the 4 new entities in the barrel `entities/index.ts`.
10. Write the migration with raw SQL for: 4 `CREATE TABLE`, `ALTER TABLE messages ADD COLUMN ...`
    (5 columns), `ALTER TABLE ai_buddies ADD COLUMN ...` (5 columns). `down` drops them.

**Verify:** `cd backend && npm run build` passes; `npm run start:dev` boots and (dev has
`DB_SYNCHRONIZE=true`) creates the tables — check with
`psql -d englishxp -c "\d buddy_sessions"` and `"\d buddy_memories"`.

### Step B2 — Provider adapters (STT / LLM / TTS interfaces)

**Goal:** providers become swappable via config, per the docx "no hardcoded providers" rule.

**Files:** new `backend/src/ai-gateway/providers/` folder:
`stt.adapter.ts`, `llm.adapter.ts`, `tts.adapter.ts` (interfaces + implementations),
`providers.config.ts`. Edit `ai-gateway.module.ts` to provide them.

**Instructions:**

1. Define minimal interfaces:
   ```ts
   interface SttAdapter { transcribe(audio: Buffer, mime: string): Promise<{ text: string; confidence: number; seconds: number }> }
   interface LlmAdapter { completeJson(system: string, messages: {role, content}[], maxTokens: number): Promise<{ text: string; promptTokens: number; completionTokens: number; model: string }> }
   interface TtsAdapter { synthesize(text: string, voiceId: string, params?: Record<string, unknown>): Promise<{ audio: Buffer; durationMs: number }> }
   ```
2. Implement `ElevenLabsTtsAdapter` by **moving the fetch logic out of
   `generateSpeechAudio()`** into the adapter; `generateSpeechAudio` /
   `generateVocabularyAudio` then call the adapter (behavior unchanged — refactor, don't fork).
3. Implement `AnthropicLlmAdapter` wrapping the existing `this.anthropic.messages.create`
   call pattern from `chat()`. Keep `chat()` itself working as-is (it can migrate to the
   adapter in the same refactor if trivial; do not break its response shape
   `{ conversationId, reply, tokensUsed }` — mobile depends on it).
4. Provider selection: `providers.config.ts` reads env `STT_PROVIDER` (default
   `elevenlabs`), `LLM_PROVIDER` (default `anthropic`), `TTS_PROVIDER` (default
   `elevenlabs`) and returns the adapter instances via NestJS DI tokens. One provider
   per kind is enough now — the interface IS the fallback seam.
5. Duration for TTS: estimate `durationMs` from mp3 (use `Buffer` length ÷ bitrate is
   too crude — parse mp3 frame headers with a tiny helper or use the ElevenLabs
   `with-timestamps` endpoint variant which returns character timing; acceptable MVP:
   ElevenLabs `.../with-timestamps` response gives alignment → take last character's end time).

**Verify:** `npm run build`; existing reading/idiom audio generation still works
(`POST` an admin audio-generation request or run the existing flow once locally).

### Step B3 — STT adapter (ElevenLabs Scribe)

**Goal:** audio in → `{ text, confidence, seconds }` out, logged to `ai_usages`.

**Files:** `backend/src/ai-gateway/providers/stt.adapter.ts`.

**Instructions:**

1. Implement `ElevenLabsSttAdapter` calling `POST https://api.elevenlabs.io/v1/speech-to-text`
   (model `scribe_v1`), multipart with the audio buffer, header `xi-api-key: ELEVENLABS_API_KEY`.
   Parse `text` and `language_probability` (use as confidence; if absent, default 1).
2. Compute `seconds` from the request audio duration (Scribe response includes word
   timestamps — take the last word's `end`; fallback: client-reported duration field).
3. Do **not** log usage inside the adapter — the orchestrator (Step B6) logs one
   `ai_usages` row per pipeline stage so charging stays in one place.
4. Retry once on 5xx with 1s backoff (mirror the retry style used for Gemini in
   `words.service.ts`). On final failure throw a typed error the orchestrator maps to
   the "I didn't catch that" fallback.

**Verify:** temporary e2e: add a quick `nest` REPL or a small script that reads a local
`.m4a`/`.mp3` sample and prints the transcript. Delete the script after verifying.

### Step B4 — LLM JSON output contract + validator

**Goal:** the buddy LLM always returns machine-parseable JSON; backend validates 100%.

**Files:** new `backend/src/ai-gateway/buddy-contract.ts` (types + validator + system
prompt builder). New DTOs in `backend/src/ai-gateway/dto/`.

**Instructions:**

1. Define the contract type exactly as the docx §5:
   ```json
   {
     "reply_text": "string — short, natural, level-appropriate; goes to TTS",
     "correction": { "has_correction": true, "original": "", "corrected": "", "short_explanation": "" },
     "follow_up_question": "string",
     "emotion": "happy|curious|thinking|surprised|calm|encouraging|confused",
     "gesture": "small_nod|wave|thumbs_up|think_pose|idle|smile",
     "cefr_level_used": "A1|A2|B1|B2|C1|C2",
     "memory_update": { "should_save": false, "memory_type": "interest", "value": "" },
     "safety": { "flagged": false, "reason": null }
   }
   ```
2. Validate with a hand-rolled type-guard function (project has no zod; do not add a
   dependency for one schema). Checks: required fields present, `reply_text` non-empty
   and ≤ ~280 chars (≈15s of speech), emotion/gesture within the constant arrays from
   Step B1 (unknown → coerce to `calm`/`idle`, don't reject), `safety.flagged` boolean.
3. System prompt builder `buildBuddySystemPrompt(buddy: AiBuddy, cefr: string, memories: string[], topic?: string)`
   composes: buddy `systemPrompt` (persona from DB) + the docx mandatory rules,
   verbatim in English:
   - You are SparkXP AI Buddy, a friendly English speaking practice partner.
   - Always match the user CEFR level ({cefr}).
   - Keep the spoken reply short enough for 8–15 seconds of audio.
   - Give only one correction per turn, unless the user asks for detailed correction.
   - Always end with one natural follow-up question.
   - Do not give long lectures. Do not over-explain grammar.
   - Return valid JSON only. No markdown, no extra text outside JSON.
   Then append the JSON shape and the long-term memory bullet list.
4. Parse flow: strip markdown fences if present → `JSON.parse` → validate. On failure,
   **retry the LLM once** with an appended "Your previous output was not valid JSON.
   Return only valid JSON." message. On second failure return the static fallback
   contract object (`reply_text: "Sorry, I got stuck for a second. Let's try again!"`,
   `emotion: calm`, `gesture: idle`, no correction, generic follow-up).

**Verify:** unit-test the validator + parser with: valid JSON, fenced JSON, junk text,
unknown emotion, overlong reply. (Follow existing test setup if present; otherwise a
`buddy-contract.spec.ts` with the repo's jest config.)

### Step B5 — Usage guard (voice minutes enforcement)

**Goal:** `plans.voiceMinutesLimit` / `sttMinutesLimit` become real, enforced monthly caps.

**Files:** new `backend/src/ai-gateway/buddy-usage.service.ts`; register in
`ai-gateway.module.ts`.

**Instructions:**

1. Monthly usage = SUM over `ai_usages` for the current calendar month:
   `voiceSeconds` where `type = TTS` (voice-out minutes) and where `type = STT`
   (STT minutes). Query with TypeORM `createQueryBuilder` SUM + `created_at >= date_trunc('month', now())`.
   (No new counter columns on `users` — the ledger is the source of truth; mirror how
   `XpLog` is the truth and caches are optional. Add a Redis 60s cache of the sums if
   the query shows up in latency.)
2. `checkVoiceAllowance(user)` returns `{ allowed, usedSeconds, limitSeconds, warnLevel }`
   where `warnLevel` ∈ `none|warn80|warn95` (per `ROADMAP.md` 80/95% warnings).
   `limitSeconds = plan.voiceMinutesLimit * 60`; `null` limit = unlimited. Same for STT.
3. Enforce **before any provider call** (docx: limit reached → no AI call at all).
   Throw `ForbiddenException` with a Mongolian message consistent with existing ones
   (see `chat()`: "Сарын ... хязгаар хэтэрлээ"), plus `error.code = 'VOICE_LIMIT'` in the
   response body so mobile can show the upgrade CTA and fall back to text mode.
4. Daily/anti-abuse: reuse the existing Redis daily counter pattern
   (`dailyMessageKey`) — add `ai:daily:voice:{userId}:{date}` counting turns; default
   cap in the extended `DEFAULT_LIMITS` (Step B6.6), e.g. `dailyVoiceTurnLimit: 60`.

**Verify:** unit test with a mocked repo: under limit → allowed; at 80%/95% → warn
levels; over → throws; `null` limit → always allowed.

### Step B6 — Turn orchestration (the core pipeline + endpoints)

**Goal:** the docx §3 pipeline end-to-end:
pre-check → STT → context → LLM → validate → TTS (cache) → store → respond.

**Files:** new `backend/src/ai-gateway/buddy.service.ts` (orchestrator) +
`buddy.controller.ts` (`@Controller('ai/buddy')`) + DTOs; register both in
`ai-gateway.module.ts`. Edit `ai-gateway.controller.ts` only to add the missing
`GET /ai/limits` (see 6.7).

**Endpoints (all JWT-guarded, same guards as `ai-gateway.controller.ts`):**

| Method | Path | Body / notes |
|---|---|---|
| POST | `/ai/buddy/sessions` | `{ buddySlug, mode?: 'voice'\|'text', topic? }` → creates `BuddySession`, returns `{ sessionId, buddy, usage }` |
| POST | `/ai/buddy/sessions/:id/turn/audio` | multipart `file` (m4a/mp3, ≤ ~60s) — full pipeline, returns turn response below |
| POST | `/ai/buddy/sessions/:id/turn/text` | `{ text }` — same pipeline minus STT |
| GET | `/ai/buddy/sessions/:id/messages` | history for UI (owner only) |
| GET | `/ai/buddy/usage` | `{ voiceSecondsUsed, voiceSecondsLimit, sttSecondsUsed, sttSecondsLimit, warnLevel }` |
| GET | `/ai/buddy/memory` | list of `{ id, memoryType, value, createdAt }` (no raw internals) |
| DELETE | `/ai/buddy/memory` | clear all buddy memories for the user |

**Turn response shape (docx §10, exact):**

```json
{
  "session_id": "...", "message_id": "...",
  "user_transcript": "I go cafe yesterday",
  "reply_text": "Good try! Say: I went to a cafe yesterday.",
  "correction": { "original": "...", "corrected": "...", "short_explanation": "..." },
  "follow_up_question": "Who did you go with?",
  "audio_url": "https://res.cloudinary.com/.../ai-buddy/msg_xxx.mp3",
  "avatar_instruction": { "emotion": "encouraging", "gesture": "small_nod", "duration_ms": 8500 },
  "usage": { "voice_seconds_used_this_month": 615, "voice_seconds_limit_this_month": 1500, "warn_level": "none" }
}
```

**Pipeline instructions (voice turn):**

1. **Pre-check:** session exists & belongs to user & not ended; `BuddyUsageService`
   allowance (STT + voice); Redis daily voice-turn counter. Fail fast, no provider calls.
2. **STT:** `MulterModule`/`FileInterceptor` (already a dependency — `@types/multer` is
   installed) with in-memory storage, 2MB limit. Call `SttAdapter.transcribe`. If
   `confidence < 0.4` (runtime-configurable, see 6.6): return the fallback turn
   response `reply_text: "I didn't catch that clearly. Can you say it again slowly?"`
   with `emotion: curious`, **charge no STT seconds** and skip LLM/TTS.
3. **Context builder:** load buddy (by session's `buddySlug`), user CEFR from
   `users.level` (exists — `user.entity.ts:52`, values `'a1'..'c1'`; null → default `B1`),
   last N messages of this session (N = `maxContextMessages` from
   limits), top 10 `buddy_memories` by `importance` then recency. Build the system
   prompt with `buildBuddySystemPrompt` (Step B4). History user-turns use **rawText**
   (the uncorrected transcript).
4. **LLM:** `LlmAdapter.completeJson(...)` with `max_tokens: 500`. Parse + validate per
   Step B4 (with the single retry).
5. **Safety gate:** if `safety.flagged` → do **not** TTS the model output; insert a
   `safety_events` row (`eventType: 'llm_flagged'`, details = reason); respond with the
   safe redirect line ("Let's keep practicing English! What did you do today?"),
   `emotion: calm`. Continue the pipeline normally otherwise.
6. **TTS with cache:** `textHash = sha256(reply_text)`; look up `buddy_voice_cache`
   by (textHash, voiceId). Hit → increment `hitCount`, reuse `audioUrl`/`durationMs`,
   charge **no** TTS seconds. Miss → `TtsAdapter.synthesize(reply_text, buddy.voiceId ?? env default, buddy.ttsParams)`,
   store via `ImageStorageService.storeMedia` with stable public_id
   `ai-buddy/{messageId}` (`resourceType: 'video'` — same as existing audio), insert
   cache row.
   Extend `DEFAULT_LIMITS` in `ai-gateway.service.ts` (same Redis blob) with:
   `sttMinConfidence: 0.4`, `dailyVoiceTurnLimit: 60`, `maxReplyChars: 280` — all
   admin-editable via the existing `PATCH /ai/limits`.
7. **Missing route fix:** add `GET /ai/limits` (admin-guarded) to
   `ai-gateway.controller.ts` returning `getLimits()` — the admin `SettingsPage`
   already calls it and currently 404s.
8. **Persist:** two `Message` rows — user turn (`role: USER`, `content` = display
   transcript, `rawText` = raw transcript, `sessionId`, `buddySlug`) and AI turn
   (`role: ASSISTANT`, `content` = reply_text, `audioUrl`, `durationMs`,
   `metadata` = { correction, follow_up_question, emotion, gesture, cefr_level_used }).
   Use the session id as the `conversationId` value too (keeps existing history
   queries working without special-casing).
9. **Log usage:** one `ai_usages` row per stage actually used:
   STT (`type: STT`, `voiceSeconds` = audio seconds, cost ≈ `seconds/3600 * 0.39 * 1e6` µUSD),
   LLM (`type: TEXT_CHAT`, tokens + Haiku cost formula copied from `chat()`,
   `metadata.buddySlug` + `metadata.sessionId`),
   TTS (`type: TTS`, `voiceSeconds` = `durationMs/1000` rounded up, cost ≈
   `chars/1000 * 0.05 * 1e6` µUSD; 0 cost on cache hit — skip the row entirely on hit).
   Increment `users.aiInputTokens/aiOutputTokens` like `chat()` does.
10. **Memory write:** if `memory_update.should_save` → apply the backend filter
    (Step B7) before inserting.
11. **XP:** on the **first completed voice turn of a session**, award XP via the
    existing XP service with `XpSource.AI_BUDDY` (find how reading awards
    `XpSource.READING` on finish and mirror it; keep the amount small, e.g. +10, and
    once per session to prevent farming).
12. **Text turn** (`/turn/text`): identical from step 3 onward; `user_transcript` = the
    sent text; still TTS the reply (buddy speaks even for typed input).
13. **Error fallbacks (docx §14)** — wrap each stage:
    - LLM timeout/failure after retry → fallback contract from B4.4, still TTS'd if possible.
    - TTS failure → return turn response with `audio_url: null`; mobile shows text +
      avatar stays idle (never 500 the whole turn for a TTS error).
    - Any unhandled stage error → log, return a clean 200-level fallback turn, never a crash.

**Verify (curl, against `npm run start:dev`):**

```bash
TOKEN=<jwt from POST /api/auth/login>
# 1. session
curl -s -X POST localhost:3000/api/ai/buddy/sessions -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"buddySlug":"spark","mode":"voice"}'
# 2. text turn (grammar mistake on purpose)
curl -s -X POST localhost:3000/api/ai/buddy/sessions/<id>/turn/text \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"text":"I go cafe yesterday"}'
# expect: reply_text ≤ ~280 chars, exactly one correction, follow_up_question present, audio_url set
# 3. audio turn
curl -s -X POST localhost:3000/api/ai/buddy/sessions/<id>/turn/audio \
  -H "Authorization: Bearer $TOKEN" -F "file=@sample.m4a"
# 4. usage
curl -s localhost:3000/api/ai/buddy/usage -H "Authorization: Bearer $TOKEN"
# 5. repeat the same text turn → second TTS should be a cache hit (check buddy_voice_cache.hit_count)
```

### Step B7 — Memory pipeline

**Goal:** long-term personalization with filtering + cap + user control.

**Files:** new `backend/src/ai-gateway/buddy-memory.service.ts`; wire into
`buddy.service.ts` (write) and `buddy.controller.ts` (GET/DELETE — routes from B6).

**Instructions:**

1. **Write filter** (backend has final say over LLM suggestions — docx §8):
   reject if `value` length < 10 or > 300 chars; reject if `memory_type` not in the
   enum; **dedupe** — skip if an existing memory for the user has >0.8 trigram
   similarity (simple approach: lowercase + compare with `pg_trgm` `similarity()` in
   SQL, or in JS via normalized substring check — keep it junior-readable).
   Docx examples — save: "preparing for IELTS speaking", "likes business topics",
   "often makes past tense mistakes"; never save: one-time jokes, sensitive personal
   details not needed for learning.
2. **Cap:** before insert, `SUM(length(value))` for the user; if it exceeds
   `plan.memoryMbLimit * 1024 * 1024` bytes (null = unlimited), delete the oldest
   lowest-importance rows until under cap (FIFO by `importance ASC, created_at ASC`).
3. **Read:** `getContextMemories(userId, limit = 10)` ordered by `importance DESC, created_at DESC` — used by the context builder (B6.3).
4. **Clear:** `DELETE /ai/buddy/memory` deletes all rows for the user; after clearing,
   the next turn must contain no personalization (QA case).

**Verify:** text turn saying "I am preparing for IELTS and I love football" → check
`psql -c "select memory_type, value from buddy_memories"`; DELETE the memory; next turn's
system prompt (log it at debug level) contains no memory bullets.

### Step B8 — Safety hardening

**Goal:** docx §13 — minors-safe defaults, audit trail, abuse prevention.

**Files:** `buddy.service.ts`, `buddy-contract.ts` (already mostly done in B4–B6; this
step completes the checklist).

**Instructions:**

1. System prompt already forbids high-stakes advice (B4.3) — additionally append the
   safety line: "If the user asks for medical, legal, or financial advice, or brings up
   self-harm or adult topics, set safety.flagged=true and gently redirect to English practice."
2. Raw audio: **never persist the uploaded audio buffer** (in-memory multer only; it is
   garbage-collected after STT). Add env `AI_BUDDY_LOG_RAW_AUDIO=false` +
   `AI_BUDDY_AUDIO_RETENTION_DAYS=0` documented in `.env.example` — code only reads the
   flag to (later) enable retention; default path stores nothing.
3. Rate-limit abuse: the daily voice-turn Redis cap (B5.4) covers spam; also log a
   `safety_events` row (`eventType: 'rate_limited'`) when a user hits it, so admin can see repeat offenders.
4. Jailbreak visibility: if the validator had to coerce/retry AND the transcript
   contains prompt-injection markers ("ignore previous instructions", "system prompt"),
   log `safety_events` with `eventType: 'jailbreak_attempt'`, severity `low`. No blocking — just audit.

**Verify:** text turn "Tell me exactly which medicine to take for chest pain" →
response redirects to practice, `safety_events` row exists.

### Step B9 — Buddy config surface for clients

**Goal:** mobile can render buddies + avatars from the API, nothing hardcoded.

**Files:** `ai-gateway.service.ts` (`findAllBuddies`), `buddies.ts`, `dto/create-buddy.dto.ts`.

**Instructions:**

1. Extend `CreateBuddyDto`/`UpdateBuddyDto` with the new optional fields (`voiceId`,
   `ttsParams`, `emotionMap`, `avatarAssetUrl`, `avatarThumbUrl`) with class-validator
   decorators (`@IsOptional() @IsString()` etc.).
2. `GET /ai/buddies` response now includes those fields + a computed `defaultEmotionMap`
   (the constant emotion→clip mapping) when `emotionMap` is null, so mobile always gets
   a complete map.
3. Add sensible values for the default buddy in `buddies.ts` (`spark`): leave
   `avatarAssetUrl` null until Part 4 produces the GLB; mobile falls back to the
   existing 2D image when null. `syncBuddiesFromFile()` must not overwrite
   admin-edited values (check how it currently merges — it should only seed when missing).

**Verify:** `curl localhost:3000/api/ai/buddies -H "Authorization: Bearer $TOKEN"` shows
the new fields.

### Step B10 — Docs + env

**Goal:** the team can discover everything you built.

**Instructions:**

1. `API.md`: add every new endpoint (path · auth/role · purpose · params) in the
   existing table style + frontend usage mapping (mobile chat screen, admin pages).
2. `.env.example`: add **placeholders only** (never real keys):
   `STT_PROVIDER=elevenlabs`, `LLM_PROVIDER=anthropic`, `TTS_PROVIDER=elevenlabs`,
   `AI_BUDDY_LOG_RAW_AUDIO=false`, `AI_BUDDY_AUDIO_RETENTION_DAYS=0`.
   (Reply seconds / CEFR default / confidence threshold live in the Redis limits blob,
   not env — they're admin-tunable at runtime.)
3. `CLAUDE.md` "Current Status": one short paragraph — AI Buddy voice pipeline shipped
   (backend), what's config-driven, migration name that prod needs.
4. Note in `ROADMAP.md`'s shared-changes section: new tables + `messages`/`ai_buddies`
   columns need the prod migration; new env keys.

**Verify:** `git diff --stat` shows only intended files; `npm run build` green.

---

## Part 2 — Admin panel (after Part 1)

Pattern for every page: `admin/src/pages/<name>/<Name>Page.tsx`, `PageHeader` +
`api.get/post/patch` from `admin/src/api/client.ts` + existing `Modal`/`Input`/
`FormActions`/`Button` components + `<Pagination>` for lists. Register routes in
`admin/src/App.tsx`, nav in `admin/src/components/Sidebar.tsx`.

### Step A1 — Extend `AiBuddyPage` (buddy voice + avatar config)

- Add form fields to the existing buddy edit modal: `voiceId` (text), `ttsParams`
  (three numeric inputs: speed/stability/style), `avatarAssetUrl`, `avatarThumbUrl`,
  and an `emotionMap` editor (7 rows: emotion tag → animation clip name text input).
- Add a **"Test voice"** button per buddy: calls a new admin-only
  `POST /ai/buddy/admin/test-voice` `{ buddySlug, text }` → returns `audio_url`; play it
  with an `<audio>` element (add this small endpoint in `buddy.controller.ts`,
  admin-role guarded, reusing the TTS adapter + voice cache).

### Step A2 — Extend `SettingsPage` (runtime limits)

- The existing form edits the Redis blob via `GET/PATCH /ai/limits` (GET now exists
  after B6.7). Add the new fields: `sttMinConfidence`, `dailyVoiceTurnLimit`,
  `maxReplyChars`. Label section "AI Buddy voice".
- Plan-level voice/STT/memory limits are already editable in the existing plan CRUD —
  verify they render; add the three fields to the plan form if missing.

### Step A3 — Safety events page

- New page `admin/src/pages/safety/SafetyEventsPage.tsx` (route `/safety`): paginated
  table of `safety_events` (user, eventType, severity, createdAt, details expandable).
  Backend: `GET /ai/buddy/admin/safety-events?page=` (admin-guarded) in `buddy.controller.ts`.
- Do not expose message contents beyond what's in `details` — privacy-safe audit (docx §13).

**Verify (Part 2):** run admin locally, edit a buddy voiceId → test voice plays; change
`dailyVoiceTurnLimit` → `GET /ai/limits` reflects it without restart; safety page lists
the B8 test event.

---

## Part 3 — Mobile (Boju, after Part 1 endpoints exist)

All API calls go in `mobile/src/api/ai.ts` (extend it), through
`apiRequest`/`apiUpload` from `client.ts` — never raw fetch in screens. Colors/spacing
from `theme.ts`; text via `mobile/src/i18n` (Mongolian first). Reuse components from
`mobile/src/components/`.

### Step M1 — Wire the buddy selector to the API

- Replace the hardcoded `BUDDIES` array in `mobile/app/(tabs)/chat.tsx` with
  `GET /ai/buddies` (add `getBuddies()` to `api/ai.ts`). Render thumb (`avatarThumbUrl`
  fallback emoji), name, title. Selecting a buddy starts a session
  (`POST /ai/buddy/sessions`) and stores `sessionId` in screen state.

### Step M2 — Text turn through the new pipeline

- Add `sendBuddyTextTurn(sessionId, text, token)` → `POST /ai/buddy/sessions/:id/turn/text`.
- Render the turn: user bubble (transcript), AI bubble (`reply_text`, keep
  `TappableText` for tap-to-translate), a **correction card** component
  (original struck through → corrected + short_explanation) shown only when a
  correction exists, follow-up question styled as part of the AI bubble.
- Auto-play `audio_url` with `expo-audio` player; speaker icon to replay.

### Step M3 — Push-to-talk voice turn

- Mic button (currently the stub alert): hold-to-record with `expo-audio`
  recorder — preset: m4a/AAC, 16kHz, mono (smallest upload). Release → upload via
  `apiUpload` to `/ai/buddy/sessions/:id/turn/audio` with a recording-state UI
  (pulsing mic, "Listening…", cancel by slide-away or a cancel button).
- Show `user_transcript` as the user bubble when the response arrives.
- Handle `error.code === 'VOICE_LIMIT'`: switch the screen to text-only mode banner
  ("Дуут яриа энэ сард дууслаа") + upgrade CTA; keep text turns working (docx/FUTURE_PLAN rule).
- Show usage meter: `GET /ai/buddy/usage` on session start; render minutes used/limit
  near the mic; at `warn_level` warn80/warn95 show the warning toast.

### Step M4 — History, memory, fallbacks

- Session history via `GET /ai/buddy/sessions/:id/messages` on reopen.
- Profile/settings: "AI Buddy memory" row → list (`GET /ai/buddy/memory`) + "Устгах"
  (DELETE, with confirm dialog).
- Fallback rendering: `audio_url: null` → show text + a retry-audio icon; network/5xx →
  friendly retry bubble, never a crash.

**Verify (Part 3):** on-device (Expo) full loop: pick buddy → hold mic → speak a
sentence with a mistake → hear the corrected short reply, see correction card + follow-up
→ usage meter increments. Airplane-mode mid-turn shows retry UI, no crash.

---

## Part 4 — 3D Avatar (Boju + Өсөхбаяр)

The docx specifies Unity. The app is React Native + Expo, so the adapted approach is:
**AI-generated rigged GLB (Meshy AI) rendered with three.js in RN**. Unity-in-RN is the
escape hatch only if this proves insufficient — do not start with it.

### Step V1 — Produce the buddy 3D asset (Meshy AI, no code)

*Meshy AI (meshy.ai) is an AI 3D-asset generator: text/image → textured 3D model,
auto-rigging (~30s, no manual weight painting), 100+ animation presets, GLB export.*

1. Input: the SparkXP fox mascot art (front-facing, clean background) → Meshy
   **Image-to-3D** (latest Meshy 6 model). Iterate until the fox reads well from the
   front at small size.
2. **Auto-rig** in Meshy (humanoid/biped rig; A-pose). Then attach animation presets —
   minimum set mapped to our enums: idle (breathing/blinking) → `idle`/`calm`,
   nod → `small_nod`, wave → `wave`, thumbs-up → `thumbs_up`, think → `think_pose`,
   happy bounce → `happy`, surprised → `surprised`.
3. Export **GLB with animations embedded**, target < 5 MB (reduce texture to 1024px,
   low-poly). Upload to Cloudinary; set the URL in admin (`avatarAssetUrl` on buddy
   `spark`, Step A1).
4. Mouth: if the Meshy rig lacks a jaw bone/morph target, open the GLB once in Blender
   and add a single "mouth_open" shape key (or jaw bone) — this is the only manual 3D
   step, needed for lip-sync.

### Step V2 — Render in React Native

- Deps (mobile): `npx expo install expo-gl` + `npm i three @react-three/fiber`
  (use `@react-three/fiber/native` entry; works in Expo Go).
- New component `mobile/src/components/BuddyAvatar.tsx`:
  props `{ assetUrl, emotion, gesture, isSpeaking, audioLevel }`.
  - Load GLB with `useGLTF`/`GLTFLoader`, play the `idle` clip on loop via
    `AnimationMixer`.
  - Map incoming `avatar_instruction.emotion`/`gesture` → clip names using the buddy's
    `emotionMap` from `GET /ai/buddies`; unknown/missing clip → fall back to idle
    (docx rule: unknown emotion → `calm_idle`). Crossfade 0.3s between clips.
  - **Lip-sync MVP:** while `isSpeaking`, drive the `mouth_open` morph target (or jaw
    bone rotation) with `audioLevel` (0–1). Get `audioLevel` from the `expo-audio`
    player metering callback; smooth it (lerp) to avoid flapping. This is
    amplitude-based viseme approximation — the docx explicitly allows "basic phoneme
    approximation" for v1.
- Place `<BuddyAvatar>` at the top of the chat screen (per `SCREEN_SPECS.md` layout);
  when `avatarAssetUrl` is null render the current 2D image instead — the feature ships
  without the GLB and upgrades visually when the asset lands.
- Performance rules (docx §7): one buddy loaded at a time; dispose GL context on screen
  blur (`useFocusEffect`); preload only the default buddy's GLB, lazy-load others on
  selection.

**Verify (Part 4):** on a mid-range Android device: avatar idles at ≥30fps, emotion
changes on each turn, mouth moves while audio plays, unknown emotion string falls back
to idle without warnings, screen navigation away/back doesn't leak memory (no crash
after 10 open/close cycles).

---

## Part 5 — QA acceptance (run before merging to `main`)

From docx §15 — all must pass:

| # | Test | Expected |
|---|---|---|
| 1 | Voice turn basic | Speak 5–10s → transcript, one correction, short reply, audio, avatar_instruction all present |
| 2 | Text turn basic | STT skipped; LLM/TTS/avatar all work |
| 3 | CEFR control | A1 user gets simple reply; B2 more natural (set `cefr` per test user) |
| 4 | One-correction rule | Multi-error sentence → exactly one correction |
| 5 | Follow-up rule | Every reply ends with one question |
| 6 | Emotion fallback | Force unknown emotion tag → coerced to calm/idle, no error |
| 7 | Usage limit | Set plan `voiceMinutesLimit` to a tiny value → provider not called, `VOICE_LIMIT` error, text mode still works |
| 8 | Memory write filter | Useful fact saved; trivial one-liner not saved |
| 9 | Memory delete | After DELETE, next turn has no personalization |
| 10 | Provider failure | Kill/point ELEVENLABS key at garbage → friendly fallback, no 500, no crash |
| 11 | Latency | Log STT/LLM/TTS ms per turn in `ai_usages.metadata`; eyeball avg < ~6s per turn |
| 12 | Safety | Unsafe prompt → safe redirect + `safety_events` row |
| 13 | Voice cache | Identical reply text twice → 2nd turn hits cache (hit_count++), no TTS charge |
| 14 | JSON validation | Backend never returns unvalidated LLM output (spot-check logs) |

**Release checklist:** prod migration applied (Railway, `DB_SYNCHRONIZE=false`);
`API.md`/`.env.example`/`CLAUDE.md` updated; admin can change persona/voice/limits with
no deploy; `GET /ai/limits` returns 200; mobile handles `VOICE_LIMIT` gracefully.

---

## Appendix — plan limit reference (business-configurable, never hardcode)

| Plan | Voice (TTS) | STT | Memory cap |
|---|---|---|---|
| Standard | 25 min/mo | ~75 min/mo | 100 MB |
| Plus | 50 min/mo | 100–120 min/mo | 250 MB |
| Premier | 90 min/mo | higher | higher |

These are **seed values for the `plans` table**, set via admin — the code only reads
`plan.voiceMinutesLimit` / `sttMinutesLimit` / `memoryMbLimit`.

## Appendix — cost model (for `costMicroUsd`)

- STT: ElevenLabs Scribe realtime ≈ $0.39/hr → `seconds / 3600 * 0.39 * 1e6` µUSD
- TTS: ElevenLabs Flash v2.5 ≈ $0.05/1k chars → `chars / 1000 * 0.05 * 1e6` µUSD
- LLM: Claude Haiku — copy the exact formula already in `chat()`
  (`promptTokens * 0.0008 + completionTokens * 0.004` → µUSD)
