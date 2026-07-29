import { useEffect, useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';
import { DURATION, SPRING, useReduceMotion } from '../lib/motion';

/**
 * Progress track used everywhere we show "x of y" — daily goals, lesson
 * progress, XP-to-next-level, quiz position.
 *
 * Why it looks the way it does:
 *  - **Gradient fill, not flat.** `theme.ts` ships `primaryGradient` and a
 *    `glow` colour that nothing was using; a single flat colour made earned
 *    progress feel like a loading bar rather than a reward.
 *  - **Gloss + leading cap.** A highlight along the top of the fill and a soft
 *    glow at its head give the bar depth. Both are STATIC — a looping shimmer
 *    would cost battery and, on a screen with several bars, become noise.
 *  - **Springs to its value.** Progress arriving with a little momentum reads
 *    as "you earned that"; linear easing reads as a machine.
 *
 * Motion is confined to the value change itself, and is skipped entirely under
 * Reduce Motion.
 */
export function ProgressBar({
  value,
  color = colors.primary,
  gradient,
  track,
  height = 8,
  milestones,
  glow = true,
  style,
}: {
  /** 0–1. Clamped. */
  value: number;
  /** Solid colour; used as-is when no `gradient` is given. */
  color?: string;
  /** Two+ stops for the fill (e.g. `colors.primaryGradient`). */
  gradient?: readonly string[];
  track?: string;
  height?: number;
  /**
   * Fractions (0–1) to mark with a tick — e.g. `[0.25, 0.5, 0.75]`. Turns a
   * featureless bar into a set of reachable checkpoints.
   */
  milestones?: readonly number[];
  /** Soft cap at the head of the fill. Skipped on very thin bars. */
  glow?: boolean;
  style?: ViewStyle;
}) {
  const c = useColors();
  const trackColor = track ?? c.border;
  const pct = Math.max(0, Math.min(1, value));
  const reduce = useReduceMotion();
  const [width, setWidth] = useState(0);

  // The fill is a FULL-WIDTH gradient slid into place, not a resized box:
  // translateX is a transform (no layout pass) and it keeps the gradient ramp
  // undistorted, whereas animating width would stretch it as the bar grows.
  const progress = useSharedValue(pct);
  useEffect(() => {
    progress.value = reduce
      ? pct
      : withSpring(pct, { ...SPRING, damping: 20, stiffness: 140 });
  }, [pct, reduce]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * (1 - progress.value) }],
  }));

  // Sits at the head of the fill, and fades out at both ends — a glow at 0%
  // would look like a defect, and at 100% there is no "edge" to mark.
  const capStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: width * progress.value - height }],
    opacity: withTiming(progress.value > 0.02 && progress.value < 0.995 ? 1 : 0, {
      duration: DURATION.fast,
    }),
  }));

  const stops =
    gradient && gradient.length >= 2 ? gradient : ([color, color] as const);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        { height, borderRadius: height, backgroundColor: trackColor },
        style,
      ]}
    >
      {/* Held back until onLayout reports a width: translateX is measured in
          pixels, so at width=0 the offset is 0 and the full-width gradient
          would flash at 100% for a frame before snapping to its real value. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, fillStyle, { opacity: width > 0 ? 1 : 0 }]}
      >
        <LinearGradient
          colors={stops as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: height }}
        />
        {/* Gloss: a light band across the top half, the way a filled tube
            catches light. Pure decoration, so it never animates. */}
        <View
          style={[
            styles.gloss,
            {
              height: height * 0.45,
              borderTopLeftRadius: height,
              borderTopRightRadius: height,
            },
          ]}
        />
      </Animated.View>

      {/* Checkpoints sit ABOVE the fill so they stay visible as it passes. */}
      {milestones?.map((m) => (
        <View
          key={m}
          style={[styles.tick, { left: `${Math.max(0, Math.min(1, m)) * 100}%` }]}
        />
      ))}

      {glow && height >= 6 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cap,
            {
              width: height * 2,
              height,
              borderRadius: height,
              backgroundColor: c.glow,
            },
            capStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  gloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cap: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.9,
  },
});
