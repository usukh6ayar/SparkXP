import { ApiError } from '../api/client';

/**
 * Сервер/сүлжээний алдааг **админд ойлгомжтой монгол** мессеж болгоно.
 *
 * AI-тай ажиллах үед алдаа нь ихэвчлэн 3 шалтгаантай (rate limit · timeout ·
 * түлхүүр дутуу) бөгөөд түүхий "HTTP 429" гэсэн бичиг админд юу хийхийг
 * хэлж өгдөггүй. Энд түүнийг "юу болсон + одоо яах вэ" болгож хөрвүүлнэ.
 */
export function friendlyError(e: unknown, fallback = 'Алдаа гарлаа'): string {
  const raw = e instanceof Error ? e.message : '';
  const status = e instanceof ApiError ? e.status : 0;

  if (status === 401 || status === 403) return 'Эрх дууссан байна. Дахин нэвтэрнэ үү.';
  if (status === 429 || /rate.?limit|quota|too many/i.test(raw))
    return 'AI-ийн хязгаарт хүрлээ. 1 минут хүлээгээд дахин оролдоно уу.';
  if (/timeout|timed out|aborted/i.test(raw))
    return 'AI хэт удаж хариу өгсөнгүй. Асуултын тоог багасгаад дахин оролдоно уу.';
  if (/failed to fetch|networkerror|load failed/i.test(raw))
    return 'Сервертэй холбогдож чадсангүй. Интернэт/серверээ шалгаад дахин оролдоно уу.';
  if (/api.?key|GEMINI|OPENAI|ELEVEN/i.test(raw))
    return `AI тохиргоо дутуу байна (API түлхүүр). Серверийн админд хандана уу. — ${raw}`;
  if (status >= 500) return `Серверийн алдаа. Дахин оролдоно уу. — ${raw}`;

  return raw || fallback;
}
