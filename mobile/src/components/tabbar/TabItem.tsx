import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../Text';
import { useSettings } from '../../settings/SettingsContext';
import { SPRING, DURATION, useReduceMotion } from '../../lib/motion';
import { radius } from '../../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Outline when idle, filled when active — the whole icon language of the bar. */
export interface TabIcon {
  outline: IconName;
  filled: IconName;
}

/** How far the active icon rises. */
const LIFT = 8;
/** The active marker: a short, softly glowing underline. */
const UNDERLINE_W = 18;
const UNDERLINE_H = 3;

/**
 * One flat tab: icon over a small label, marked as active by lifting the icon
 * and fading in a tiny glowing underline beneath it.
 *
 * No pill, capsule or filled background behind the active icon. Those read as
 * chrome and make a five-tab bar feel crowded; the lift plus a 18×3 underline
 * says the same thing with almost nothing on screen. Only the active tab moves
 * — the idle ones stay put, so the eye is pulled to the change rather than to
 * four things animating at once.
 */
export function TabItem({
  icon,
  label,
  focused,
  onPress,
}: {
  icon: TabIcon;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useSettings();
  const reduce = useReduceMotion();

  // One source of truth for "how active am I", so the lift, the underline and
  // the label fade can never disagree mid-animation.
  const active = useDerivedValue(() =>
    reduce ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, SPRING),
  );

  // Lift AND a touch of scale: the active icon should read as nearer, not just
  // higher. Scale rather than a bigger `size` so nothing re-lays-out per frame.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -LIFT * active.value },
      { scale: 1 + 0.08 * active.value },
    ],
  }));
  // Grows out from the middle as it fades in — the underline draws itself.
  const underlineStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scaleX: 0.3 + 0.7 * active.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0.7, { duration: DURATION.fast }),
  }));

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? icon.filled : icon.outline}
          size={24}
          color={focused ? c.primary : c.textMuted}
        />
      </Animated.View>
      <Animated.View style={labelStyle}>
        <AppText variant="tabLabel" color={focused ? c.primary : c.textMuted} center>
          {label}
        </AppText>
      </Animated.View>
      {/* The glow is an iOS shadow drawn from this view's own alpha, so the bar
          has to be filled for the bloom to exist — at 18×3 it cannot read as a
          pill. Android has no coloured shadow; the purple bar alone carries it. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.underline,
          { backgroundColor: c.primary, shadowColor: c.primary },
          underlineStyle,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  underline: {
    width: UNDERLINE_W,
    height: UNDERLINE_H,
    borderRadius: radius.full,
    marginTop: 4,
    opacity: 0,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
