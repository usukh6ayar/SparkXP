import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../Text';
import { haptics } from '../../lib/haptics';
import { spacing, radius, type AppColors } from '../../theme/theme';
import { useColors } from '../../settings/SettingsContext';

/**
 * The YouTube-style scrub bar: drag anywhere in the audio, and see where you
 * are while it plays.
 *
 * Two things here are not decoration:
 *
 * 1. **The gesture is built ONCE.** Everything it needs — the width, the
 *    callback, whether it is enabled — lives in refs/shared values rather than
 *    in the `useMemo` deps. A `Gesture` object rebuilt mid-drag is a drag that
 *    silently dies, and this bar sits on a screen that re-renders on every
 *    sentence of playback, so it would have died constantly.
 * 2. **The bar moves on the UI thread** (shared values + `useAnimatedStyle`),
 *    so the fill follows the finger at screen rate instead of at React's. Only
 *    the little text label crosses back to JS, and only when it actually
 *    changes.
 */
export function SeekBar({
  value,
  onSeek,
  left,
  right,
  smoothMs,
  disabled,
}: {
  /** Current position, 0..1. */
  value: number;
  /** Called on release with the position dragged to, 0..1. */
  onSeek: (ratio: number) => void;
  /** Label under the left end. Takes the position so it FOLLOWS THE FINGER —
   *  a readout that only updates on release tells you where you were, not
   *  where you are about to land. */
  left?: (ratio: number) => string;
  /** Label under the right end (total duration). */
  right?: string;
  /** How long the bar takes to glide to `value` (ms).
   *
   *  Recorded audio reports its position several times a second, so the default
   *  is just enough to smooth the steps. Spoken script has no timeline at all —
   *  it reports one jump per sentence — so the screen passes that sentence's
   *  estimated length here and the fill glides across it instead of sitting
   *  still and then snapping. */
  smoothMs?: number;
  disabled?: boolean;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const width = useSharedValue(0);
  /** Position the player reports (smoothed — status updates are chunky). */
  const pos = useSharedValue(value);
  /** Finger position while dragging; -1 when the finger is up. */
  const drag = useSharedValue(-1);
  const enabled = useSharedValue(disabled ? 0 : 1);

  const onSeekRef = useRef(onSeek);
  const leftRef = useRef(left);
  useEffect(() => {
    onSeekRef.current = onSeek;
    leftRef.current = left;
  });

  useEffect(() => {
    enabled.value = disabled ? 0 : 1;
  }, [disabled, enabled]);

  // Don't fight the finger: while dragging, the player's own position is stale
  // by definition, so it must not pull the bar back.
  useEffect(() => {
    if (drag.value < 0) {
      pos.value = withTiming(value, { duration: smoothMs ?? 240, easing: Easing.linear });
    }
  }, [value, smoothMs, pos, drag]);

  const [label, setLabel] = useState('');
  const emit = useCallback((r: number) => setLabel(leftRef.current?.(r) ?? ''), []);
  useAnimatedReaction(
    () => (drag.value >= 0 ? drag.value : pos.value),
    (r, prev) => {
      // Only when it visibly changed — a label rewritten every frame is a
      // render every frame, which is what makes a scrub bar feel heavy.
      if (prev == null || Math.abs(r - prev) > 0.004) runOnJS(emit)(r);
    },
  );

  const commit = useCallback((r: number) => {
    onSeekRef.current(r);
    haptics.tap();
  }, []);

  const gesture = useMemo(() => {
    const at = (x: number) => {
      'worklet';
      const w = width.value;
      return w > 0 ? Math.max(0, Math.min(1, x / w)) : 0;
    };
    // Horizontal only: `failOffsetY` hands vertical drags back to the page's
    // ScrollView, so the screen still scrolls when a finger crosses the bar.
    const pan = Gesture.Pan()
      .activeOffsetX([-5, 5])
      .failOffsetY([-14, 14])
      .onStart((e) => {
        if (!enabled.value) return;
        drag.value = at(e.x);
      })
      .onUpdate((e) => {
        if (!enabled.value) return;
        drag.value = at(e.x);
      })
      .onEnd((e) => {
        if (!enabled.value) return;
        const r = at(e.x);
        pos.value = r; // hold the new spot; the player catches up in a moment
        runOnJS(commit)(r);
      })
      .onFinalize(() => {
        drag.value = -1;
      });
    // A tap never travels far enough to activate the pan, so it needs its own
    // gesture — tapping the bar is half of how anyone uses one.
    const tap = Gesture.Tap().onEnd((e) => {
      if (!enabled.value) return;
      const r = at(e.x);
      pos.value = r;
      runOnJS(commit)(r);
    });
    return Gesture.Race(pan, tap);
    // Built once on purpose — see the note at the top of the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inline rather than a shared helper: a plain function called from two
  // worklets is a foot-gun (it has to be a worklet itself, on both threads).
  const fillStyle = useAnimatedStyle(() => ({
    width: `${(drag.value >= 0 ? drag.value : pos.value) * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    left: `${(drag.value >= 0 ? drag.value : pos.value) * 100}%`,
    transform: [{ scale: drag.value >= 0 ? 1.35 : 1 }],
  }));

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        {/* Padded hit area — a 7px line is not a finger target. */}
        <View
          style={styles.hit}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width;
          }}
        >
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </View>
      </GestureDetector>

      {left || right ? (
        <View style={styles.labels}>
          <AppText variant="caption" color={c.white}>{label}</AppText>
          <AppText variant="caption" color={c.textOnDarkMuted}>{right ?? ''}</AppText>
        </View>
      ) : null}
    </View>
  );
}

/** mm:ss for a seconds value (the recorded-audio labels). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Deliberately chunky: this bar IS the control (there are no skip buttons), so
// it has to look grabbable and survive a thumb landing roughly on it.
const TRACK_H = 7;
const THUMB = 18;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: { gap: 2 },
    hit: { justifyContent: 'center', height: 36 },
    track: {
      height: TRACK_H,
      borderRadius: radius.full,
      backgroundColor: 'rgba(255,255,255,0.28)',
      overflow: 'hidden',
    },
    fill: { height: TRACK_H, borderRadius: radius.full, backgroundColor: c.white },
    thumb: {
      position: 'absolute',
      width: THUMB,
      height: THUMB,
      borderRadius: radius.full,
      backgroundColor: c.white,
      marginLeft: -THUMB / 2,
    },
    labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  });
