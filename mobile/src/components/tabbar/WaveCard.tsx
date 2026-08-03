import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSettings } from '../../settings/SettingsContext';
import { SPRING } from '../../lib/motion';
import { BAR_H, RADIUS, WAVE_H, wavePath } from './geometry';

/**
 * The card the tabs sit on: one SOLID surface whose top edge is a long, gentle
 * swell peaking under the buddy.
 *
 * Solid, not glass. A blurred translucent bar picks up whatever is scrolling
 * underneath it, so the icons sit on a surface that changes colour as the user
 * moves — the opposite of the calm, premium feel this bar is after. The card is
 * the theme's `surface` (white in light mode, the raised indigo in dark), and
 * separation comes from one soft upward shadow instead of a border or a tint.
 *
 * Two layers, because RN cannot draw a shadow around an arbitrary SVG path:
 *  1. a rounded rect covering the card body — it carries the shadow, and
 *  2. the SVG swell on top, filled with the SAME colour so the seam is invisible.
 */
export function WaveCard({
  width,
  bottomInset,
  drift,
}: {
  width: number;
  /** Safe-area inset the card extends down into. */
  bottomInset: number;
  /** −1…1 — where the active tab sits, so the wave can lean toward it. */
  drift: SharedValue<number>;
}) {
  const { theme, colors: c } = useSettings();
  const isDark = theme === 'dark';
  const height = WAVE_H + BAR_H + bottomInset;

  // The wave leans a few pixels toward the tab you picked, then settles. Done
  // with a transform, not by rebuilding `d`, so the whole card moves as one
  // piece and nothing has to be re-pathed per frame.
  const leanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(drift.value * 6, SPRING) }],
  }));

  return (
    <Animated.View style={[styles.root, { height }, leanStyle]} pointerEvents="none">
      {/* Shadow only — a whisper (8–10% at 24 blur, thrown upward), which is what
          separates the card from the screen now that there is no border. Neutral
          ink, never the theme's violet bloom: a purple shadow under a white card
          is exactly the heaviness this design is reacting against. */}
      <View
        style={[
          styles.body,
          { top: WAVE_H, backgroundColor: c.surface, shadowColor: isDark ? '#000' : '#2A1E56' },
        ]}
      />

      <Svg width={width} height={height}>
        <Path d={wavePath(width, height)} fill={c.surface} />
      </Svg>
    </Animated.View>
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
