import { apiRequest, apiUpload } from './client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  conversationId: string;
  createdAt: string;
}

export interface ChatResponse {
  conversationId: string;
  reply: string;
  tokensUsed: { prompt: number; completion: number };
}

export function sendMessage(
  message: string,
  token: string,
  conversationId?: string,
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/ai/chat', {
    method: 'POST',
    body: { message, conversationId },
    token,
  });
}

export function getHistory(
  conversationId: string,
  token: string,
): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/ai/conversations/${conversationId}`, {
    token,
  });
}

// ── AI Buddy (voice speaking companion) ──────────────────────────────────────

export interface Buddy {
  slug: string;
  name: string;
  title: string;
  description: string;
  emoji: string;
  avatarAssetUrl: string | null;
  avatarThumbUrl: string | null;
  emotionMap: Record<string, string>;
  // Buddy-shop fields — not sent by the backend yet (AiBuddy entity has no
  // personality/motto/unlock columns as of 2026-07). BuddySelector.tsx fills
  // in sensible defaults when these are missing. Remove the fallback once
  // Usukhbayar ships them server-side.
  personalityTags?: string[];
  motto?: string | null;
  isLocked?: boolean;
  unlockCostSparks?: number | null;
  isFeatured?: boolean;
}

export interface Correction {
  original: string;
  corrected: string;
  short_explanation: string;
}

export interface BuddyUsageBlock {
  voice_seconds_used_this_month: number;
  voice_seconds_limit_this_month: number | null;
  warn_level: 'none' | 'warn80' | 'warn95';
}

export interface TurnResponse {
  session_id: string;
  message_id: string;
  user_transcript: string;
  reply_text: string;
  correction: Correction | null;
  follow_up_question: string;
  audio_url: string | null;
  avatar_instruction: { emotion: string; gesture: string; duration_ms: number };
  usage: BuddyUsageBlock;
}

export interface SessionStart {
  sessionId: string;
  buddy: Buddy;
  usage: BuddyUsageBlock;
}

export function getBuddies(token: string): Promise<Buddy[]> {
  return apiRequest<Buddy[]>('/ai/buddies', { token });
}

/**
 * Is the AI Buddy feature open right now?
 *
 * The server owns this (`AI_BUDDY_ENABLED`), because a buddy turn bills
 * ElevenLabs and Anthropic per call while payments are switched off — see
 * `backend/src/ai-gateway/guards/ai-buddy-enabled.guard.ts`. Asking the server
 * rather than hard-coding it here is what lets the feature be opened later
 * **without an app update or a store review**.
 *
 * **Fails closed.** Any error — offline, a 404 from an older backend, a 5xx —
 * resolves to `false`, so the app shows "Тун удахгүй" instead of a buddy tab
 * that would 503 on the first thing the user says. Matching the guard's own
 * fail-closed rule; the two must never disagree in the open direction.
 */
export async function getBuddyAvailability(token: string): Promise<boolean> {
  try {
    const res = await apiRequest<{ enabled: boolean }>(
      '/ai/buddy/availability',
      { token },
    );
    return res?.enabled === true;
  } catch {
    return false;
  }
}

export function startBuddySession(
  buddySlug: string,
  token: string,
  opts?: { mode?: 'voice' | 'text'; topic?: string },
): Promise<SessionStart> {
  return apiRequest<SessionStart>('/ai/buddy/sessions', {
    method: 'POST',
    body: { buddySlug, mode: opts?.mode, topic: opts?.topic },
    token,
  });
}

/** End a session and get its length. Idempotent (safe to call more than once). */
export function endBuddySession(
  sessionId: string,
  token: string,
): Promise<{ sessionId: string; durationSeconds: number; endedAt: string }> {
  return apiRequest(`/ai/buddy/sessions/${sessionId}/end`, { method: 'POST', token });
}

/** AI Buddy practice stats (session counts + minutes, today + all-time). */
export interface BuddyStatistics {
  totalSessions: number;
  totalMinutes: number;
  todaySessions: number;
  todayMinutes: number;
  longestSessionMinutes: number;
}

export function getBuddyStatistics(token: string): Promise<BuddyStatistics> {
  return apiRequest<BuddyStatistics>('/ai/buddy/statistics', { token });
}

/** A stored message flattened for the chat UI (from resumeBuddyTextSession). */
export interface BuddyHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  correction: Correction | null;
  followUp: string | null;
  audioUrl: string | null;
}

export interface BuddyTextSession {
  sessionId: string;
  messages: BuddyHistoryMessage[];
}

/** One past typed-chat thread, for the ChatGPT-style history panel. */
export interface BuddyTextSessionSummary {
  sessionId: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

/**
 * Open a typed-chat thread for a buddy and load its history — ChatGPT-style,
 * carrying across app launches. `opts` picks which thread: `sessionId` (a
 * specific past thread), `fresh: true` (a new "New chat"), or default (most
 * recent). Separate from the ephemeral voice session.
 */
export function resumeBuddyTextSession(
  buddySlug: string,
  token: string,
  opts?: { sessionId?: string; fresh?: boolean },
): Promise<BuddyTextSession> {
  return apiRequest<BuddyTextSession>('/ai/buddy/text-session', {
    method: 'POST',
    body: { buddySlug, sessionId: opts?.sessionId, new: opts?.fresh },
    token,
  });
}

/** List the user's past typed-chat threads with a buddy (history panel). */
export function listBuddyTextSessions(
  buddySlug: string,
  token: string,
): Promise<BuddyTextSessionSummary[]> {
  return apiRequest<BuddyTextSessionSummary[]>(
    `/ai/buddy/text-sessions?buddySlug=${encodeURIComponent(buddySlug)}`,
    { token },
  );
}

/** Delete a past typed-chat thread from history. Backend: DELETE /ai/buddy/text-session/:id. */
export function deleteBuddyTextSession(
  sessionId: string,
  token: string,
): Promise<void> {
  return apiRequest<void>(
    `/ai/buddy/text-session/${encodeURIComponent(sessionId)}`,
    { method: 'DELETE', token },
  );
}

export function sendBuddyTextTurn(
  sessionId: string,
  text: string,
  token: string,
): Promise<TurnResponse> {
  return apiRequest<TurnResponse>(`/ai/buddy/sessions/${sessionId}/turn/text`, {
    method: 'POST',
    body: { text },
    token,
  });
}

export function sendBuddyAudioTurn(
  sessionId: string,
  fileUri: string,
  token: string,
): Promise<TurnResponse> {
  return apiUpload<TurnResponse>(
    `/ai/buddy/sessions/${sessionId}/turn/audio`,
    { uri: fileUri, name: 'turn.m4a', type: 'audio/m4a' },
    token,
  );
}

export function getBuddyUsage(
  token: string,
): Promise<{ voice: BuddyUsageBlock; stt: BuddyUsageBlock }> {
  return apiRequest(`/ai/buddy/usage`, { token });
}

export interface BuddyMemory {
  id: string;
  memoryType: string;
  value: string;
  createdAt: string;
}

export function getBuddyMemory(token: string): Promise<BuddyMemory[]> {
  return apiRequest<BuddyMemory[]>('/ai/buddy/memory', { token });
}

export function clearBuddyMemory(token: string): Promise<void> {
  return apiRequest('/ai/buddy/memory', { method: 'DELETE', token });
}
