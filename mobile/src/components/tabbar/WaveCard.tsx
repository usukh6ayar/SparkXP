import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, type SharedValue } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSettings } from '../../settings/SettingsContext';
import { SPRING } from '../../lib/motion';
import { BAR_H, RADIUS, WAVE_H, wavePath, waveEdgePath } from './geometry';

/**
 * The floating glass card the tabs sit on: a blurred, translucent surface whose
 * top edge is one long wave peaking under the buddy.
 *
 * Drawn as two layers rather than one so the glass is real:
 *  1. a blurred rounded rect covering the card body (blur cannot be clipped to
 *     an arbitrary SVG path, so it stops at the wave's shoulders — the sliver
 *     above is behind the buddy and reads as part of the same surface), and
 *  2. the SVG wave on top, filled with a translucent surface colour so the blur
 *     shows through, plus a hairline stroked with the brand gradient.
 *
 * The gradient lives ONLY on that hairline. A gradient across the whole card
 * is the "harsh" look this design is reacting against.
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

  // Translucent so the blur beneath is visible. Light mode is the white card
  // the design asks for; dark mode uses the deep surface at the same alpha.
  const fill = isDark ? 'rgba(23,16,51,0.86)' : 'rgba(255,255,255,0.84)';
  // The hairline reads much hotter on a near-black surface than on white, so
  // it is dialled back rather than being one fixed opacity.
  const edgeOpacity = isDark ? 0.5 : 0.75;

  // The wave leans a few pixels toward the tab you picked, then settles. Done
  // with a transform, not by rebuilding `d`, so the whole card moves as one
  // piece and nothing has to be re-pathed per frame.
  const leanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(drift.value * 6, SPRING) }],
  }));

  return (
    <Animated.View style={[styles.root, { height }, leanStyle]} pointerEvents="none">
      {/* Glass + the soft drop shadow. Neutral, never the theme's violet bloom:
          a purple shadow under a white card is exactly the heaviness we avoid. */}
      <View style={[styles.glassWrap, { top: WAVE_H, shadowColor: isDark ? '#000' : '#2A1E56' }]}>
        <BlurView
          intensity={isDark ? 28 : 22}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="waveEdge" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c.primary} stopOpacity={0.15} />
            <Stop offset="0.35" stopColor="#7C6BFF" stopOpacity={0.9} />
            <Stop offset="0.6" stopColor="#B06BFF" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#FF8FC8" stopOpacity={0.15} />
          </LinearGradient>
        </Defs>

        <Path d={wavePath(width, height)} fill={fill} />
        <Path
          d={waveEdgePath(width)}
          stroke="url(#waveEdge)"
          strokeWidth={2}
          strokeOpacity={edgeOpacity}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  glassWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: 'hidden',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
});
