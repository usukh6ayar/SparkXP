import {
  Pressable,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../settings/SettingsContext';
import { radius, elevation, type AppColors } from '../theme/theme';

/** A circular icon-only button — the tap target reused across TopBar/headers. */
export function IconButton({
  icon,
  onPress,
  size = 40,
  iconSize = 20,
  iconColor,
  variant = 'surface',
  /** Small red notification dot (attention cue), top-right of the icon. */
  dot,
  /**
   * Screen-reader label. REQUIRED — this button renders an icon and nothing
   * else, so without it assistive tech announces only "button". Keeping the
   * prop mandatory means a missing label is a compile error, not a silent
   * accessibility gap nobody notices until an audit.
   */
  accessibilityLabel,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * Typed with the press event even though we never read it: `() => void` also
   * accepts `(word?: string) => void`, so a handler expecting an argument could
   * be passed bare and silently receive the event instead. Naming the event
   * type makes that a compile error.
   */
  onPress: (e: GestureResponderEvent) => void;
  size?: number;
  iconSize?: number;
  iconColor?: string;
  variant?: 'surface' | 'filled';
  dot?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  const c = useColors();
  const styles = makeStyles(c);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, backgroundColor: variant === 'filled' ? c.surfaceAlt : c.surface },
        style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={iconSize} color={iconColor ?? c.text} />
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  btn: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...(elevation.sm as object),
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 9,
    height: 9,
    borderRadius: radius.full,
    backgroundColor: c.danger,
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
