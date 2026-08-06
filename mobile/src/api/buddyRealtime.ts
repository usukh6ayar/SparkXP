/**
 * Realtime (streaming) AI Buddy client — a thin layer over the backend SSE
 * endpoints that ALWAYS degrades to the existing request-response turn calls.
 *
 * `sendBuddyTextTurnSmart` / `sendBuddyAudioTurnSmart` are drop-in replacements
 * for `sendBuddyTextTurn` / `sendBuddyAudioTurn`: same arguments, same
 * `TurnResponse` result. They try the realtime path only when it is both
 * enabled locally (`BUDDY_REALTIME_ENABLED`) and reported by the server probe;
 * on the current Expo Go target the local flag is off, so they call the plain
 * endpoints unchanged. Any failure at any step also falls back — the classic
 * flow is never bypassed, only wrapped.
 */
import { apiRequest, apiUpload, BASE_URL } from './client';
import { BUDDY_REALTIME_ENABLED } from '../lib/buddyRealtimeFlag';
import { sendBuddyTextTurn, sendBuddyAudioTurn, type TurnResponse } from './ai';

export interface RealtimeCapabilities {
  enabled: boolean;
  transport: string;
  streamingText: boolean;
  streamingTts: string;
  partialTranscript: boolean;
  interrupt: boolean;
  fallback: string;
}

/** Optional hooks for a live reveal while a turn streams in. */
export interface RealtimeHandlers {
  onTranscript?: (text: string) => void;
  /** One reply sentence at a time. */
  onChunk?: (text: string) => void;
  onAudio?: (url: string) => void;
}

interface RtEvent {
  type: string;
  [key: string]: unknown;
}

/** GET /ai/buddy/rt/capabilities — probe streaming support. */
export function getBuddyRealtimeCapabilities(token: string): Promise<RealtimeCapabilities> {
  return apiRequest<RealtimeCapabilities>('/ai/buddy/rt/capabilities', { token });
}

// The probe is stable for a session, so remember it (and never let it throw).
let capsProbe: Promise<boolean> | null = null;
function realtimeUsable(token: string): Promise<boolean> {
  if (!BUDDY_REALTIME_ENABLED) return Promise.resolve(false);
  if (!capsProbe) {
    capsProbe = getBuddyRealtimeCapabilities(token)
      .then((c) => c.enabled === true)
      .catch(() => false);
  }
  return capsProbe;
}

function startTextTurn(sessionId: string, text: string, token: string): Promise<{ streamId: string }> {
  return apiRequest<{ streamId: string }>('/ai/buddy/rt/turn/text', {
    method: 'POST',
    body: { sessionId, text },
    token,
  });
}

function startAudioTurn(sessionId: string, fileUri: string, token: string): Promise<{ streamId: string }> {
  return apiUpload<{ streamId: string }>(
    `/ai/buddy/rt/turn/audio/${sessionId}`,
    { uri: fileUri, name: 'turn.m4a', type: 'audio/m4a' },
    token,
  );
}

/** POST interrupt — stop the remaining stream (best-effort; errors ignored). */
export function interruptBuddyTurn(streamId: string, token: string): Promise<void> {
  return apiRequest<{ ok: true }>(`/ai/buddy/rt/interrupt/${streamId}`, {
    method: 'POST',
    token,
  })
    .then(() => undefined)
    .catch(() => undefined);
}

/** Parse an SSE body into its `data:` JSON events. */
function parseSse(body: string): RtEvent[] {
  const events: RtEvent[] = [];
  for (const block of body.split('\n\n')) {
    const line = block.split('\n').find((l) => l.startsWith('data:'));
    if (!line) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()) as RtEvent);
    } catch {
      // ignore a partial/non-JSON frame
    }
  }
  return events;
}

/**
 * Consume a started stream to completion and return its final turn.
 *
 * NOTE: React Native `fetch` has no incremental body reader in Expo Go, so this
 * reads the whole SSE response once the server closes it, then replays the
 * events (still in order) through `handlers`. A native build with a streaming
 * HTTP client can make this genuinely progressive without changing callers.
 */
async function consumeStream(
  streamId: string,
  token: string,
  handlers?: RealtimeHandlers,
): Promise<TurnResponse> {
  const res = await fetch(`${BASE_URL}/ai/buddy/rt/stream/${streamId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
  });
  if (!res.ok) throw new Error(`rt stream ${res.status}`);

  let turn: TurnResponse | null = null;
  for (const ev of parseSse(await res.text())) {
    switch (ev.type) {
      case 'transcript':
        handlers?.onTranscript?.(String(ev.text ?? ''));
        break;
      case 'chunk':
        handlers?.onChunk?.(String(ev.text ?? ''));
        break;
      case 'audio':
        handlers?.onAudio?.(String(ev.url ?? ''));
        break;
      case 'done':
        turn = ev.turn as TurnResponse;
        break;
      case 'error':
      case 'interrupted':
        throw new Error(ev.type);
    }
  }
  if (!turn) throw new Error('rt no turn');
  return turn;
}

/** Text turn with realtime streaming when available, else the plain endpoint. */
export async function sendBuddyTextTurnSmart(
  sessionId: string,
  text: string,
  token: string,
  handlers?: RealtimeHandlers,
): Promise<TurnResponse> {
  if (await realtimeUsable(token)) {
    try {
      const { streamId } = await startTextTurn(sessionId, text, token);
      return await consumeStream(streamId, token, handlers);
    } catch {
      // fall through to the classic endpoint
    }
  }
  return sendBuddyTextTurn(sessionId, text, token);
}

/** Voice turn with realtime streaming when available, else the plain endpoint. */
export async function sendBuddyAudioTurnSmart(
  sessionId: string,
  fileUri: string,
  token: string,
  handlers?: RealtimeHandlers,
): Promise<TurnResponse> {
  if (await realtimeUsable(token)) {
    try {
      const { streamId } = await startAudioTurn(sessionId, fileUri, token);
      return await consumeStream(streamId, token, handlers);
    } catch {
      // fall through to the classic endpoint
    }
  }
  return sendBuddyAudioTurn(sessionId, fileUri, token);
}
