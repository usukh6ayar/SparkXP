import { apiRequest } from './client';

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
