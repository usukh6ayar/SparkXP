import { type ReactNode } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { radius, spacing, elevation } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** `flat` = bordered (default), `raised` = soft shadow, `filled` = surface bg. */
  variant?: 'flat' | 'raised' | 'filled';
  padding?: keyof typeof spacing | 0;
  style?: ViewStyle;
}

/**
 * The base surface for everything boxed (lessons, list rows, panels).
 * Replaces the half-dozen near-identical `borderRadius + border + padding`
 * blocks that were copy-pasted across screens. Tappable cards get a built-in
 * press state so feedback is consistent app-wide. Colors follow the active theme.
 */
export function Card({ children, onPress, variant = 'flat', padding = 'lg', style }: Props) {
  const c = useColors();
  const base = [
    styles.base,
    { backgroundColor: variant === 'filled' ? c.surfaceAlt : c.surface },
    variant === 'flat' && { borderWidth: 1, borderColor: c.border },
    variant === 'raised' && (elevation.sm as object),
    padding !== 0 && { padding: spacing[padding] },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
