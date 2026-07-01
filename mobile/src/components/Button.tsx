import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { colors, radius, spacing } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  label: string;
  onPress: () => void;
  /** primary = orange fill · secondary = navy outline · ghost = text only */
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
  icon?: IconName;
  /** Trailing icon shown after the label (e.g. arrow-forward). */
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

/** Brand button with size + variant system and an optional leading icon. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth = true,
  style,
}: Props) {
  const c = useColors();
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const blocked = disabled || loading;
  const fg = isPrimary ? colors.white : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        isPrimary && styles.primary,
        isSecondary && [styles.secondary, { backgroundColor: c.surface }],
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        blocked && styles.disabled,
        pressed && !blocked && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={fg} /> : null}
          <AppText variant="bodyStrong" color={fg} style={styles.label}>
            {label}
          </AppText>
          {iconRight ? (
            <Ionicons name={iconRight} size={size === 'lg' ? 20 : 18} color={fg} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  lg: { height: 52, paddingHorizontal: spacing.xl },
  md: { height: 44, paddingHorizontal: spacing.lg },
  fullWidth: { alignSelf: 'stretch' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontWeight: '700' },
});
