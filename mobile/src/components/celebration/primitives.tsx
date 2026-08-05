import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../lib/motion';
import { SCRIM_FULL, SCRIM_START, rng, sparklePath } from './palette';

/**
 * The two layers that sit ON TOP of the artwork.
 *
 * The art itself is a finished illustration — it needs no help being pretty.
 * What it does need is (a) somewhere white text can live, and (b) a little
 * motion, because a still image behind a celebration reads as a loading screen.
 */

/**
 * The readability wash.
 *
 * Starts below the fox's face in every plate (see `SCRIM_START`) and reaches
 * full strength where the UI begins, so the hero of the artwork stays lit and
 * the copy underneath always clears contrast — including on the daylight
 * mountain plate, which would otherwise be white text on pale blue sky.
 */
export function Scrim({ strength }: { strength: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      colors={[
        'rgba(8,4,32,0)',
        `rgba(8,4,32,${(strength * 0.30).toFixed(3)})`,
        `rgba(8,4,32,${(strength * 0.88).toFixed(3)})`,
        `rgba(8,4,32,${strength.toFixed(3)})`,
      ]}
      locations={[0, SCRIM_START, SCRIM_FULL, 1]}
    />
  );
}

/**
 * A drifting, twinkling sparkle layer over the art.
 *
 * Three of these are stacked at different phases rather than animating dozens
 * of individual SVG nodes: the eye reads the same shimmer, and the UI thread
 * drives THREE transforms instead of forty animated props.
 *
 * They are kept out of the bottom half, so they add life to the sky without
 * ever landing on the text.
 */
export function SparkleLayer({
  seed,
  count = 10,
  size = 9,
  delay = 0,
  duration = 2600,
  drift = 16,
  colors,
}: {
  seed: number;
  count?: number;
  /** Base half-diagonal; each sparkle varies around it. */
  size?: number;
  delay?: number;
  duration?: number;
  /** How far the layer floats, in px. */
  drift?: number;
  colors: readonly string[];
}) {
  const { width: w, height: h } = useWindowDimensions();
  const reduce = useReduceMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduce) { t.value = 0.5; return; }
    // The delay is what de-syncs the stacked layers — without it all three
    // twinkle on the same beat and the shimmer reads as one flashing sheet.
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [reduce, duration, delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + t.value * 0.55,
    transform: [{ translateY: -drift / 2 + t.value * drift }],
  }));

  const bits = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({
      x: 16 + r() * (w - 32),
      // Top 46% only: below that the scrim takes over and the copy begins.
      y: 40 + r() * (h * 0.46),
      s: size * (0.45 + r() * 1.05),
      rot: r() * 90,
      c: colors[Math.floor(r() * colors.length)],
      o: 0.45 + r() * 0.55,
    }));
  }, [seed, count, size, colors, w, h]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        {bits.map((b, i) => (
          <G key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.rot})`} opacity={b.o}>
            <Path d={sparklePath(b.s)} fill={b.c} />
          </G>
        ))}
      </Svg>
    </Animated.View>
  );
}

/**
 * A very slow push-in on the artwork (a Ken Burns move).
 *
 * ~5% over twelve seconds — far too slow to read as motion, but it is the
 * difference between "a celebration" and "a screenshot". Reduce Motion turns it
 * off entirely. The base scale is above 1 so the drift never exposes an edge.
 */
export function useKenBurns() {
  const reduce = useReduceMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduce, t]);

  return useAnimatedStyle(() => ({
    transform: [
      { scale: 1.04 + t.value * 0.05 },
      { translateY: -6 + t.value * 12 },
    ],
  }));
}
