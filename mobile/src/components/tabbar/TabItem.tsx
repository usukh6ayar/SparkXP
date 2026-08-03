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
import { radius, spacing } from '../../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Outline when idle, filled when active — the whole icon language of the bar. */
export interface TabIcon {
  outline: IconName;
  filled: IconName;
}

/**
 * One flat tab: icon over a small label, with a soft purple glow that fades in
 * underneath when it is the active one.
 *
 * The active icon lifts a few pixels and the idle ones stay put, so the eye is
 * pulled to the change rather than to four things moving at once.
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

  // One source of truth for "how active am I", so the lift, the glow and the
  // label fade can never disagree mid-animation.
  const active = useDerivedValue(() =>
    reduce ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, SPRING),
  );

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * active.value }],
  }));
  // Kept faint on purpose: an iOS shadow is drawn from the view's alpha, so the
  // fill has to exist for the bloom to exist — it just must not read as a pill.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: active.value * 0.18,
    transform: [{ scale: 0.8 + 0.2 * active.value }],
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
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: c.primary, shadowColor: c.primary }, glowStyle]}
      />
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  /** Soft bloom under the active icon — no pill border, no hard edge. */
  glow: {
    position: 'absolute',
    top: spacing.xs,
    width: 46,
    height: 30,
    borderRadius: radius.full,
    opacity: 0,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0, // Android: no material lift — the colour alone carries it
  },
});
