import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '../settings/SettingsContext';
import { DURATION, useReduceMotion } from '../lib/motion';

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
  track,
  children,
  style,
}: {
  /** 0–1. Clamped. */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const c = useColors();
  const reduce = useReduceMotion();
  const pct = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const fill = useSharedValue(pct);
  useEffect(() => {
    fill.value = reduce ? pct : withTiming(pct, { duration: DURATION.slow });
  }, [pct, reduce]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - fill.value),
  }));

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}
