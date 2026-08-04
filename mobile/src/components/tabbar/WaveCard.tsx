import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSettings } from '../../settings/SettingsContext';
import { useReduceMotion } from '../../lib/motion';
import {
  BAND,
  BAR_H,
  GLOW_PAD,
  RADIUS,
  WAVE_H,
  WAVE_PERIOD,
  wavePath,
  waveEdgePath,
} from './geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * The band's colours, sampled straight out of the design mock: violet on the
 * left, magenta through the middle, sky on the right. Pastel on purpose — the
 * mock's band sits around 55–65% lightness, and pushing it to full brand
 * saturation turns a soft light into a highlighter stripe.
 */
const BAND_COLORS = [
  { offset: '0', color: '#8D5FFF' },
  { offset: '0.22', color: '#A98CFF' },
  { offset: '0.45', color: '#DE7CF5' },
  { offset: '0.72', color: '#A9AEFC' },
  { offset: '1', color: '#6891FB' },
];

/**
 * A whisper of the band's colour spilling OUTSIDE the edge. The mock has none —
 * its edge is hard — but on a dark screen a couple of nearly-invisible passes
 * keep the card from looking cut out with scissors. Two strokes, since SVG has
 * no cheap blur that behaves the same on both platforms.
 */
const BLOOM = [
  { width: 7, opacity: 0.1 },
  { width: 3, opacity: 0.14 },
];

/**
 * The card the tabs sit on: one SOLID surface whose top edge is a wave — and
 * the wave MOVES, slowly, like water.
 *
 * Solid, not glass. A blurred translucent bar picks up whatever is scrolling
 * underneath it, so the icons sit on a surface that changes colour as the user
 * moves — the opposite of the calm, premium feel this bar is after. The card is
 * the theme's `surface` (white in light mode, the raised indigo in dark), lifted
 * off the screen by one soft upward shadow.
 *
 * Along the top edge runs a thick brand-gradient band (violet → magenta → sky).
 * It is the one bright thing on the card, and it is what makes the wave read as
 * an edge of light rather than as a white shape ending: over a dark screen the
 * shadow alone is invisible, so without it the bar looked cut out with scissors.
 *
 * Layers, bottom to top (RN cannot draw a shadow around an arbitrary SVG path,
 * which is why the first one exists at all):
 *  1. a rounded rect covering the card body — it carries the shadow,
 *  2. a faint bloom stroked just outside the edge,
 *  3. the swell filled with the GRADIENT,
 *  4. the same swell filled with `surface` and dropped by BAND — it covers all
 *     of (3) except the band along the edge.
 *
 * The three SVG paths are rebuilt every frame from one shared clock, in
 * worklets on the UI thread — the JS thread never sees the animation, so it
 * keeps running smoothly while a screen loads or a list scrolls. Only the
 * crest region is allowed to move; see `edgeCommands`.
 */
export function WaveCard({
  width,
  bottomInset,
  splash,
}: {
  width: number;
  /** Safe-area inset the card extends down into. */
  bottomInset: number;
  /** 0…1 — pulses when a tab is tapped, and the wave swells with it. */
  splash: SharedValue<number>;
}) {
  const { theme, colors: c } = useSettings();
  const isDark = theme === 'dark';
  const reduce = useReduceMotion();
  const height = WAVE_H + BAR_H + bottomInset;

  // 0…1, looping forever. One clock for all three paths, so they can never
  // drift apart and show the band tearing away from the edge.
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      cancelAnimation(phase);
      phase.value = 0; // the neutral shape — see the harmonics in `geometry`
      return;
    }
    phase.value = withRepeat(
      withTiming(1, { duration: WAVE_PERIOD, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [reduce, phase]);

  const cardProps = useAnimatedProps(() => ({
    d: wavePath(width, height, 0, phase.value, splash.value),
  }));
  const surfaceProps = useAnimatedProps(() => ({
    d: wavePath(width, height, BAND, phase.value, splash.value),
  }));
  const edgeProps = useAnimatedProps(() => ({
    d: waveEdgePath(width, phase.value, splash.value),
  }));

  return (
    <View style={[styles.root, { height: height + GLOW_PAD }]} pointerEvents="none">
      {/* Shadow only — a whisper (8–10% at 24 blur, thrown upward), which is what
          separates the card from the screen now that there is no border. Neutral
          ink, never the theme's violet bloom: a purple shadow under a white card
          is exactly the heaviness this design is reacting against. */}
      <View
        style={[
          styles.body,
          {
            // A few px BELOW the wave's dips, never level with them: the dips
            // deepen slightly as the wave breathes, and a rect sitting exactly
            // at their resting depth would poke a straight white sliver out
            // above the curve at the bottom of each swing.
            top: GLOW_PAD + WAVE_H + 3,
            backgroundColor: c.surface,
            shadowColor: isDark ? '#000' : '#2A1E56',
          },
        ]}
      />

      {/* The viewBox starts GLOW_PAD ABOVE the drawing, which pushes everything
          down by that much — the cheapest way to give the glow room without
          re-writing every y in the path. */}
      <Svg
        width={width}
        height={height + GLOW_PAD}
        viewBox={`0 ${-GLOW_PAD} ${width} ${height + GLOW_PAD}`}
      >
        <Defs>
          <LinearGradient id="waveBand" x1="0" y1="0" x2="1" y2="0">
            {BAND_COLORS.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </LinearGradient>
        </Defs>

        {/* Outside the edge first, so the card lands on top of its own bloom.
            Both strokes share ONE animated `d` — same path, different weights. */}
        {BLOOM.map((b) => (
          <AnimatedPath
            key={b.width}
            animatedProps={edgeProps}
            fill="none"
            stroke="url(#waveBand)"
            strokeWidth={b.width}
            strokeOpacity={b.opacity}
            strokeLinecap="round"
          />
        ))}

        {/* The card in the gradient… */}
        <AnimatedPath animatedProps={cardProps} fill="url(#waveBand)" />
        {/* …then the same card in the surface colour, dropped by BAND. What
            stays visible of the layer underneath is the band — hugging every
            curve, exactly BAND thick, with no clip path or mask involved. */}
        <AnimatedPath animatedProps={surfaceProps} fill={c.surface} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    shadowOpacity: 0.09,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
});
