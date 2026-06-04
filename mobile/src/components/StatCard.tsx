import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSize } from '../theme/theme';

/** A gamification stat tile (XP, Sparks, ...). Reused on Home and Profile. */
export function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  icon: { fontSize: 28 },
  value: { fontSize: fontSize.xxl, fontWeight: '800', marginTop: spacing.xs },
  label: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
});
