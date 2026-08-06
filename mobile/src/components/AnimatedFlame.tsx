import { useEffect } from 'react';
import { StyleProp, ImageStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon } from './AppIcon';
import { useReduceMotion } from '../lib/motion';

/**
 * The streak flame, always gently burning.
 *
 * A continuous flicker (vertical stretch + tiny sway) layered onto the existing
 * `flame.png` streak icon, so the streak badge reads as *alive* — the effect the
 * team wanted from a Lottie fire, but built with Reanimated on the icon we
 * already ship (no Lottie asset lives in the repo, and adding a native package
 * is off-limits under the SDK-54 / lead-only-deps rules). Off under Reduce
 * Motion, where it falls back to the plain static flame.
 *
 * Drop-in replacement for `<AppIcon name="streak" />` — same size/style props.
 */
export function AnimatedFlame({
  size = 22,
  active = true,
  style,
}: {
  size?: number;
  /** When false the flame rests still (e.g. a dead streak). Defaults to burning. */
  active?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const reduce = useReduceMotion();
  const flick = useSharedValue(0);
  const sway = useSharedValue(0.5); // 0.5 = upright (see the rotate mapping below)

  useEffect(() => {
    if (reduce || !active) {
      // Settle to a still, upright flame.
      flick.value = withTiming(0);
      sway.value = withTiming(0.5);
      return;
    }
    // Two out-of-sync loops read as an organic flicker rather than a pulse: a
    // quick asymmetric flare (up fast, settle slow) plus a slow side sway.
    flick.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 560, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    sway.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce, active, flick, sway]);

  const anim = useAnimatedStyle(() => ({
    transform: [
      // A flame stretches up and pinches in as it flares.
      { scaleY: interpolate(flick.value, [0, 1], [1, 1.12]) },
      { scaleX: interpolate(flick.value, [0, 1], [1, 0.95]) },
      { translateY: interpolate(flick.value, [0, 1], [0, -1.5]) },
      // sway 0.5 = upright; the loop swings it between −3° and +3°.
      { rotate: `${interpolate(sway.value, [0, 1], [-3, 3])}deg` },
    ],
  }));

  return (
    <Animated.View style={anim}>
      <AppIcon name="streak" size={size} style={style} />
    </Animated.View>
  );
}
