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
