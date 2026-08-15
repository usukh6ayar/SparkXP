import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './Text';
import { PressableScale } from './PressableScale';
import { radius, spacing, elevation } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

type IconName = keyof typeof Ionicons.glyphMap;

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * primary = glowing violet gradient · secondary = surface outline ·
   * ghost = text only · danger = solid red, for destructive confirms
   * (the brand gradient reads as "safe", which is the wrong signal there).
   */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg';
  icon?: IconName;
  /** Trailing icon shown after the label (e.g. arrow-forward). */
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

/**
 * Brand button. The `primary` variant uses the glowing violet gradient + soft
 * glow (DESIGN.md's "glowing CTA"); `secondary`/`ghost` are flat. Press gives a
 * spring scale + haptic (via PressableScale). Colors come from `useColors()`
 * so it flips with the light/dark theme.
 */
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
}: ButtonProps) {
  const c = useColors();
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';
  const blocked = disabled || loading;
  const fg = isPrimary || isDanger ? c.white : c.primary;
  const iconSize = size === 'lg' ? 20 : 18;

  return (
    <PressableScale
      onPress={onPress}
      disabled={blocked}
      haptic={!blocked}
      style={[
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        isSecondary && { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.primary },
        isDanger && { backgroundColor: c.danger },
        variant === 'ghost' && styles.ghost,
        isPrimary && elevation.md,
        fullWidth && styles.fullWidth,
        blocked && styles.disabled,
        style,
      ]}
    >
      {/* Glowing gradient fill for the primary CTA. Its own borderRadius clips
          the corners so the parent needs no `overflow:hidden` (which would clip
          the glow shadow on iOS). */}
      {isPrimary ? (
        <LinearGradient
          colors={c.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]}
        />
      ) : null}

      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={iconSize} color={fg} /> : null}
          <AppText variant="bodyStrong" color={fg} numberOfLines={1} style={styles.label}>
            {label}
          </AppText>
          {iconRight ? <Ionicons name={iconRight} size={iconSize} color={fg} /> : null}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: { height: 52, paddingHorizontal: spacing.xl },
  md: { height: 44, paddingHorizontal: spacing.lg },
  fullWidth: { alignSelf: 'stretch' },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, maxWidth: '100%' },
  // flexShrink lets a long (e.g. Mongolian) label ellipsize inside the button
  // instead of wrapping to a second line and overflowing the fixed height.
  label: { fontWeight: '700', flexShrink: 1 },
});
