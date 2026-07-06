import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '../settings/SettingsContext';
import { useReduceMotion } from '../lib/motion';

/** One falling confetti piece — random start, drift, spin and fall. */
function Piece({ color, delay }: { color: string; delay: number }) {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);

  // Randomised once per piece so the burst looks organic.
  const startX = useMemo(() => Math.random() * width, [width]);
  const drift = useMemo(() => (Math.random() - 0.5) * 160, []);
  const size = useMemo(() => 6 + Math.random() * 8, []);
  const spin = useMemo(() => 180 + Math.random() * 540, []);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1600 + Math.random() * 800, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * height * 0.9 },
      { translateX: progress.value * drift },
      { rotate: `${progress.value * spin}deg` },
    ],
    opacity: 1 - progress.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -20,
          left: startX,
          width: size,
          height: size * 0.6,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

/**
 * A one-shot confetti burst overlay — drop it on top of a screen when the user
 * wins (quiz passed, achievement unlocked). Pure JS/reanimated (no native dep),
 * respects Reduce Motion (renders nothing when enabled).
 *
 * Usage:
 *   {result.passed && <Confetti />}
 */
export function Confetti({ count = 40 }: { count?: number }) {
  const c = useColors();
  const reduce = useReduceMotion();

  const palette = [c.xp, c.sparks, c.streak, c.primary, c.success];
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        color: palette[i % palette.length],
        delay: Math.random() * 250,
      })),
    [count],
  );

  if (reduce) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Piece key={i} color={p.color} delay={p.delay} />
      ))}
    </View>
  );
}
