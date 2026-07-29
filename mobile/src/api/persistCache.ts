import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Disk backing for the in-memory GET cache in `client.ts`.
 *
 * Without it the cache dies with the process, so every cold start shows empty
 * screens until the network answers — which on an unstable Mongolian
 * connection can be "never". Persisting it means the app opens showing the last
 * good data, then revalidates.
 *
 * Deliberately bounded: a learning app pulls down lesson lists and passages,
 * and an unbounded write-everything cache would grow without limit and slow
 * every start.
 */
const STORAGE_KEY = 'apiCache.v1';

/** Older than this and the data is more misleading than helpful. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Newest-first cap, so a long session can't grow the file forever. */
const MAX_ENTRIES = 60;

/** Skip single responses this large — one huge list would dominate the file. */
const MAX_ENTRY_CHARS = 256 * 1024;

export interface CacheEntry {
  /** Epoch ms the value was stored. */
  t: number;
  v: unknown;
}

/** Debounce handle — many GETs land together on a screen load. */
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Read the persisted cache. Returns an empty map on any problem (missing,
 * corrupt, unparseable) — a cold cache is always a safe fallback.
 */
export async function loadPersistedCache(): Promise<Map<string, CacheEntry>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();

    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const fresh = new Map<string, CacheEntry>();
    const cutoff = Date.now() - MAX_AGE_MS;

    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.t === 'number' && entry.t > cutoff) {
        fresh.set(key, entry);
      }
    }
    return fresh;
  } catch {
    return new Map();
  }
}

/**
 * Write the cache to disk, debounced so a screen firing six GETs writes once.
 * Fire-and-forget: a failed cache write must never surface to the user.
 */
export function schedulePersist(cache: Map<string, CacheEntry>): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void writeNow(cache);
  }, 1500);
}

async function writeNow(cache: Map<string, CacheEntry>): Promise<void> {
  try {
    // Newest first, then trim — the most recently used screens are the ones
    // worth having on the next cold start.
    const entries = [...cache.entries()]
      .sort((a, b) => b[1].t - a[1].t)
      .slice(0, MAX_ENTRIES);

    const out: Record<string, CacheEntry> = {};
    for (const [key, entry] of entries) {
      const serialized = JSON.stringify(entry.v);
      // `undefined` (unserializable) or oversized → skip, keep the rest.
      if (!serialized || serialized.length > MAX_ENTRY_CHARS) continue;
      out[key] = entry;
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    // Disk full / quota — the in-memory cache still works.
  }
}

/**
 * Drop the persisted copy. Called whenever the session changes, so one
 * student's cached reads can never appear in another's app.
 */
export async function clearPersistedCache(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do — the in-memory cache was already cleared.
  }
}
