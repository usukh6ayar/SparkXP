import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { t } from '../i18n';
import { alertError } from './alerts';
import { haptics } from './haptics';

/**
 * The message to show for a failed backend call.
 *
 * A thrown `ApiError` already carries the backend's Mongolian wording, which is
 * always more specific than anything the screen could invent ("Sparks
 * хүрэлцэхгүй байна" beats "Алдаа гарлаа"). Anything else — a dropped
 * connection, a parse error — has no user-facing text, so it falls back.
 */
export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : t('errorGeneric');
}

interface Options<T> {
  /** Runs after the call resolves (navigate, close the sheet, apply the result). */
  onSuccess?: (result: T) => void;
  /**
   * Show the failure somewhere other than the default alert — pass
   * `setError` to put it in a `<FormError>` under the field, for example.
   * Receives the ready-made message plus the raw error for special cases
   * (`e instanceof ApiError && e.status === 409` → "that handle is taken").
   */
  onError?: (message: string, error: unknown) => void;
  /** success/error buzz on finish. Default on — pass `false` for silent saves. */
  haptic?: boolean;
}

/**
 * Runs one backend call and owns everything that surrounds it: the busy flag,
 * the double-tap guard, the haptic, and turning a thrown error into a message.
 *
 * Every action button in the app used to hand-roll the same twelve lines
 * (`setBusy(true)` → `try` → `haptics.success()` → `catch` → `alertError(e
 * instanceof ApiError ? …)` → `finally setBusy(false)`), which is how they
 * drifted apart — some buzzed, some didn't; some guarded a double tap, some
 * fired the request twice. Prefer `<ActionButton>` when a button triggers the
 * call; reach for this hook directly when the trigger is not a button (a QR
 * scan, a row swipe, an image picker).
 *
 *   const { busy, run } = useAsyncAction(() => buyStreakFreeze(token), {
 *     onSuccess: onBought,
 *   });
 */
export function useAsyncAction<A extends unknown[], T>(
  action: (...args: A) => Promise<T>,
  opts: Options<T> = {},
) {
  const [busy, setBusy] = useState(false);
  // `busy` state lands a render too late to stop a fast double tap, so the
  // guard reads a ref that is set synchronously.
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  // Latest callbacks without rebuilding `run` on every render — screens pass
  // inline arrow functions, so a dependency array here would defeat useCallback.
  const latest = useRef({ action, opts });
  latest.current = { action, opts };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A) => {
    if (busyRef.current) return;
    const { action: fn, opts: o } = latest.current;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await fn(...args);
      if (o.haptic !== false) haptics.success();
      o.onSuccess?.(result);
    } catch (e) {
      if (o.haptic !== false) haptics.error();
      const message = errorMessage(e);
      if (o.onError) o.onError(message, e);
      else alertError(message);
    } finally {
      busyRef.current = false;
      // A successful action often navigates away or closes its sheet, so this
      // component may already be gone — setting state then is a no-op warning.
      if (aliveRef.current) setBusy(false);
    }
  }, []);

  return { busy, run };
}
