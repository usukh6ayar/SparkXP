import { requestRecordingPermissionsAsync } from 'expo-audio';

/**
 * Microphone permission, asked once per app run.
 *
 * Asking the system on **every** tap puts a native round trip in front of the
 * recorder for a question whose answer cannot change while the app is running:
 * on both iOS and Android, changing an app's microphone permission from
 * Settings restarts the process — so a cached "granted" can never go stale.
 *
 * Only `granted` is remembered. A refusal is asked again, because the student
 * may have tapped "Don't allow" by accident and the next tap should still be
 * able to offer them the choice.
 */
let granted = false;

/**
 * The request currently showing, if any.
 *
 * Two callers genuinely arrive at once: `warmMicPermission()` fires the moment
 * the buddy screen opens, and the student can tap the mic a second later, while
 * the system dialog from the first call is still up. iOS does not queue a
 * second permission request behind a visible one — it rejects it — and that
 * rejection surfaced as "Couldn't start recording" on the very first tap of
 * every fresh install. Sharing the in-flight promise makes the tap WAIT for the
 * dialog the student is already looking at, and then act on their answer.
 */
let inFlight: Promise<boolean> | null = null;

export async function ensureMicPermission(): Promise<boolean> {
  if (granted) return true;
  if (!inFlight) {
    inFlight = requestRecordingPermissionsAsync()
      .then((res) => {
        granted = res.granted;
        return res.granted;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Ask ahead of time, so the first tap is not the thing that raises the system
 * dialog. Fire-and-forget: the real check still runs on the tap, this only
 * moves the cost (and the modal) off the critical path — and because both go
 * through `ensureMicPermission`, the tap joins this request rather than racing
 * a second one against it.
 */
export function warmMicPermission(): void {
  void ensureMicPermission().catch(() => undefined);
}
