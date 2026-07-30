import { useEffect, useId } from 'react';
import { type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '../settings/SettingsContext';
import { DURATION, SPRING, useReduceMotion } from '../lib/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress ring — the premium alternative to a linear bar for
 * level/XP progress. The arc eases to its value with `withTiming` and children
 * (e.g. an avatar or a level number) sit in the middle. Respects Reduce Motion.
 *
 * Usage:
 *   <ProgressRing progress={0.6} size={108}><Avatar/></ProgressRing>
 */
export function ProgressRing({
  progress,
  size = 108,
  stroke = 5,
  color,
  gradient,
  track,
  children,
  style,
}: {
  /** 0–1. Clamped. */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  /** Two stops for the arc (e.g. `colors.primaryGradient`). Beats a flat ring. */
  gradient?: readonly string[];
  track?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const c = useColors();
  const reduce = useReduceMotion();
  const pct = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const stops = gradient && gradient.length >= 2 ? gradient : null;
  // SVG gradient ids are document-global: two rings on one screen sharing an id
  // would make the second inherit the first's colours.
  // React's useId() yields ":r0:"-style values. Colons are not safe inside an
  // SVG `url(#...)` reference, so strip them — otherwise the arc silently
  // falls back to no stroke on some renderers.
  const gradientId = `pr${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const fill = useSharedValue(pct);
  useEffect(() => {
    fill.value = reduce ? pct : withTiming(pct, { duration: DURATION.slow });
  }, [pct, reduce]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  // A single celebratory pop the moment the goal is reached. Fires on the
  // 0→1 crossing only, so a ring that loads already-complete stays still
  // rather than bouncing on every screen entry.
  const pop = useSharedValue(1);
  const wasDone = useSharedValue(pct >= 1);
  useEffect(() => {
    const done = pct >= 1;
    if (done && !wasDone.value && !reduce) {
      pop.value = withSequence(
        withSpring(1.08, { ...SPRING, damping: 8 }),
        withSpring(1, SPRING),
      );
    }
    wasDone.value = done;
  }, [pct, reduce]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        popStyle,
        style,
      ]}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        {stops ? (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={stops[0]} />
              <Stop offset="1" stopColor={stops[stops.length - 1]} />
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={stops ? `url(#${gradientId})` : (color ?? c.primary)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </Animated.View>
  );
}
