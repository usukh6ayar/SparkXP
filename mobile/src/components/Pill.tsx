import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { colors, radius, spacing } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Small rounded tag — CEFR level, lesson state, counts. Optional leading icon. */
export function Pill({
  label,
  bg = colors.surface,
  fg = colors.textSecondary,
  icon,
}: {
  label: string;
  bg?: string;
  fg?: string;
  icon?: IconName;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <AppText variant="caption" color={fg} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  text: { fontWeight: '700', letterSpacing: 0.2 },
});
