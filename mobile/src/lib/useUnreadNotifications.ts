import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { getMyNotifications } from '../api/notifications';

const LAST_SEEN_KEY = 'notifications.lastSeen';

/** Persist that the user has seen every notification up to `latestIso`. */
export async function markNotificationsSeen(latestIso: string): Promise<void> {
  await AsyncStorage.setItem(LAST_SEEN_KEY, latestIso);
}

/**
 * Client-side unread indicator for the header bell: fetches notifications on
 * focus and returns true when the newest one is later than the last time the
 * user opened the notifications screen (stored via `markNotificationsSeen`).
 * ISO timestamps compare correctly as strings. Failures are silent (no dot).
 */
export function useUnreadNotifications(): boolean {
  const { token } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!token) return;
        try {
          const list = await getMyNotifications(token);
          if (!active) return;
          if (list.length === 0) {
            setHasUnread(false);
            return;
          }
          const latest = list.reduce(
            (max, n) => (n.createdAt > max ? n.createdAt : max),
            list[0].createdAt,
          );
          const seen = await AsyncStorage.getItem(LAST_SEEN_KEY);
          if (active) setHasUnread(!seen || latest > seen);
        } catch {
          // ignore — the bell simply won't show a dot
        }
      })();
      return () => {
        active = false;
      };
    }, [token]),
  );

  return hasUnread;
}
