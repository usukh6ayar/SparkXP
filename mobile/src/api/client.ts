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
import {
  clearPersistedCache,
  loadPersistedCache,
  schedulePersist,
  type CacheEntry,
} from './persistCache';

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

// ── Request dedup + stale-while-revalidate cache (GET only) ──────────────────
// Screens refetch on every focus (useFocusEffect). `inflight` collapses
// concurrent identical GETs into one network call; `cache` keeps the last
// successful GET so useSWR can paint instantly then revalidate. Mutations and
// logout wipe the cache so gamification data (XP/streak) never goes stale.
const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, CacheEntry>();

const keyOf = (method: string, path: string) => `${method} ${path}`;

// The cache is also written to disk (see persistCache.ts) so a cold start shows
// the last good data instead of empty screens — the normal case on an unstable
// connection. Hydration starts on import and finishes long before the user can
// act; `cacheReady` lets callers (useSWR) repaint once it lands.
export const cacheReady: Promise<void> = loadPersistedCache()
  .then((stored) => {
    // Anything fetched during hydration is newer than the disk copy, so live
    // entries win.
    for (const [key, entry] of stored) {
      if (!cache.has(key)) cache.set(key, entry);
    }
  })
  .catch(() => {});

/** Last cached value for a GET path — used by useSWR for the instant paint. */
export function getCached<T>(path: string): T | undefined {
  return cache.get(keyOf('GET', path))?.v as T | undefined;
}

/**
 * Wipe the GET cache, on disk too. Call whenever the session changes (login and
 * logout) so one user's cached reads can never show up in another's app.
 */
export function clearApiCache(): void {
  cache.clear();
  void clearPersistedCache();
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const isGet = method === 'GET';
  const key = keyOf(method, path);

  // Dedup: a concurrent identical GET reuses the in-flight promise.
  if (isGet && inflight.has(key)) return inflight.get(key) as Promise<T>;

  const run = (async (): Promise<T> => {
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
  })();

  if (isGet) {
    inflight.set(key, run);
    // Side-effects on a detached chain so the caller still gets clean error
    // propagation (and we don't create an unhandled rejection here).
    void run.then(
      (v) => {
        cache.set(key, { t: Date.now(), v });
        schedulePersist(cache); // debounced — a screen's six GETs write once
      },
      () => {},
    ).finally(() => inflight.delete(key));
  } else {
    // A successful write can change any read (XP, streak, lists) → drop the
    // GET cache so the next reads are fresh.
    void run.then(() => clearApiCache(), () => {});
  }

  return run;
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
  // Upload is a mutation (e.g. new avatar) → drop cached reads.
  clearApiCache();
  return data as T;
}
