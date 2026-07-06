import { useEffect, useRef, useState } from 'react';
import { AppText } from './Text';
import type { TextProps } from 'react-native';
import { useReduceMotion, DURATION } from '../lib/motion';

type Variant = React.ComponentProps<typeof AppText>['variant'];

interface Props extends TextProps {
  /** Final number to count up to. */
  value: number;
  /** Text role (size/weight) — same variants as AppText. */
  variant?: Variant;
  color?: string;
  /** Optional text before/after the number (e.g. '+', ' XP'). */
  prefix?: string;
  suffix?: string;
  /** Animation length (ms). */
  duration?: number;
}

/**
 * A number that animates from 0 up to `value` when it first appears — the
 * "count-up" premium touch for XP / streak / score / level stats. Uses a plain
 * timer (no reanimated text binding) so it stays junior-readable, and respects
 * Reduce Motion by jumping straight to the final value.
 *
 * Usage:
 *   <CountUp value={result.xpEarned} prefix="+" suffix=" XP" variant="h1" />
 */
export function CountUp({
  value,
  variant = 'h1',
  color,
  prefix = '',
  suffix = '',
  duration = DURATION.slow,
  ...rest
}: Props) {
  const [display, setDisplay] = useState(0);
  const reduce = useReduceMotion();
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (reduce || value <= 0) {
      setDisplay(value);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      // Ease-out so the number decelerates as it lands (feels less mechanical).
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, reduce]);

  return (
    <AppText variant={variant} color={color} {...rest}>
      {prefix}{display}{suffix}
    </AppText>
  );
}
