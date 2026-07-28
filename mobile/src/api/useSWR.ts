import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { cacheReady, getCached } from './client';

interface Options {
  /** Skip fetching (e.g. no auth token yet). Default true. */
  enabled?: boolean;
}

/**
 * Stale-while-revalidate for a GET resource.
 *
 * Paints the last cached value **instantly** (no skeleton flash when returning
 * to a screen), then revalidates in the background on focus and updates. The
 * request layer (`client.ts`) already dedups concurrent identical GETs.
 *
 * `path` MUST be the exact GET path the `fetcher` hits — that's the cache key
 * (`apiRequest` stores GETs under `GET <path>`). The `fetcher` identity does not
 * need to be stable (it's read through a ref), so callers can pass an inline
 * arrow like `() => getStats(token)`.
 */
export function useSWR<T>(
  path: string,
  fetcher: () => Promise<T>,
  { enabled = true }: Options = {},
) {
  const [data, setData] = useState<T | undefined>(() => getCached<T>(path));
  const [loading, setLoading] = useState(data === undefined);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    if (!enabled) return;
    // Only surface a spinner when there's nothing cached to show yet.
    if (getCached<T>(path) === undefined) setLoading(true);
    try {
      setData(await fetcherRef.current());
    } catch {
      // Keep the last-good `data` on failure (no unhandled rejection). Callers
      // detect the error via `data === undefined` and render their own retry.
    } finally {
      setLoading(false);
    }
  }, [path, enabled]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // On a cold start the disk cache may still be loading when this screen first
  // renders, so the instant paint above finds nothing. Repaint once hydration
  // lands — but only if the network hasn't already answered with fresher data.
  useEffect(() => {
    let active = true;
    void cacheReady.then(() => {
      if (!active) return;
      setData((current) => (current === undefined ? getCached<T>(path) : current));
    });
    return () => { active = false; };
  }, [path]);

  return { data, loading, refetch };
}
