import { useCallback, useRef } from 'react';

/**
 * Wraps a press handler so a fast double tap can only fire it once.
 *
 * Navigation is the reason this exists: `router.push` is asynchronous, so two
 * taps landing before the next screen mounts push the SAME route twice and the
 * user has to press back twice to escape. Time-based rather than
 * "disabled while navigating", because the screen that owns the button unmounts
 * before any completion callback could re-enable it.
 */
export function useOncePress<A extends unknown[]>(
  fn: (...args: A) => void,
  windowMs = 700,
): (...args: A) => void {
  const lastRef = useRef(0);

  return useCallback(
    (...args: A) => {
      const now = Date.now();
      if (now - lastRef.current < windowMs) return;
      lastRef.current = now;
      fn(...args);
    },
    [fn, windowMs],
  );
}
