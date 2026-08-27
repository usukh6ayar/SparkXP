import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { registerPushToken, deletePushToken, EXPO_PUSH_TOKEN_RE } from '../api/notifications';
import { captureError } from './monitoring';

/**
 * Device-side push registration.
 *
 * The backend half has been ready for a while (`POST /notifications/token`,
 * the 20:00 UB reminder job, `users.expo_push_token`) — this is the piece that
 * was missing, so no device ever had a token and no reminder could be sent.
 *
 * **Delivery still runs through Firebase.** Expo's push service fans out to
 * FCM on Android and APNs on iOS, so a Firebase project + an FCM V1 service
 * account key uploaded to EAS is required before anything actually arrives.
 * See `docs/PUSH_SETUP.md`.
 */

/** Android needs an explicit channel or notifications arrive silently. */
const CHANNEL_ID = 'default';

/**
 * Remote push does not work in Expo Go — Expo removed it in SDK 53, and the
 * project is pinned to SDK 54 so Choi/Boju live there. Registering would throw
 * a red screen on their machines, so every entry point below no-ops instead.
 */
const inExpoGo = Constants.appOwnership === 'expo';

/**
 * How a notification behaves when it arrives while the app is OPEN. Without
 * this, foreground pushes are swallowed silently and look like a broken feature.
 * Set once at module load — it is a global handler, not per-screen state.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The EAS project this build belongs to — required by `getExpoPushTokenAsync`. */
function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * Ask for permission (once), fetch this device's Expo push token, and hand it
 * to the backend.
 *
 * Safe to call on every launch: the OS can reissue a token at any time, and
 * `POST /notifications/token` is idempotent. Returns the token, or `null` when
 * push is unavailable — which is the normal case in Expo Go, on a simulator,
 * or when the user declined.
 */
export async function registerForPush(authToken: string): Promise<string | null> {
  if (inExpoGo) return null;
  // A simulator has no push service to register with; asking throws.
  if (!Device.isDevice) return null;

  try {
    // Create the channel BEFORE requesting permission: on Android the channel's
    // importance is what decides whether the notification makes a sound, and a
    // channel created later does not retroactively apply.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'SparkXP',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#6C3BFF',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    // Only prompt when the user has not answered yet. Re-asking after a denial
    // does nothing on iOS anyway, and on Android it burns the one retry.
    const status = existing.granted
      ? existing
      : await Notifications.requestPermissionsAsync();
    if (!status.granted) return null;

    const id = projectId();
    if (!id) return null; // not an EAS build — nothing to register against

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    // The backend rejects a malformed token with 400; catching it here keeps a
    // pointless request (and a Sentry error) off the wire.
    if (!EXPO_PUSH_TOKEN_RE.test(data)) return null;

    await registerPushToken(data, authToken);
    return data;
  } catch (err) {
    // Push is a nice-to-have: never let it break login or app start.
    captureError(err, { where: 'registerForPush' });
    return null;
  }
}

/**
 * Route a notification tap to the screen it points at (`data.url`).
 *
 * Without this, tapping "Шинэ даалгавар" just opens the app wherever it was
 * last — the student is told homework arrived and then has to go hunt for it.
 *
 * Covers both entry paths: a tap while the app is already running (listener),
 * and a tap that cold-starts it (`getLastNotificationResponseAsync`, since the
 * listener is mounted too late to catch that one).
 *
 * ⚠️ Untestable in Expo Go — remote push has been unavailable there since SDK
 * 53, so this only does anything in a dev/production build.
 */
export function usePushTapRouting(enabled: boolean): void {
  const router = useRouter();

  useEffect(() => {
    // `enabled` is the logged-in check: routing a signed-out user to
    // /assignments only makes the auth gate bounce them straight to login.
    if (inExpoGo || !enabled) return;

    // Only the FIRST navigation of a session comes from the cold-start check:
    // Expo keeps returning the same "last response" on later launches, which
    // would otherwise re-open that screen every time the app starts.
    let coldStartHandled = false;

    const go = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification?.request?.content?.data?.url;
      // Only in-app hrefs — never hand an arbitrary string to the router.
      if (typeof url !== 'string' || !url.startsWith('/')) return;
      router.push(url as Href);
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (coldStartHandled) return;
        coldStartHandled = true;
        go(response);
      })
      .catch(() => {
        // A missing launch response is the normal case; nothing to report.
      });

    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      coldStartHandled = true; // a live tap supersedes the launch response
      go(r);
    });
    return () => sub.remove();
  }, [router, enabled]);
}

/**
 * Drop this device's token on logout, so the next person to use the phone does
 * not receive the previous user's reminders.
 */
export async function unregisterPush(authToken: string): Promise<void> {
  if (inExpoGo) return;
  try {
    await deletePushToken(authToken);
  } catch (err) {
    captureError(err, { where: 'unregisterPush' });
  }
}
