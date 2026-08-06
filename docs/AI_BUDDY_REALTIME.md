# AI Buddy — Realtime (streaming) layer

**Status (2026-08-06):** shipped as an *additive* layer. The existing
request-response buddy is unchanged and remains the fallback.

## What this is

A streaming **delivery** layer over the existing buddy turn pipeline. It does
**not** replace `BuddyService`. Every turn still runs the exact same pipeline —
STT → LLM JSON contract → **safety gate** → TTS → XP → memory — via
`buddy.textTurn` / `buddy.audioTurn`. The realtime layer adds:

- **Server-Sent Events transport** for a turn (`/api/ai/buddy/rt/*`).
- **Progressive delivery**: `transcript` → `chunk` (reply, sentence by sentence)
  → `audio` → `done` (the full, byte-identical `TurnResponse`).
- **Interrupt**: `POST /interrupt/:streamId` stops the remaining stream.
- **Automatic fallback**: any client that can't stream uses the plain REST turn
  endpoints, which are untouched.

## Why deliver the *validated* turn, not raw tokens

The buddy reply is a **validated JSON contract** (`buddy-contract.ts`:
`reply_text`, `correction`, `follow_up_question`, `avatar_instruction`, …) that
must clear the **safety gate as a whole** before a single word is spoken to a
child. Streaming raw LLM tokens would defeat that gate. So the turn is computed +
validated first, then revealed progressively — the perceived-latency win (early
transcript, progressive reveal, interrupt) **without weakening safety**.

## Honest limits (why some pieces are gated, not faked)

| Asked for | Delivered | Why not more |
| --- | --- | --- |
| Realtime STT | Final transcript, emitted as one event | Streaming STT needs a WS transport; ElevenLabs Scribe (the configured provider) is request-response only |
| Partial transcript | `partialTranscript: false` | Same — no streaming STT; and Expo Go (SDK 54) can't stream live mic PCM frames |
| Streaming AI responses | Reply streamed sentence-by-sentence | Reply is a JSON contract + safety-gated as a whole; token streaming would be unsafe/fragile |
| Streaming TTS | One validated clip + `audio` event, interruptible | Per-token TTS would re-synthesize + re-bill; the single clip is already cached server-side |
| Interrupt | ✅ real | — |
| Fallback | ✅ real, automatic | — |

No new backend dependency: SSE is native to NestJS (`@Sse`, rxjs). No new mobile
dependency.

## Mobile reality (Expo Go SDK 54)

React Native `fetch` in Expo Go has **no incremental body reader** (`ReadableStream`)
and there is **no `EventSource`**, so a live progressive stream can't be consumed
on-device. `src/api/buddyRealtime.ts` therefore:

- Reads the whole SSE response once the server closes it, then replays the events
  in order (a native build with a streaming HTTP client makes this truly
  progressive with **no caller change**).
- Is gated by `src/lib/buddyRealtimeFlag.ts` → `BUDDY_REALTIME_ENABLED = false`.

With the flag off (today), `sendBuddyTextTurnSmart` / `sendBuddyAudioTurnSmart`
call the classic endpoints — so `chat.tsx` behaves exactly as before. Flip the
flag in a dev/native build to enable the realtime path; either gate failing
(flag off, server probe off, or any stream error) falls back automatically.

## Files

**Backend (additive):**
- `src/ai-gateway/buddy-realtime.service.ts` — SSE stream registry, reuses
  `BuddyService`, interrupt, ownership + TTL cleanup.
- `src/ai-gateway/buddy-realtime.controller.ts` — `/ai/buddy/rt/*`.
- `src/ai-gateway/dto/realtime-turn.dto.ts`.
- `src/ai-gateway/ai-gateway.module.ts` — registered the new provider + controller.
- Env: `BUDDY_REALTIME_ENABLED` (default on; `0` disables → clients fall back).

**Mobile (additive, off by default):**
- `src/api/buddyRealtime.ts` — capabilities probe, start/consume/interrupt, and
  the `*Smart` drop-in wrappers with automatic fallback.
- `src/lib/buddyRealtimeFlag.ts` — the off-by-default flag.
- `src/api/client.ts` — exported `BASE_URL` (for the SSE fetch).
- `app/(tabs)/chat.tsx` — send paths call the `*Smart` wrappers.

## Future work (to make it truly realtime)

1. Streaming STT provider over WS (e.g. Deepgram / OpenAI Realtime) → real partial
   transcript.
2. Native streaming HTTP client (dev build) → true progressive reveal on-device.
3. Optional token-streaming for the *chat* (non-safety-critical) surface, keeping
   the safety-gated JSON contract for the child-facing buddy.
