import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon } from './AppIcon';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { DURATION, shake, useReduceMotion } from '../lib/motion';
import { useCountdown } from '../lib/countdown';
import { t, tf } from '../i18n';
import type { HeartsState } from '../api/hearts';

/** Above this many hearts a row of icons stops being readable → show a count. */
const MAX_ICONS = 5;

// Animated so the whole row can shake on a loss while still being pressable.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The student's remaining quiz lives, as the server reports them.
 *
 * Purely presentational — it never decrements anything, because hearts are only
 * ever spent inside `POST /quizzes/:id/check` (see `api/hearts.ts`). Losing one
 * shakes the row so the cost is felt, not just displayed.
 */
export function HeartsRow({
  state,
  size = 20,
  onDark = false,
  onRegen,
  onPress,
}: {
  state: HeartsState | null;
  size?: number;
  /**
   * Render for a permanently dark surface (the Home hero sits on the night-sky
   * art in BOTH themes). Without this the text uses `c.text`, which is dark in
   * light mode and disappears against the artwork.
   */
  onDark?: boolean;
  /**
   * Opens the hearts detail sheet. Without it the row is display-only, and the
   * student has no way to find out when the next heart arrives.
   */
  onPress?: () => void;
  /**
   * Called when the next heart's timer runs out. Regeneration is lazy on the
   * server (no cron), so nothing changes until someone asks — without this the
   * timer hits zero and the count just sits there looking broken.
   */
  onRegen?: () => void;
}) {
  const c = useColors();
  const reduce = useReduceMotion();
  const offset = useSharedValue(0);
  const previous = useRef<number | null>(null);
  // Not rendered here — the row is a compact indicator and the full countdown
  // lives in the sheet. We still run it so `onRegen` fires the moment a heart
  // is actually back.
  useCountdown(state && !state.unlimited ? state.nextHeartAt : null, onRegen);

  const count = state?.hearts ?? null;

  // Shake whenever the count drops — a heart lost should register physically.
  useEffect(() => {
    if (count === null) return;
    if (previous.current !== null && count < previous.current && !reduce) {
      offset.value = shake();
    }
    previous.current = count;
  }, [count, reduce]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  if (!state) return null;

  const label = state.unlimited
    ? tf('heartsUnlimitedA11y', { max: state.max })
    : tf('heartsCountA11y', { n: state.hearts, max: state.max });

  const textColor = onDark ? c.textOnDark : c.text;

  return (
    <AnimatedPressable
      style={[styles.row, rowStyle]}
      onPress={onPress}
      // Without an onPress this is decoration, so it should not read as a
      // button to a screen reader either.
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityHint={onPress ? t('heartsTapHint') : undefined}
      hitSlop={8}
    >
      {state.unlimited ? (
        <>
          <AppIcon name="heart" size={size} />
          <AppText variant="bodyStrong" color={textColor}>∞</AppText>
        </>
      ) : state.max > MAX_ICONS ? (
        <>
          <Heart filled={state.hearts > 0} size={size} />
          <AppText variant="bodyStrong" color={textColor}>
            {state.hearts}/{state.max}
          </AppText>
        </>
      ) : (
        Array.from({ length: state.max }, (_, i) => (
          <Heart key={i} filled={i < state.hearts} size={size} />
        ))
      )}

    </AnimatedPressable>
  );
}

/**
 * One heart. Fades + shrinks to a dim outline when spent, so the transition is
 * visible mid-quiz instead of the icon silently swapping.
 */
function Heart({ filled, size }: { filled: boolean; size: number }) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    const to = filled ? 1 : 0;
    fill.value = reduce ? to : withTiming(to, { duration: DURATION.base });
  }, [filled, reduce]);

  // A spent heart stays visible (0.3, not near-transparent) — on the dark Home
  // hero a fainter one reads as "no heart there at all". The scale drop carries
  // most of the spent/full difference anyway.
  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + fill.value * 0.7,
    transform: [{ scale: 0.8 + fill.value * 0.2 }],
  }));

  return (
    <Animated.View style={style}>
      <AppIcon name="heart" size={size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
