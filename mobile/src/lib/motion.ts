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
import { FadeInDown, FadeInUp, withSequence, withTiming } from 'react-native-reanimated';

/** Standard entrance/fill duration (ms). One source so motion feels uniform. */
export const DURATION = { fast: 180, base: 300, slow: 500 } as const;

/**
 * Standard spring for press / scale feedback.
 *
 * **Damping is set for ~1.0 (critical), so nothing overshoots.** The ratio is
 * `damping / (2 · √(stiffness · mass))` = `22 / (2 · √(180 · 0.6))` ≈ 1.06.
 * It used to be 18 (≈0.87), which is what made every pressed card, ring and
 * counter in the app wobble past its resting place before settling.
 *
 * ⚠️ If you ever lower this, you are re-introducing bounce app-wide. Don't.
 */
export const SPRING = { damping: 22, stiffness: 180, mass: 0.6 } as const;

/**
 * How far an entering element travels, in px.
 *
 * Reanimated's `FadeInDown` ships with **25px** and, combined with
 * `.springify()`, that read as the whole app lurching up and down on every
 * screen — Choi (2026-08-05): "хаана ч байсан апп дотор ингэж их савлаж байгаа
 * эффектийг бүр мөсөн хасаж, бүр маш бага хэмжээний л савлуул."
 *
 * 6px is enough to say "this arrived" without anything appearing to move.
 */
export const ENTER_SHIFT = 6;

/**
 * **The app's one entrance animation.** A 6px rise with a plain fade — no
 * spring, so nothing can overshoot.
 *
 * Use this instead of `FadeInDown` / `FadeInUp` / `.springify()` at call sites,
 * so the amount of motion in SparkXP stays tunable from this one file.
 *
 *   <Animated.View entering={enter()}>            // plain
 *   <Animated.View entering={enter(i * 40)}>      // staggered list
 */
export function enter(delay = 0, duration: number = DURATION.base) {
  return FadeInDown.delay(delay)
    .duration(duration)
    .withInitialValues({ opacity: 0, transform: [{ translateY: ENTER_SHIFT }] });
}

/** `enter()` mirrored: starts 6px ABOVE and settles down. For toasts and
 *  anything else anchored to the top of the screen. */
export function enterUp(delay = 0, duration: number = DURATION.base) {
  return FadeInUp.delay(delay)
    .duration(duration)
    .withInitialValues({ opacity: 0, transform: [{ translateY: -ENTER_SHIFT }] });
}

/**
 * A left-right "shake" animation for invalid form input. Assign it to a
 * translateX shared value: `offset.value = shake()`. Pair with `haptics.error()`.
 */
export function shake() {
  return withSequence(
    withTiming(-8, { duration: 45 }),
    withTiming(8, { duration: 45 }),
    withTiming(-6, { duration: 45 }),
    withTiming(6, { duration: 45 }),
    withTiming(0, { duration: 45 }),
  );
}

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
