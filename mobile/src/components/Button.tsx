import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { colors, radius, spacing, fontSize } from '../theme/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/** Brand button. Primary = orange fill; secondary = navy outline. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: Props) {
  const isPrimary = variant === 'primary';
  const blocked = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        blocked && styles.disabled,
        pressed && !blocked && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { fontSize: fontSize.md, fontWeight: '700' },
  labelPrimary: { color: colors.white },
  labelSecondary: { color: colors.primary },
});
