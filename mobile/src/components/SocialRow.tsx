import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, elevation, type AppColors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';
import type { SocialProvider } from '../api/auth';

type IconName = keyof typeof Ionicons.glyphMap;

// `color: null` → resolved to the theme ink (navy) so the Apple mark stays
// legible on both light and dark buttons.
//
// Facebook was removed, not hidden — owner's decision 2026-08-08. It needs its
// own app review for the `email` permission, and nothing in the backend
// verifies a Facebook token.
const PROVIDERS: { key: SocialProvider; icon: IconName; color: string | null }[] = [
  { key: 'google', icon: 'logo-google', color: '#EA4335' },
  { key: 'apple', icon: 'logo-apple', color: null },
];

/**
 * Row of social-login buttons.
 *
 * `available` decides what is shown: the server reports which providers have
 * client ids configured, and Apple additionally needs iOS 13+. A provider that
 * cannot work is never drawn, so nobody taps a button that is certain to fail.
 */
export function SocialRow({
  onPress,
  available,
  disabled = false,
}: {
  onPress: (provider: SocialProvider) => void;
  available: { google: boolean; apple: boolean };
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shown = PROVIDERS.filter((p) => available[p.key]);
  if (shown.length === 0) return null;

  return (
    <View style={styles.row}>
      {shown.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => onPress(p.key)}
          disabled={disabled}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          <Ionicons name={p.icon} size={24} color={p.color ?? colors.navy} />
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  btn: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...(elevation.sm as object),
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
