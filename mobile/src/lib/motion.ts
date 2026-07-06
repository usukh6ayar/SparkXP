/**
 * Motion / "reduce motion" helper.
 *
 * When the user has turned on "Reduce Motion" (iOS/Android accessibility), we
 * must skip or shorten animations — otherwise the app can cause discomfort and
 * fails accessibility guidelines. Components read `useReduceMotion()` and, when
 * it is true, jump straight to the final state instead of animating.
 *
 * Usage:
 *   const reduce = useReduceMotion();
 *   progress.value = reduce ? pct : withTiming(pct, { duration: 400 });
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Standard entrance/fill duration (ms). One source so motion feels uniform. */
export const DURATION = { fast: 180, base: 300, slow: 500 } as const;

/** Standard spring for press / bounce feedback. */
export const SPRING = { damping: 18, stiffness: 180, mass: 0.6 } as const;

/**
 * Reactive "reduce motion" flag. Returns true when the OS accessibility setting
 * is enabled, and updates live if the user toggles it while the app is open.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
