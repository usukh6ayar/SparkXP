import { requestRecordingPermissionsAsync } from 'expo-audio';

/**
 * Microphone permission, asked once per app run.
 *
 * The buddy's mic is press-and-hold, so everything between the finger landing
 * and the recorder actually capturing is speech the student loses. Asking the
 * system on **every** press puts a native round trip in that window for a
 * question whose answer cannot change while the app is running: on both iOS and
 * Android, changing an app's microphone permission from Settings restarts the
 * process — so a cached "granted" can never go stale under us.
 *
 * Only `granted` is remembered. A refusal is asked again, because the student
 * may have tapped "Don't allow" by accident and the next press should still be
 * able to offer them the choice.
 */
let granted = false;

export async function ensureMicPermission(): Promise<boolean> {
  if (granted) return true;
  const res = await requestRecordingPermissionsAsync();
  granted = res.granted;
  return res.granted;
}

/**
 * Ask ahead of time, so the first press is not the thing that raises the system
 * dialog. Fire-and-forget: the real check still runs on the press, this only
 * moves the cost (and the modal) off the critical path.
 */
export function warmMicPermission(): void {
  void ensureMicPermission().catch(() => undefined);
}
