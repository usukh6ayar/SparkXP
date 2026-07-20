/**
 * A tiny AsyncStorage-backed set of "completed" ids, namespaced by key.
 *
 * The backend awards XP on completion but the content list endpoints don't
 * return a per-item done flag, so we mirror completion locally to drive the
 * progress rings + checkmarks on the browse screens (Reading, skill exercises).
 * Purely presentational — the server stays the source of truth for XP.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export function makeCompletionStore(key: string) {
  return {
    /** Ids the user has completed. */
    async load(): Promise<Set<string>> {
      try {
        const raw = await AsyncStorage.getItem(key);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        return new Set();
      }
    },
    /** Record an id as completed (idempotent). */
    async mark(id: string): Promise<void> {
      try {
        const raw = await AsyncStorage.getItem(key);
        const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
        if (set.has(id)) return;
        set.add(id);
        await AsyncStorage.setItem(key, JSON.stringify([...set]));
      } catch {
        // best-effort; a lost checkmark is non-critical
      }
    },
  };
}
