import { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { haptics } from '../lib/haptics';
import { t } from '../i18n';
import { colors, spacing, radius } from '../theme/theme';
import { wp } from '../theme/responsive';

/**
 * Share of the row's width the finger must cross before the delete arms —
 * Gmail's threshold, near enough. Short flicks fall back; a deliberate pull
 * commits. Also drives the haptic tick, so what you feel is exactly what will
 * happen when you let go.
 */
const ARM_FRACTION = 0.38;

/** Row width before the first `onLayout`. Screen minus the list's side padding,
 *  so on a phone the measured value matches and no re-render happens at all. */
const DEFAULT_ROW_W = wp(100) - spacing.lg * 2;

/** How far a row deleted by an in-row button flies before the gap closes.
 *  (A swiped row is already off-screen — the swipeable itself took it there.) */
const FLY_OUT = wp(100);

/** No-op cap: `maxHeight` is always a number (never `undefined`, which
 *  Reanimated cannot diff cleanly), so this stands in for "unconstrained". */
const NO_MAX_HEIGHT = 9999;

/**
 * The track's red. A local constant, not a palette token, because `danger` is
 * tuned for *text and outlines* at either end of the scale — light `#C42B2B` is
 * a dark maroon slab and dark `#F87171` is a pale salmon, and neither reads as
 * "delete" when it fills a whole row. This is the plain, familiar red (red-600)
 * that Gmail/Mail use for the same job, and it clears 4.8:1 against white so the
 * icon and label on top stay legible in both themes.
 */
const TRACK_RED = '#DC2626';

const FLY_MS = 200;
const CLOSE_MS = 190;
/** The gap starts closing while the row is still leaving, so the removal reads
 *  as one motion instead of two chained steps. */
const CLOSE_DELAY = 120;

/**
 * Wraps a list row so it can be **swiped away like a Gmail message**.
 *
 * Drag the row sideways and a red track with a trash icon shows through behind
 * it. Cross `ARM_FRACTION` of the row's width and it arms — the icon
 * pops, the word "Устгах" appears and you feel a tick; drag back under the
 * threshold and it disarms with a lighter tick. Let go while armed and the row
 * slides out and the gap closes behind it; let go before, and it springs back.
 *
 * There is deliberately **no revealed Delete button to tap**: Gmail has none,
 * and the arm threshold (a long, intentional pull — not a flick) is what makes
 * a single gesture safe. Screen-reader users delete with the row's own ⭐ / 🔖
 * button, which is a real labelled control.
 *
 * `children` may be a function; it receives `remove`, the same animated
 * removal. Give it to any in-row control that also deletes, so a tap and a
 * swipe leave the list the same way instead of one of them jumping.
 */
export function SwipeToDelete({
  onDelete,
  children,
}: {
  onDelete: () => void;
  children: React.ReactNode | ((remove: () => void) => React.ReactNode);
}) {
  const [rowW, setRowW] = useState(DEFAULT_ROW_W);
  /**
   * Clipping is switched on only for the ~300ms of the removal.
   *
   * `maxHeight` cannot close the gap without `overflow: hidden`, but leaving it
   * on permanently cuts the raised `Card`'s shadow off square and leaves a hard
   * wedge at each of the row's four rounded corners.
   */
  const [clipping, setClipping] = useState(false);
  /** Natural row height, measured once, used to animate the gap closed. */
  const rowH = useSharedValue(0);
  /** 1 → in place, 0 → flown off to the left (button path only). */
  const fly = useSharedValue(1);
  /** 1 → full height, 0 → gap fully closed. */
  const close = useSharedValue(1);
  /** Only constrain the height while removing, so normal layout is untouched. */
  const removing = useSharedValue(0);
  /** JS-side latch — the row stays interactive for ~300ms after the animation
   *  starts, and deleting the same row twice would drop the wrong word. */
  const busy = useRef(false);

  /**
   * Take the row out. `slid` = the swipeable has already carried it off-screen,
   * so only the fade and the gap remain to animate.
   */
  const remove = useCallback(
    (slid: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setClipping(true);
      removing.value = slid ? 2 : 1; // 2 = already off-screen, nothing to fly
      // A swiped row has left the screen under its own momentum and the red
      // track stays put behind it (Gmail keeps it there) — only the gap is left
      // to animate. A button-deleted row has to make that exit itself.
      if (!slid) {
        fly.value = withTiming(0, { duration: FLY_MS, easing: Easing.in(Easing.cubic) });
      }
      close.value = withDelay(
        CLOSE_DELAY,
        withTiming(0, { duration: CLOSE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(onDelete)();
        }),
      );
    },
    [onDelete, fly, close, removing],
  );

  const onSwipeCommit = useCallback(() => {
    haptics.medium();
    remove(true);
  }, [remove]);

  const onButtonCommit = useCallback(() => {
    haptics.medium();
    remove(false);
  }, [remove]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      // Ignore the shrinking layouts the close animation itself produces.
      if (busy.current) return;
      const { width, height } = e.nativeEvent.layout;
      rowH.value = height;
      setRowW((w) => (Math.abs(w - width) > 1 ? width : w));
    },
    [rowH],
  );

  const wrapper = useAnimatedStyle(() => {
    const out = removing.value === 2 ? 1 : fly.value; // swiped rows: nothing to fly
    return {
      opacity: out,
      transform: [{ translateX: -(1 - out) * FLY_OUT }],
      maxHeight:
        removing.value > 0 && rowH.value > 0 ? rowH.value * close.value : NO_MAX_HEIGHT,
    };
  });

  return (
    <Animated.View style={[clipping && styles.clip, wrapper]} onLayout={onLayout}>
      <ReanimatedSwipeable
        // ReanimatedSwipeable's own container is `overflow: hidden` and we
        // cannot turn that off (it is what keeps the track from spilling). Left
        // square it clips the raised Card's shadow into a hard wedge at each of
        // the four rounded corners, so give the clip the SAME radius as `Card`.
        containerStyle={styles.clipRadius}
        // 1:1 with the finger and clamped at the row's edge — the row is the
        // thing being dragged, not a drawer being opened.
        friction={1}
        overshootRight={false}
        rightThreshold={rowW * ARM_FRACTION}
        onSwipeableWillOpen={onSwipeCommit}
        renderRightActions={(progress) => <DeleteTrack progress={progress} />}
      >
        {typeof children === 'function' ? children(onButtonCommit) : children}
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

/**
 * The track revealed behind the row: a plain red panel with a white trash icon,
 * filling the whole row rather than sitting in a button-sized slab — in this
 * gesture the row itself is what gets thrown away, so the colour belongs to the
 * whole row. See `TRACK_RED` for why the red is a constant, not a palette token.
 */
function DeleteTrack({ progress }: { progress: SharedValue<number> }) {
  // Bound once so the worklet captures two plain functions rather than the
  // whole `haptics` module object.
  const tickArm = useCallback(() => haptics.select(), []);
  const tickDisarm = useCallback(() => haptics.tap(), []);

  useAnimatedReaction(
    () => progress.value >= ARM_FRACTION,
    (isArmed, was) => {
      if (was === null || isArmed === was) return;
      // Crisp tick on arm, a lighter one on the way back — the drag tells you
      // what will happen before you let go.
      runOnJS(isArmed ? tickArm : tickDisarm)();
    },
  );

  // Icon fades in with the drag, then pops the moment the delete arms.
  const icon = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.04, 0.16], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, ARM_FRACTION * 0.6, ARM_FRACTION, ARM_FRACTION + 0.12],
          [0.6, 0.86, 1.16, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // The label only shows once the gesture would actually delete — it is the
  // confirmation, so it must not be readable a moment too early.
  const caption = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [ARM_FRACTION - 0.06, ARM_FRACTION],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.trackInner, icon]}>
        <Ionicons name="trash" size={22} color={colors.white} />
        <Animated.View style={caption}>
          <AppText variant="caption" color={colors.white}>{t('delete')}</AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Only applied while removing — see `clipping` above. Rounded for the same
  // reason as `clipRadius`: a square clip leaves wedges at the row's corners.
  clip: { overflow: 'hidden', borderRadius: radius.lg },
  /** Matches `Card`'s radius — see the `containerStyle` note above. */
  clipRadius: { borderRadius: radius.lg },
  track: {
    flex: 1,
    backgroundColor: TRACK_RED,
    // Must match `Card`'s radius exactly — this sits directly behind the row,
    // so any mismatch pokes out at the four corners.
    borderRadius: radius.lg,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  trackInner: { alignItems: 'center', gap: 2 },
});
