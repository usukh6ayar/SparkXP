import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { AppText } from '../Text';
import { useColors } from '../../settings/SettingsContext';
import { spacing, radius } from '../../theme/theme';
import { DURATION, useReduceMotion } from '../../lib/motion';
import { tf } from '../../i18n';

/**
 * "3 / 7" step indicator for the onboarding flow — a single filling track plus
 * the count in words.
 *
 * A track (not dots) on purpose: seven dots on a 320pt screen are smaller than
 * the eye can count, whereas a bar answers "how much is left" at a glance,
 * which is the only question a first-run user has.
 */
export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  const c = useColors();
  const reduce = useReduceMotion();
  const pct = Math.max(0, Math.min(1, step / total));

  // Scale, not width: a transform skips the layout pass, so the bar can grow
  // while the incoming screen is still sliding in without dropping frames.
  const grow = useSharedValue(pct);
  useEffect(() => {
    grow.value = reduce ? pct : withTiming(pct, { duration: DURATION.base });
  }, [pct, reduce, grow]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step }}
    >
      <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: c.primary }, fillStyle]}
        />
      </View>
      <AppText variant="caption">{tf('onbStepOf', { n: step, total })}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { flex: 1, height: 6, borderRadius: radius.full, overflow: 'hidden' },
  // transformOrigin keeps the scale anchored to the left edge; without it the
  // fill would grow outward from the centre of the track.
  fill: { height: '100%', borderRadius: radius.full, transformOrigin: 'left' },
});
