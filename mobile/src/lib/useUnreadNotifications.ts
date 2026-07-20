import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { getMyNotifications } from '../api/notifications';
import { DEV_MOCK_NOTIFICATIONS, notifStore } from './notificationCenter';

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

        let real: import('../api/notifications').AppNotification[] = [];
        try {
          real = await getMyNotifications(token);
        } catch {
          real = []; // API unreachable — fall through to the dev preview below
        }
        if (!active) return;

        if (real.length > 0) {
          // Real broadcasts: timestamp "seen" model (backend has no per-id read).
          const latest = real.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), real[0].createdAt);
          const seen = await AsyncStorage.getItem(LAST_SEEN_KEY);
          if (active) setHasUnread(!seen || latest > seen);
          return;
        }

        // DEV: derive the dot from the local read/dismissed sets, exactly like
        // the notifications screen — so it stays visible until the user marks
        // things read and clears reliably afterwards.
        if (DEV_MOCK_NOTIFICATIONS.length > 0) {
          const [read, dismissed] = await Promise.all([notifStore.loadRead(), notifStore.loadDismissed()]);
          if (active) {
            setHasUnread(DEV_MOCK_NOTIFICATIONS.some((n) => !read.has(n.id) && !dismissed.has(n.id)));
          }
        } else if (active) {
          setHasUnread(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [token]),
  );

  return hasUnread;
}
