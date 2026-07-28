import { useEffect, useRef, useState } from 'react';
import { tf } from '../i18n';

/** Milliseconds → "2ц 14м" / "14м" / "45с". Empty once the moment has passed. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return tf('countdownHm', { h: hours, m: totalMinutes % 60 });
  if (totalMinutes > 0) return tf('countdownM', { m: totalMinutes });
  return tf('countdownS', { s: Math.ceil(ms / 1000) });
}

/**
 * Live countdown to an ISO timestamp (e.g. `HeartsState.nextHeartAt`).
 *
 * Returns '' when there is nothing to count down to — null input or the time
 * already passed — so callers can simply test the string for truthiness.
 * Ticks every second only in the last minute, where the seconds are actually
 * visible; above that a slower tick avoids ~3600 pointless re-renders an hour.
 *
 * `onExpire` fires once when the countdown reaches zero — the moment a heart
 * has actually regenerated, so the caller can refetch instead of leaving a
 * finished timer next to a stale count.
 */
export function useCountdown(iso: string | null, onExpire?: () => void): string {
  const [label, setLabel] = useState('');
  // Read through a ref so an inline arrow from the caller doesn't restart the
  // timer on every render.
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    if (!iso) {
      setLabel('');
      return;
    }
    const target = Date.parse(iso);
    let timer: ReturnType<typeof setTimeout>;
    // Only call onExpire for a countdown we actually watched run out. A
    // timestamp that is already past on arrival would otherwise fire on every
    // mount, and a refetch that returns the same stale value would loop.
    let sawFuture = false;

    const tick = () => {
      const left = target - Date.now();
      setLabel(formatCountdown(left));
      if (left > 0) {
        sawFuture = true;
        timer = setTimeout(tick, left > 60_000 ? 15_000 : 1_000);
        return;
      }
      if (sawFuture) expire.current?.();
    };

    tick();
    return () => clearTimeout(timer);
  }, [iso]);

  return label;
}
