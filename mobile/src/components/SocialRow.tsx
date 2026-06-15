import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, elevation } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const PROVIDERS: { key: string; icon: IconName; color: string }[] = [
  { key: 'google', icon: 'logo-google', color: '#EA4335' },
  { key: 'apple', icon: 'logo-apple', color: colors.navy },
  { key: 'facebook', icon: 'logo-facebook', color: '#1877F2' },
];

/** Row of social-login buttons (UI only — wired to `onPress` per provider). */
export function SocialRow({ onPress }: { onPress: (provider: string) => void }) {
  return (
    <View style={styles.row}>
      {PROVIDERS.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => onPress(p.key)}
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        >
          <Ionicons name={p.icon} size={24} color={p.color} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
