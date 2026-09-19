# AI Buddy — Performance work (task board + baseline)

> **Goal:** make the AI Buddy feel fast and game-like without changing behavior
> or visual quality. The avatar GLB is **immutable** — no compression, no
> decimation, no Draco/Meshopt/KTX2, no re-export. We improve *delivery* and
> *runtime*, never the asset.

## Task board

```
AI Buddy Performance — 10 tasks (10 done, 0 in progress, 0 open)

⚠️ T6–T10 were first done against a **truncated copy of the brief** (it ended at
the T6 heading). The full brief arrived 2026-09-20; the gaps it exposed are
closed in the **Revision** section at the end of this document, which supersedes
the T6, T7 and T8 sections above where they conflict.

✓ T1 — baseline and architecture audit
✓ T2 — persistent Buddy asset cache
✓ T3 — cache integration and download lifecycle
✓ T4 — runtime preload and parse warm-up
✓ T5 — microphone warm-up
✓ T6 — Azure Fast STT rollout
✓ T7 — backend critical-path optimization
✓ T8 — first TTS chunk optimization
✓ T9 — latency verification and regression tests
✓ T10 — production-readiness audit
```

✓ done · ◼ in progress · ◻ open

---

## T1 — Baseline and architecture audit (2026-09-19)

No behavior was changed in this task. Below is the map of what exists today.

### A. Buddy entry path (tab → rendered avatar)

| # | Step | Where | Notes |
| --- | --- | --- | --- |
| 1 | Tab mounts | `mobile/app/(tabs)/chat.tsx` | Always-mounted tab; `mode` starts at `'select'`. |
| 2 | Availability | `getBuddyAvailability` → `GET /ai/buddy/availability` | **Fails closed.** Roster is not fetched until this answers `true`. |
| 3 | Roster | `getBuddies` → `GET /ai/buddies` | Gives `avatarAssetUrl`, `avatarThumbUrl`, `emotionMap` per buddy. |
| 4 | Selection | `BuddySelector.tsx` | Carousel renders **thumbnails only** — deliberately no GL canvas per card. |
| 5 | Apply | `selectBuddy()` + `setMode('voice')` | `selectBuddy` is `async` and **awaited serially**: `POST /ai/buddy/sessions` → then `POST /ai/buddy/text-session`. |
| 6 | Stage | `BuddyVoiceStage.tsx` | Mounts `BuddyAvatar` only when `SHOW_3D_AVATAR && buddy.avatarAssetUrl`. Shows a spinner + "Уншиж байна" until `onReady(true)`. |
| 7 | GLB fetch | `BuddyAvatar.loadGlb` → `fetchArrayBuffer` | `XMLHttpRequest` with `responseType: 'arraybuffer'` — already the **native binary path**, not base64. No disk cache: every cold start re-downloads. |
| 8 | GLTF parse | `new GLTFLoader().parse(buffer, '', …)` | Pure JS, on the JS thread. |
| 9 | Texture decode | `applyEmbeddedTextures` → `bytesToTexture` | Pure JS: `upng-js` for PNG, `jpeg-js` for JPEG → `THREE.DataTexture`. RN has no DOM image decoder. Mipmaps disabled on purpose. |
| 10 | Ready | `modelCache.set(url, promise)`; per-mount `SkeletonUtils.clone` | `onReady(true)` → stage drops the spinner. |

### B. Voice turn path (mic → audible reply)

| # | Step | Where |
| --- | --- | --- |
| 1 | Finger down | `BuddyVoiceStage` pan gesture `onBegin` → `onRecordStart` |
| 2 | Recording start | `chat.tsx:startRecording` — `requestRecordingPermissionsAsync()` → `setAudioModeAsync({allowsRecording:true})` → `recorder.prepareToRecordAsync()` → `recorder.record()`. **All four run on every press.** |
| 3 | Release (**t0**) | `stopRecording` — `recorder.stop()`, `setAudioModeAsync({allowsRecording:false})` |
| 4 | Chunk queue starts | `startChunkQueue(player, streamId, …)` fires **in parallel** with the upload (client-minted `streamId`) |
| 5 | Upload | `sendBuddyAudioTurnSmart` → `POST /ai/buddy/sessions/:id/turn/audio` (m4a, mono 16 kHz, 32 kbps) |
| 6 | STT | `buddy.service.audioTurn` → `STT_ADAPTER` (`GeminiSttAdapter`, model `gemini-3.5-flash-lite`) → `timer.mark('stt')` |
| 7 | Context | buddy row + limits (Redis) + memories + history → `timer.mark('context')` |
| 8 | LLM | `streamTurn` when a `streamId` was sent; `safety` → `emotion` → `reply_text` chunks (`streaming-reply.ts`) |
| 9 | TTS | `synthesizeChunk` per speakable chunk, **serial queue**, `AzureTtsAdapter` (pooled synthesizers) |
| 10 | Publish | `BuddyTurnStreamService.publish` → client long-poll `GET /ai/buddy/turns/:id/chunk/:i` (20 s max wait, 3 min TTL, in-memory) |
| 11 | First audio (**t7**) | `player.replace({uri: …/audio/:i})` → `playerStatus.playing` flips → latency reported |

### C. Existing telemetry (do not rebuild)

- **Server:** `TurnTimer` (`buddy.service.ts`) writes every stage into the
  assistant message's `metadata.latency`, keyed by `turn_id`. Stages:
  `upload · stt · context · llm_first_token · llm_first_speakable · llm ·
  llm_bookkeeping · tts_first_chunk · tts_first_chunk_provider · persist ·
  server_total`.
- **Client:** `track('buddy_turn_latency', …)` (PostHog) + a server report via
  `POST /ai/buddy/turns/client-latency` (`t0ToAudibleMs`, `t0ToFirstVisemeMs`).
- **Query:** `backend/scripts/buddy-latency.sql` → p50/p95.
- **Avatar:** none. `loadGlb` logs only size + URL; there is no timing for
  fetch / parse / texture decode. **T1 adds DEV-only stage timings here.**

### D. Existing caches

| Cache | Where | Scope | Gap |
| --- | --- | --- | --- |
| RAM parsed model | `BuddyAvatar.modelCache` (`Map<url, Promise<Loaded>>`) | app process | dies on restart |
| API GET responses | `src/api/persistCache.ts` (AsyncStorage, JSON, ≤256 KB/entry) | persistent | **text only** — unusable for a 25 MB binary |
| TTS clips | `buddy_voice_cache` + R2 (server) | server | — |
| Azure synthesizer connections | `AzureTtsAdapter` pool | server process | — |

There is **no persistent binary/file cache on the device today**, and
`expo-file-system` is a dependency that the app never imports.

### E. Installed FileSystem API (verified, not assumed)

`expo-file-system@19.0.24` (SDK 54) — the **new** object API:

- `Paths.document` (survives restarts, private) · `Paths.cache` (system may purge)
- `new Directory(...)` → `.create({ intermediates, idempotent })`, `.list()`, `.delete()`
- `File.downloadFileAsync(url, destination, { idempotent })` → `Promise<File>`;
  **no progress callback**, so a download percentage is not available cleanly
- `file.bytes(): Promise<Uint8Array>` — a **direct binary read**, no base64 hop
- `file.exists`, `file.size`, `file.md5`, `file.modificationTime`, `file.move()`,
  `file.rename()`, `file.delete()`
- No backup-exclusion API in this version (an iOS note for T10, not a blocker).

`expo-file-system/legacy` also ships, but nothing in the app uses it and the new
API covers every need here.

### F. Asset identity — can Buddy URLs change?

Yes, and cleanly. `backend/src/upload/upload.controller.ts` stores every model
as `buddy/models/${randomUUID()}.glb` on R2, so **re-uploading an avatar always
produces a new URL**. The URL is therefore a valid version identity: same URL =
same bytes, new upload = new URL = new cache entry. (A raw URL must still never
be used as a filename — it contains `/` and `:`.)

### G. STT/TTS provider routing (server)

`providers/providers.config.ts`, all env-driven, **defaults are the old values**:

- `STT_PROVIDER` — default `gemini`. `azure` wraps `AzureFastSttAdapter` in
  `FallbackSttAdapter` (Azure first, Gemini on 429/5xx/network). Both adapters
  and the fallback already exist and are unit-tested.
- `LLM_PROVIDER` — default `anthropic`; prod wants `gemini`.
- `TTS_PROVIDER` — default `gemini`; **only `azure` returns visemes**.

Measured numbers already on record (CLAUDE.md, Phases 1–5):

| | p50 | note |
| --- | --- | --- |
| E2E first audio (Phase 1 baseline) | 8565 ms | before streaming |
| E2E first audio (Phase 4, current) | 3583 ms | p90 4896 · p95 5211 |
| STT Gemini `3.5-flash-lite` | 1451–1865 ms | dominant remaining cost |
| STT Azure Fast (C=1) | 286 ms | **F0 tier: 20 req/60 s** |
| Azure TTS first chunk | 298 ms | after connection pooling |

**Known external blocker for T6:** Azure Fast Transcription on the current **F0**
Speech resource is capped at 20 requests/minute (measured: request 21 → 429 with
`retry-after: 54`). Rolling it out as the default requires an **S0 (paid) tier**
— a config/billing decision outside the repository. The `FallbackSttAdapter`
exists precisely so the rollout can be staged safely, and T6 will deliver that
staging (default unchanged until the quota is raised).

### H. First-use vs next-launch today (the problem T2/T3 solve)

```
TODAY                                  TARGET
first use   → download 25 MB           first use   → download 25 MB → save to disk
next launch → download 25 MB again     next launch → read from disk, no network
same session→ RAM modelCache (fast)    same session→ RAM modelCache (unchanged)
```

### Baseline checks (all green before any change)

```
mobile:  tsc --noEmit  → clean
mobile:  eslint .      → 0 errors, 20 warnings (all pre-existing)
backend: tsc --noEmit  → clean
backend: npm test      → 37 suites, 407 tests passed
```


---

## T2 — Persistent Buddy asset cache (2026-09-19)

New file: `mobile/src/lib/buddyAssetCache.ts`. Nothing else changed.

- **Where:** `Paths.document/buddy-assets/` — private app storage that survives
  restarts. Never the public Downloads directory. API verified against the
  installed `expo-file-system@19.0.24`, not copied from another SDK version.
- **Exact bytes:** `File.downloadFileAsync` writes what the CDN served. There is
  no transform step anywhere in the module. The GLB is immutable.
- **Key:** `assetCacheKey(url)` = two FNV-1a passes (forward + reversed) → 16 hex
  chars, plus the url's real extension. The raw url is never a filename.
  Verified deterministic, distinct per url, 0 collisions over 200k uuid-shaped
  urls, and `?v=2` / `#frag` / uppercase `.GLTF` all parse.
- **Atomic:** download → `<key>.tmp` → `move()` → `<key>.glb`. A file under the
  real name is always a finished download.
- **Dedupe:** module-level `inflight` map (same pattern as `api/client.ts`),
  cleared in `finally` so a failure stays retryable.
- **Validation:** `exists && size >= 1024`, on write and on hit. No network call
  on a cache hit. Bytes that are large but corrupt are handled by
  `invalidateBuddyAsset()` (wired in T3), not by a second sniffing mechanism.
- **Cleanup:** keeps the 4 newest assets, sweeps `.tmp` older than an hour.
  Scoped strictly to `assetDir().list()`, never the just-resolved file, and it
  runs outside the download's try block so housekeeping cannot fail a download.

## T3 — Cache integration + download lifecycle (2026-09-19)

Final architecture, as required:

```
REMOTE ASSET → PERSISTENT DEVICE CACHE → LOCAL GLB
             → EXISTING GLTF PARSER → EXISTING RAM MODEL CACHE → RENDER
```

- `BuddyAvatar.loadGlb` now takes its bytes from `readGlbBytes(url)`:
  persistent cache first, plain XHR download on **any** cache failure. A broken
  cache degrades to exactly today's behavior.
- **No base64 anywhere on the binary path.** Disk uses `file.bytes()`
  (`Uint8Array` straight from native); network keeps the existing XHR
  `responseType: 'arraybuffer'`.
- `toArrayBuffer` gained a fast path: a view that already covers its whole
  buffer is returned as-is. It used to `slice()`, which copied all 25 MB of the
  model to produce an identical buffer.
- **RAM `modelCache` is untouched** — it still removes the parse + texture
  decode within a session. Persistent cache removes the download across
  launches. Neither replaces the other.
- **Corrupt cache recovery:** a `GLTFLoader.parse` failure on *cached* bytes
  calls `invalidateBuddyAsset(url)`, so the next attempt re-downloads instead of
  failing identically forever.
- **UX:** the stage's existing spinner now says "Дүрсийг татаж байна…" when the
  file is not on the device yet and "Уншиж байна…" when it is — decided by one
  synchronous `cachedBuddyAssetUri()` lookup, no new props and no second state
  machine. No percentage: `downloadFileAsync` exposes no progress callback in
  this SDK, and a fake bar is worse than none.
- **Startup is already parallel** — `onApply` calls `selectBuddy(buddy)` without
  awaiting it and then `setMode('voice')` in the same tick, so the stage mounts
  and the avatar starts resolving while `POST /ai/buddy/sessions` is still in
  flight. `setSessionId` also lands before the text-session request, so the mic
  is not gated on it either. Verified, not changed.
- DEV logging now names the source: `load disk=… parse=… textures=…` vs
  `load network=… parse=… textures=…`.

Checks: mobile `tsc --noEmit` clean · `eslint .` 0 errors (20 pre-existing
warnings, unchanged).

## T4 — Runtime preload and parse warm-up (2026-09-19)

- **New export `prewarmBuddyAvatar(url)`** (`BuddyAvatar.tsx`) — a thin wrapper
  over the existing `loadGlbCached`, so a warmed model lands in the **same** RAM
  `modelCache` the avatar reads. No second cache, no duplicated loader.
- **Trigger** (`chat.tsx`): one effect, active only while `mode === 'select'` and
  the feature is open. It warms **exactly one** buddy — `selected ?? buddies[0]`
  (the buddy already chosen this session, otherwise the one the carousel opens
  on). The roster is never bulk-downloaded: each avatar is its own ~25 MB file.
- **Scheduling:** `InteractionManager.runAfterInteractions`, cancelled on
  unmount. The parse is JS-thread work, so this keeps it off the carousel's
  animations — warming can never make swiping feel worse than not warming.
- **Stale work is structurally impossible, not guarded against.** `modelCache`
  is keyed by url and the stage only ever looks up **its own** `assetUrl`, so
  warming buddy A cannot make the stage render A when B was applied.
- **Memory:** one model at a time, and it is the one about to be shown. Nothing
  is parsed speculatively for buddies the student swipes past.
- **Measurement** (DEV): stages are now reported separately —
  `load resolve=… read=… parse=… textures=… · 24.2 MB` (or `network=…` when the
  cache is bypassed), plus `ready in Nms (warm|cold)` for the number the student
  actually feels: avatar mount → on screen.
- Fallback behavior is unchanged: a failed warm is swallowed, and the entry path
  retries and reports in the normal way.

Checks: mobile `tsc --noEmit` clean · `eslint .` 0 errors / 20 pre-existing
warnings.

## T5 — Microphone warm-up (2026-09-19)

**Audited first.** The press→capture chain is
`requestRecordingPermissionsAsync` → `setAudioModeAsync({allowsRecording:true})`
→ `prepareToRecordAsync()` → `record()`, all awaited on every press.

**What was hoisted**

- `mobile/src/lib/mic.ts` (new): `ensureMicPermission()` caches a **grant** for
  the life of the process — safe because changing an app's microphone
  permission from Settings restarts the process on both iOS and Android, so the
  cached answer cannot go stale. A **refusal is never cached**: an accidental
  "Don't allow" must not lock the mic out for the whole run.
- `warmMicPermission()` runs when the conversation opens, so the first
  press-and-hold is not what raises the system dialog. It only asks for
  permission — nothing records, and no recording UI is shown.

**What was deliberately NOT done, with the reason**

- **The recorder is not pre-prepared.** `prepareToRecordAsync` is not a passive
  allocation: expo-audio's `AudioRecorder.prepare` (ios/AudioRecorder.swift:68)
  calls `session.setCategory(.playAndRecord)` + `setActive(true)`. Preparing
  before the press would put the screen in `playAndRecord` while the buddy is
  still speaking, which routes playback to the earpiece — the "volume faded
  out" bug. The installed lifecycle offers no way to prepare without that, so
  the spec's own condition ("only if it supports it safely") is not met.
- **`setAudioModeAsync` is not deduplicated.** The saving is one native call in
  the press→cancel→press case, and a cached belief about a **global** session
  that other screens (`speaking.tsx`, IELTS `SpeakingAnswer`) also change
  without resetting is exactly how a routing bug gets introduced. Not worth it.
- `prepareToRecordAsync()` is already called with no options, which is the cheap
  native path — with options it re-creates the `AVAudioRecorder`. Left as is.

**Measurement** (DEV): `[buddy] mic live in Nms` — finger down → `record()`
returned. This is the window in which the mic UI is up but nothing is being
captured, so it is the number that matters.

**Behaviour re-checked against the existing code paths:** normal press · quick
tap (`holdRef` aborts before `record()`) · slide-to-cancel · hands-free lock ·
permission denied (re-asks) · leaving the screen (focus cleanup restores
playback mode) · recording after the buddy speaks (`stopSpeaking` first) ·
playback after recording (`stopRecording` restores playback mode) · overlapping
prepare (`holdRef` guard). None changed.

Checks: mobile `tsc --noEmit` clean · `eslint .` 0 errors / 20 pre-existing
warnings.

## T6 — Azure Fast STT rollout (2026-09-19)

The adapter (`AzureFastSttAdapter`) and the Gemini fallback wrapper
(`FallbackSttAdapter`) already existed. What was missing was everything that
makes selecting them **safe under load** — and one stale line of documentation
that hid the option entirely.

**The problem the rollout actually had.** With a full quota window, every turn
went: Azure round trip → 429 → Gemini round trip. That is *slower than never
switching providers at all*. The fallback turned a lost turn into a slow one,
but it had no memory, so it paid the doomed request on every single turn for the
whole 60-second window.

**Delivered**

- `SttProviderError` now carries `retryAfterMs`, parsed from Azure's
  `retry-after` header (measured: a 429 carries `retry-after: 54`).
- `FallbackSttAdapter` gained a **circuit breaker**: one provider failure and
  Azure is skipped outright for the window it asked for (or 30 s when it did not
  say), so a throttled provider costs a turn **nothing** instead of a round
  trip. A success closes the breaker again. A 4xx never opens it — that is the
  audio's fault, not the provider's, and the existing "don't fall over on 4xx"
  rule still holds.
- Three new tests (9 total in that suite, 410 backend tests overall).
- `.env.example`: `STT_PROVIDER` documented as `gemini (default) | azure` with
  the measured numbers and the tier caveat — it previously read
  "gemini (only option today)", which is why the option was invisible.
  `AZURE_STT_LOCALE` documented (it was read by the adapter but written nowhere).
- `providers.config.ts` comment corrected to name **F0 vs S0** as the gate.

**External blocker — this is the one thing that cannot be settled in the repo.**
Making `STT_PROVIDER=azure` the production default needs a **paid S0 Azure
Speech tier**. On F0 the resource is capped at 20 requests/60 s (measured), i.e.
~5–6 students speaking at once. That is a billing decision, not a code change.
With the breaker in place the switch is now *safe* on either tier — on F0 it
simply degrades to Gemini under load instead of getting slower than Gemini — but
it is only *faster* on S0, so the default is deliberately unchanged.

To roll out once S0 is provisioned: set `STT_PROVIDER=azure` (plus the existing
`AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`) on Railway. No app update, no
migration. Expected: STT p50 1451 → 286 ms, E2E first-audio p50 ≈ 3583 → ~2400 ms.

Checks: backend `tsc --noEmit` clean · `npm test` 37 suites / **410 passed** ·
lint unchanged (7 pre-existing prettier warnings in the touched files, 0 added).

## T7 — Backend critical-path optimization (2026-09-19)

### A measurement bug, found first

`new TurnTimer(clientT0)` was constructed **after** the pre-check block, and its
constructor computes `upload_ms = now − clientT0`. Every pre-check round trip
was therefore charged to **upload time**: the checks were invisible and the
network looked slower than it is. The timer now starts first and the block has
its own `precheck_ms` stage (added to `scripts/buddy-latency.sql`).

### What was actually serial

Before a single byte of audio reached the STT provider, an audio turn made
**six** round trips one after another:

```
sessions.findOne → users.findOne(+plan) → redis GET limits
→ SUM(ai_usages) for STT → SUM(ai_usages) for TTS → redis GET+INCR daily
```

and then, before the LLM, **four** more:

```
buddies.findOne → redis GET limits (again) → memories → history
```

### Changes

- Pre-checks: the three independent reads (session, user, limits) run together;
  the two monthly quota aggregates run together. `precheck` 6 round trips → 3.
- Context: limits first (it decides `maxContextMessages`), then buddy + memories
  + history together. 4 round trips → 2.
- The prompt-injection audit write is no longer awaited. It is audit-only — the
  code already said "no blocking" — but it sat in front of the LLM call.

### What was deliberately preserved (and is now tested)

Making the quota reads concurrent is where this kind of change goes wrong, so
the *decision* order is still written by hand:

- **STT cap is reported before the voice cap.** `Promise.all` rejecting on
  whichever provider answered first would tell a student who ran out of
  speech-recognition minutes that they ran out of speaking minutes.
- **`checkDailyTurns` stays last and serial — it is a WRITE.** Folded in
  alongside the quota checks, a refused turn would still burn one of the
  student's daily turns, for an error they never saw.

`buddy-precheck.spec.ts` (4 tests) pins both. Verified the guard is real: the
naive "parallelize everything" version **fails 2 of the 4**.

### Not touched, on the repo's own evidence

`llm_bookkeeping` (usage log + two token increments) and the post-audio persist
block were left alone. CLAUDE.md's Phase 1 measurement records persist at 12 ms
and explicitly warns against re-optimising that path; on the streaming path it
is after first audio anyway.

Checks: backend `tsc --noEmit` clean · `npm test` **38 suites / 414 passed** ·
`eslint` clean on every touched file.

## T8 — First TTS chunk optimization (2026-09-19)

**The gap the existing pool leaves.** Phase 4's synthesizer pool is the biggest
TTS win on record (first audio p50 799 → 159 ms), but it only warms **through
use**. `acquire()` builds a fresh `SpeechSynthesizer` when the pool is empty and
the SDK opens its WebSocket lazily on the first synthesis — so the first spoken
chunk after a deploy, and after every `POOL_IDLE_TTL_MS` (4 min) expiry, still
pays the full handshake.

**Fix: pay it at session start, when nobody is waiting.**

- `AzureTtsAdapter.prewarm(voiceId)` acquires a synthesizer, opens its socket
  with `sdk.Connection.fromSynthesizer(...).openConnection()`, and releases it
  into the pool. It **synthesizes nothing**, so it is not billable.
- `TtsAdapter.prewarm?()` is **optional** on the interface — Gemini has no
  connection to warm and does not implement it.
- Called from `BuddyService.startSession`, i.e. on "Apply", seconds before the
  first turn. Fire-and-forget: a failed warm-up can never block a session.
- Only runs when the pool is empty for that voice (warming the first chunk, not
  hoarding sockets) and when Azure is configured at all.
- A connection that fails to open is **disposed, never pooled** — handing a
  broken connection to the next turn is worse than having no warm one.

5 new tests (`azure-tts.adapter.spec.ts`, 25 in that suite), covering: pooled on
success · never synthesizes · discarded on failure · skipped when already warm ·
skipped when unconfigured.

**Deliberately not done:** lowering `MIN_CHUNK_CHARS` to cut the first sentence
earlier. Phase 4 measured this as worthless — replies are capped at 20 words, so
`firstSentence_p50` (1571 ms) already equals `replyComplete_p50` (1560 ms).
Re-litigating it would be optimising against a number the repo already has.

Checks: backend `tsc --noEmit` clean · `npm test` **38 suites / 419 passed** ·
`eslint` clean on every touched file.

## T9 — Latency verification and regression tests (2026-09-19)

### Regression tests added

| Suite | Pins |
| --- | --- |
| `turn-timer.spec.ts` (9, **new**) | The instrument itself — see below |
| `buddy-precheck.spec.ts` (4, T7) | Quota decision order · the daily counter is a write |
| `fallback-stt.adapter.spec.ts` (+3, T6) | Breaker opens, honours `retry-after`, ignores 4xx |
| `azure-tts.adapter.spec.ts` (+5, T8) | Prewarm pools, never synthesizes, discards failures |

**Backend total: 39 suites / 428 tests, all passing** (was 37 / 407).

`TurnTimer` had **zero** coverage, despite every latency claim in this repo
being a reading taken from it — which is how T7's measurement bug (pre-checks
charged to `upload_ms`) survived unnoticed. The new suite pins the *meaning* of
each field: upload is t0→start; a client clock ahead of the server is dropped,
not clamped; each stage is charged only the time since the previous one; `set`
does not move the cursor `mark` uses; `has` is what keeps `llm_first_token`
meaning *first*.

### Mobile: verified by harness, because there is no runner

`/mobile` has **no test runner at all** and adding one means new devDependencies
— which CLAUDE.md reserves to the lead, because a Metro/dep change is what
breaks Expo Go for everyone else. So `buddyAssetCache` was verified by compiling
the **real module** (esbuild → CJS) against an in-memory stand-in for
`expo-file-system`. 16/16 checks pass:

- first use downloads once · stored under a hashed name, never the url · no temp
  file left behind
- second call is a cache hit with no network · the sync peek agrees
- **3 concurrent requests for an uncached buddy → exactly 1 download**
- a failed download rejects, leaves no partial file, and stays retryable
- a truncated download is rejected and never cached
- `invalidateBuddyAsset` removes the file and the next call re-downloads
- the cache stays bounded at 4 · **unrelated files outside the directory are
  never touched**

One caveat worth recording: the harness's first run reported "0 files kept",
which looked like a prune bug and was a bug in the *harness* (a uri prefix that
never matched, making the check vacuous). Fixed, and the bound is now genuinely
verified at 4.

⚠️ **Gap for the lead:** these are scratchpad checks, not CI. A `jest-expo`
setup in `/mobile` would turn them into real regression tests.

### How to verify the latency numbers on real hardware

Nothing below can be measured from this repo — it needs a device and a
production database. The instrumentation is in place for all of it.

**Device (DEV console, Metro):**

| Log line | What it tells you |
| --- | --- |
| `[BuddyAvatar] load resolve=… read=… parse=… textures=… · 24.2 MB` | First launch shows a large `resolve`; **every later launch must show no `resolve` at all** and a small `read`. That is the T2/T3 result. |
| `[BuddyAvatar] ready in Nms (warm\|cold)` | `warm` on entering a conversation = T4's preload did its job. |
| `[BuddyAvatar] prewarm <url>` | Fired while the picker is open, for one buddy only. |
| `[buddy] mic live in Nms` | T5. The window where the mic UI is up but nothing is captured. |

**Server (production Postgres):**

```
psql -d sparkxp -f backend/scripts/buddy-latency.sql
```

`precheck` is a **new row** in that report (T7). Compare `upload` against the
recorded baseline: part of what used to be counted as upload is now reported
separately, so upload should *drop* without the network changing.

**Reference points already on record** (CLAUDE.md, Phases 1–5): E2E first audio
p50 8565 → 3583 ms; STT p50 1451–1865 ms; Azure TTS first chunk 298 ms.

### Honest limits of this verification

- Every mobile number is **uninstrumented until someone runs the app**. Expo Go
  on iOS cannot open this SDK-54 project (CLAUDE.md, 2026-09-07), so it needs an
  Android device with the SDK 54 Go build, an iOS simulator, or a dev build.
- The T6 Azure STT numbers are **not re-measured here** — they need an S0 tier.
- No before/after production figures are claimed for T7/T8. Both changes remove
  work that is provably on the critical path (serial round trips; a WebSocket
  handshake), and the stages that would show it are now reported — but a number
  that has not been taken is not a result.

Checks: backend `tsc` clean · **39 suites / 428 tests** · mobile `tsc` clean ·
`eslint` 0 errors in both packages.

## T10 — Production-readiness audit (2026-09-19)

### Two issues found in my own work, both fixed

1. **A synchronous native call on the render path.** `assetDir()` called
   `Directory.create()` on **every** lookup, and `cachedBuddyAssetUri()` runs
   during render (it decides which wait the stage shows). That put a filesystem
   round trip in front of a render for a directory that cannot vanish while the
   app is running. Now created once per app run.
2. **The storage budget was a guess.** `MAX_ASSETS` was 4 — up to ~100 MB of a
   student's phone at ~25 MB an avatar, in the document directory, which iOS
   includes in iCloud backups. Lowered to **3** (~75 MB worst case), which still
   covers browse → choose → change-your-mind without re-downloading. The
   constant now states the arithmetic so it can be revisited with real data.

Re-verified: 16/16 harness checks still pass, with the bound now at 3.

### Accepted risks, stated rather than hidden

- **Prewarm can spend a student's mobile data on a buddy they don't pick.** It
  warms `buddies[0]`, which is where the carousel opens and therefore the most
  likely choice — but if they swipe past it and choose another, that is ~25 MB
  of Mongolian mobile data for nothing. The escape hatch is one line in
  `chat.tsx`: warm only `selected`, which costs first-time users the win. Left
  as is because the brief asks for the likely buddy to be warmed; revisit if
  data cost shows up in analytics. The carousel's current index is not visible
  from `chat.tsx` without changing a shared component, so "most likely" cannot
  currently follow the swipe.
- **Document directory is backed up to iCloud.** `expo-file-system@19` exposes
  no backup-exclusion API, so this cannot be fixed in JS today. The alternative,
  `Paths.cache`, can be purged by the OS — which would break "download once per
  device", the whole point. Document is the right call; this is the cost.
- **`modelCache` (RAM, in `BuddyAvatar`) is unbounded** and pre-dates this work.
  A student who applies many buddies in one session holds every parsed model —
  geometry plus JS-decoded RGBA textures — until the app restarts. Prewarm adds
  at most one entry that might go unused. Not fixed here: bounding it means
  disposing geometry/textures correctly, and getting that wrong shows up as
  visual corruption. Worth a task of its own.
- **The STT breaker is per-process.** Several Railway instances each discover
  the rate limit independently. Correct but not optimal; a shared Redis flag
  would be the next step if Azure ever becomes the default.

### Checklist

| | |
| --- | --- |
| GLB bytes modified anywhere? | **No.** Download → move → `bytes()` → `toArrayBuffer`. No compression, decimation, Draco/Meshopt/KTX2, texture or rig change. Grep confirms the only mentions are comments. `toArrayBuffer` now returns the buffer instead of copying it — the parser only reads, and the buffer comes from a fresh read, so nothing can observe a mutation. |
| New dependencies? | **None**, either package. `expo-file-system` was already in `package.json` (unused) and ships inside Expo Go — **Choi/Boju do not need `npm install`.** |
| Database migration? | **None.** No schema change. |
| New required env vars? | **None.** `AZURE_STT_LOCALE` is documented and optional (defaults to `en-US`). |
| Secrets in client code? | No. The phone never receives a provider key. |
| Fails safe offline / on error? | Yes. Cache failure → network. Download failure → existing 2D fallback. Prewarm failure → swallowed. TTS prewarm failure → disposed, normal path unaffected. STT provider failure → Gemini. |
| Degrades on an old backend? | Yes — nothing in the turn contract changed. |
| Feature flags respected? | Yes. `SHOW_3D_AVATAR`, `AI_BUDDY_ENABLED`, `STT_PROVIDER`, `TTS_PROVIDER` all unchanged in meaning and default. |
| Behaviour changes visible to a student? | Only two, both intended: the avatar wait says "Дүрсийг татаж байна…" on first use, and the microphone permission is asked when the conversation opens rather than mid-press. |

### Ownership and next step

`CLAUDE.md` assigns `/backend` to Өсөхбаяр and says mobile devs request
endpoints rather than edit it. T6–T8 are backend changes made from the `boju`
checkout, so **they need Өсөхбаяр's review before merge**, and the repo's rule
is a branch plus a PR — `main` is never pushed directly. Nothing has been
committed; the working tree holds the change.

Checks: backend `tsc` clean · **39 suites / 428 tests** · mobile `tsc` clean ·
`eslint` 0 errors in both packages (20 pre-existing mobile warnings, unchanged).


---

# Revision (2026-09-20) — against the full brief

The brief this work started from was cut off at the `T6 — Azure Fast STT
rollout` heading, so T6's details and all of T7–T10 were inferred from the
repository. The full text arrived later. What it asked for that was missed:

## T6 — three tests and a missing timeout

- **Azure STT had no timeout at all.** `fetch` has no short default, so a
  provider that stopped answering would hold a turn open for minutes — and the
  fallback only fires on an *error*, which a hang never produces. Added
  `AZURE_STT_TIMEOUT_MS` (10 s, ~12× the measured p95 of 804 ms): it catches
  dead connections, not slow ones, and turns a hang into a Gemini fallback.
- Added the three tests the brief names (12 in that suite now): **timeout →
  fallback** · **empty transcript is a success, not a retry** (both readings are
  defensible; retrying would bill every accidental mic tap twice and double the
  wait before "say that again") · **both providers down → the error reaches the
  caller** (swallowing it would read as "the student said nothing" and ask them
  to repeat into an outage).

**Findings reported, not silently fixed:**

1. **Usage accounting changes when the provider changes.** Gemini *estimates*
   duration from word count (`words / 2.5`); Azure reports the real
   `durationMilliseconds`. A student's monthly STT minutes are therefore counted
   differently under each provider — a slow speaker costs more under Azure. This
   must be a conscious decision before rollout, not a surprise.
2. **STT cost is hard-coded at `$0.39/hour` regardless of provider**
   (`buddy.service.ts`). Neither Azure S0 nor Gemini is that price. The real
   figures are not in the repository, so no number was invented — this needs the
   same treatment `llm-pricing.ts` got.
3. **Gemini STT has no timeout either**, and it retries up to 3×, so a bad day
   multiplies. Choosing a bound needs real tail data: the repo records p95
   2.6 s but also one day at 16.8 s. Not guessed at inside a latency task.

## T7 — the two places the brief actually pointed at

Both were bookkeeping writes sitting *on* the critical path, and both are now
**started early and joined at a durability-safe boundary** — never
fire-and-forget, which the brief explicitly forbids.

- **After STT:** the STT usage row sat between the transcript and the LLM. Now
  started before `runTurn` and awaited in `finally`, so the wait hides behind
  the LLM but no response leaves before the billing row is durable.
- **After LLM:** the usage row and the two token counters sat between a
  validated reply and speech synthesis (the non-streaming/fallback path — on the
  streaming path they are already after first audio). Now a `Promise.all`
  started before TTS and awaited before the messages are persisted.

`buddy-durability.spec.ts` (3 tests) pins it: the row is on disk before the turn
settles · charged once, with the provider's seconds · **a failed write surfaces
instead of being swallowed**. Verified the guard is real — the fire-and-forget
version fails 2 of the 3.

`llm_bookkeeping` should now read ~0 in `buddy-latency.sql`; anything else means
the writes went serial again. Noted in the script.

## T8 — the chunker, benchmarked as asked

The first attempt substituted a different optimisation (the Azure connection
prewarm, which stands) and declined to touch the threshold, citing Phase 4. The
brief asked for a benchmark at 50/40/35/30. Done — and the first reply set was
wrong, which `buddy-contract.ts` caught: `reply_text` is capped at **20 words,
aiming for 6–12**, with the question in a *separate* field.

Re-run against six contract-accurate replies:

| threshold | chars before first chunk (total) | TTS calls | tiny chunks |
| --- | --- | --- | --- |
| 50 | 288 | 6 | 1 |
| **40** | **256** | 7 | 1 |
| 35 | 256 | 7 | 1 |
| 30 | 256 | 7 | 1 |

**50 → 40 is the only step that does anything**, and it affects exactly one
shape: a near-cap (17-word) reply containing a comma. There the buddy starts
speaking at 48 characters — *"That sounds like a really wonderful day,"* —
instead of waiting for all 80, i.e. **40% earlier**, with the remainder coming
out as one natural clause. The other five shapes are byte-identical and no new
tiny chunk appears. This helps the **longest** replies, which is where p90/p95
lives.

**40 → 35 → 30 changes nothing at all**, so `FIRST_CHUNK_MIN` /
`SUBSEQUENT_CHUNK_MIN` was *not* implemented: the brief allows it only if
evidence supports it, and the evidence says a single threshold of 40 is already
at the floor. A regression test pins the near-cap behaviour (21 in that suite).

## T9 — measured, where measurement is possible

**Avatar — "download once per device", verified across simulated relaunches**
(10/10, real module against an in-memory filesystem):

- launch 1 downloads once; launches 2–5 find it on disk with **zero** network
  calls and the same local file
- a **new asset version** (admin re-upload → new uuid url) downloads separately
  and leaves the old file valid
- **clearing app data** re-downloads, as it should

That covers every legitimate re-download case the brief lists.

**Backend critical path — round trips removed.** Provider calls are unchanged
and excluded, so the effect is visible:

| stage | before | after |
| --- | --- | --- |
| pre-checks | 6 serial | 3 |
| STT usage write | 1 serial | 0 (joined later) |
| context build | 4 serial | 2 |
| LLM bookkeeping | 3 serial | 0 (joined later) |
| **total on the critical path** | **14** | **6** |

Eight round trips removed. In milliseconds that is 8 × the real DB/Redis
latency — modelled at 5/25/60 ms per round trip it comes to 51/234/549 ms. The
real figure depends on Railway's database latency, which cannot be measured from
here.

**Still not measured, and still not claimed:** end-to-end p50/p95 on real
hardware. Expo Go on iOS cannot open this SDK-54 project, so the device numbers
need an Android SDK-54 Go build, a simulator, or a dev build. The DEV log lines
and the SQL to read are listed in the T9 section above.

Checks after the revision: backend `tsc` clean · **40 suites / 435 tests** ·
mobile `tsc` clean · `eslint` 0 errors in both packages.

## T10 (revised) — audited against the full checklist

**Lifecycle cases the brief names, verified against the real module** (8/8):

- **App killed mid-download** → the partial lives in `<key>.tmp` and is never a
  valid asset; on the next launch `downloadAsset` deletes the stale temp before
  starting, and the result is the real `.glb`.
- **Path traversal** → a deliberately hostile url
  (`…/../../../etc/passwd/..%2f..%2fpwned.glb?x=/../../y`) still lands on
  `buddy-assets/<16 hex>.glb`. The filename comes from a hash and an extension
  matched against `glb|gltf` only, so the url provably cannot steer it.
- **Extension-less url** → safe name, `.glb` default.
- **Download finishing after the user navigated away** → still cached, no
  setState on an unmounted component (`alive` flag), work not wasted.

**Screen leave / buddy switch / background**: `BuddyAvatar`'s effect keys on
`assetUrl` and drops its result via `alive`; the download and parse continue
into the caches, so leaving and returning is free rather than restarted.

**Dead code removed:** `assetCacheKey` was exported but used only inside its own
module — made private.

**Console noise:** every log added by this work is `__DEV__`-gated. The three
ungated `console.warn`s in `BuddyAvatar` are pre-existing and intentional (real
load/texture failures that the 2D fallback would otherwise hide).

### Final validation

```
backend  tsc --noEmit  clean
backend  npm test       40 suites / 435 tests passed
mobile   tsc --noEmit  clean
mobile   eslint .       0 errors (20 pre-existing warnings)
harness  cache          16/16 · restart 10/10 · lifecycle 8/8
```

### Externally blocked — not done, not pretended

**`STT_PROVIDER=azure` needs a paid S0 Azure Speech tier.** F0 measures at
20 requests/60 s. The code and tests are complete and the switch is safe on
either tier; only the environment step remains, and it is a billing decision.
