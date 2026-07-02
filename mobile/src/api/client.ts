/**
 * Thin fetch wrapper around the SparkXP backend.
 *
 * - Base URL comes from EXPO_PUBLIC_API_URL (falls back to localhost for dev).
 *   On a real device use your machine's LAN IP, e.g. http://192.168.1.10:3000/api
 * - Attaches the Bearer token when provided.
 * - Throws an ApiError (with the backend's message) on non-2xx so screens can
 *   show it.
 */
import Constants from 'expo-constants';
import { t } from '../i18n';

// In dev, use the same host Expo is served from (your PC's LAN IP) so a real
// device can reach the backend without hardcoding an IP in .env.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (devHost ? `http://${devHost}:3000/api` : 'http://localhost:3000/api');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Backend error code, e.g. 'VOICE_LIMIT' (used for graceful fallbacks). */
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content (e.g. DELETE) has no body to parse.
  const data =
    res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    // Backend error shape: { message: string | string[], code? }
    const err = data as { message?: string | string[]; code?: string } | null;
    const raw = err?.message;
    const message = Array.isArray(raw) ? raw.join(', ') : raw ?? t('errorFallback');
    throw new ApiError(res.status, message, err?.code);
  }

  return data as T;
}

/**
 * Multipart upload (e.g. avatar image). Lets fetch set the multipart boundary —
 * we must NOT set Content-Type ourselves. `file` is an RN file descriptor.
 */
export async function apiUpload<T>(
  path: string,
  file: { uri: string; name: string; type: string },
  token: string,
): Promise<T> {
  const form = new FormData();
  // RN FormData accepts this {uri,name,type} shape for file parts.
  form.append('file', file as unknown as Blob);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data as { message?: string | string[]; code?: string } | null;
    const raw = err?.message;
    const message = Array.isArray(raw) ? raw.join(', ') : raw ?? t('errorFallback');
    throw new ApiError(res.status, message, err?.code);
  }
  return data as T;
}
