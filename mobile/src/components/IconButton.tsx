import { Pressable, View, StyleSheet, type ViewStyle } from 'react-native';
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
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  iconColor?: string;
  variant?: 'surface' | 'filled';
  dot?: boolean;
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
