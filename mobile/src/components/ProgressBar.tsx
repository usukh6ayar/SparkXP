import { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';
import { DURATION, useReduceMotion } from '../lib/motion';

/**
 * Thin rounded progress track. One implementation for daily goals, lesson
 * progress, XP-to-next-level, challenges — anywhere we show "x of y".
 * The fill eases to its new value with `withTiming` instead of jumping.
 */
export function ProgressBar({
  value,
  color = colors.primary,
  track,
  height = 8,
  style,
}: {
  /** 0–1. Clamped. */
  value: number;
  color?: string;
  track?: string;
  height?: number;
  style?: ViewStyle;
}) {
  const c = useColors();
  const trackColor = track ?? c.border;
  const pct = Math.max(0, Math.min(1, value));
  const reduce = useReduceMotion();

  const progress = useSharedValue(pct);
  useEffect(() => {
    progress.value = reduce ? pct : withTiming(pct, { duration: DURATION.base });
  }, [pct, reduce]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height, backgroundColor: trackColor }, style]}>
      <Animated.View style={[fillStyle, { height, borderRadius: height, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});
