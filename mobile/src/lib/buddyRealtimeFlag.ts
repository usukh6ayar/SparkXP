/**
 * Realtime (streaming) AI Buddy — OFF by default.
 *
 * The backend ships a real SSE streaming layer over the existing turn pipeline
 * (progressive transcript + reply + audio + interrupt). Consuming a live stream
 * needs incremental HTTP reads, which React Native's `fetch` does NOT provide in
 * Expo Go (no `ReadableStream` body / no `EventSource`) — so on the current
 * SDK-54 Expo Go target the client always falls back to the plain request-
 * response turn endpoints. Live-mic partial transcript is likewise unavailable
 * (expo-audio records to a file; there is no PCM frame stream in Expo Go).
 *
 * Flip this to `true` in a dev/native build that ships a streaming HTTP client,
 * and `sendBuddyTurnSmart` will use the realtime path when the server's
 * `/ai/buddy/rt/capabilities` probe also reports it enabled. Either gate failing
 * — flag off, probe off, or any stream error — falls back automatically, so the
 * existing buddy keeps working untouched.
 */
export const BUDDY_REALTIME_ENABLED = false;
