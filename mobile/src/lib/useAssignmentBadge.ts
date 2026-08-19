import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { getMyAssignments } from '../api/assignments';
import { isRecent } from './timeAgo';

const LAST_SEEN_KEY = 'assignments.lastSeen';

/** Persist that the student has seen every assignment up to `latestIso`. */
export async function markAssignmentsSeen(latestIso: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SEEN_KEY, latestIso);
}

/** When the student last opened the assignments list (ISO), or null. */
export function getAssignmentsLastSeen(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SEEN_KEY);
}

export interface AssignmentBadge {
  /** Still to do — the number worth putting on the Home card. */
  pending: number;
  /** Something arrived since the list was last opened. */
  hasNew: boolean;
}

/**
 * Badge state for the Home "Миний даалгавар" card.
 *
 * Without this the card is a static row, so a student who does not open it has
 * no way of knowing homework arrived — the push is the only signal, and pushes
 * get swiped away or never granted permission at all.
 *
 * "New" is measured against the last time the list was opened rather than a
 * fixed 24h window: a student who already looked should not keep being told the
 * same task is new. ISO timestamps compare correctly as strings.
 *
 * Failures are silent (no badge) — a wrong count is worse than none.
 */
export function useAssignmentBadge(enabled = true): AssignmentBadge {
  const { token } = useAuth();
  const [badge, setBadge] = useState<AssignmentBadge>({ pending: 0, hasNew: false });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!token || !enabled) return;
        try {
          const list = await getMyAssignments(token);
          if (!active) return;

          // `assigned` is the only not-yet-handed-in state; completed/late are done.
          const pending = list.filter((a) => (a.status ?? 'assigned') === 'assigned').length;

          const seen = await AsyncStorage.getItem(LAST_SEEN_KEY);
          // First launch has no mark to compare against — fall back to
          // "arrived in the last 24h" so the dot is not on from day one.
          const hasNew = list.some((a) =>
            seen ? a.createdAt > seen : isRecent(a.createdAt),
          );
          if (active) setBadge({ pending, hasNew });
        } catch {
          if (active) setBadge({ pending: 0, hasNew: false });
        }
      })();
      return () => {
        active = false;
      };
    }, [token, enabled]),
  );

  return badge;
}
