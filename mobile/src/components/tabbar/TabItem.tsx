import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppIcon } from '../AppIcon';
import { AppText } from '../Text';
import type { AppIconName } from '../../constants/appIcons';
import { useSettings } from '../../settings/SettingsContext';
import { SPRING, DURATION, useReduceMotion } from '../../lib/motion';
import { LABEL_BOTTOM, TAB_GAP, TAB_ICON } from './geometry';

/** How dim an idle icon goes. The 3D art can't be tinted, so this is the tell. */
const IDLE_OPACITY = 0.6;

/**
 * One flat tab: the brand's 3D icon over a small label, marked as active by
 * lighting the icon up and colouring the label.
 *
 * The icons are full-colour PNGs, so `color` can do nothing for them — active
 * vs idle is carried by OPACITY plus a touch of scale.
 *
 * Nothing rises, and there is no underline, pill or capsule under the icon.
 * That is a space decision as much as a taste one: the wave dips lowest right
 * over the inner tabs, and every px of chrome under the icon pushes the icon up
 * into the coloured band along the card's edge. Two states, said with light.
 */
export function TabItem({
  icon,
  label,
  focused,
  onPress,
}: {
  icon: AppIconName;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useSettings();
  const reduce = useReduceMotion();

  // One source of truth for "how active am I", so the icon and the label can
  // never disagree mid-animation.
  const active = useDerivedValue(() =>
    reduce ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, SPRING),
  );

  // Full colour and slightly nearer when active. Scale rather than a bigger
  // `size` so nothing re-lays-out per frame.
  const iconStyle = useAnimatedStyle(() => ({
    opacity: IDLE_OPACITY + (1 - IDLE_OPACITY) * active.value,
    transform: [{ scale: 1 + 0.06 * active.value }],
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
        <AppIcon name={icon} size={TAB_ICON} />
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
  tab: {
    flex: 1,
    alignItems: 'center',
    // Bottom-aligned, so the label sits on the shared baseline and every spare
    // px lands above the icon — where the wave needs it.
    justifyContent: 'flex-end',
    paddingBottom: LABEL_BOTTOM,
    gap: TAB_GAP,
  },
});
