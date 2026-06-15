import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { IconTile } from './IconTile';
import { colors, spacing, radius } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Compact gamification stat tile (XP, Sparks, streak). Icon chip on the left,
 * value + label stacked — denser and more "product" than the old big centered
 * tile. Reused on Home and Profile.
 */
export function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: IconName;
  label: string;
  value: number | string;
  color: string;
  bg: string;
}) {
  return (
    <View style={styles.card}>
      <IconTile icon={icon} bg={bg} fg={color} size={38} iconSize={20} />
      <View style={styles.text}>
        <AppText variant="h2" color={colors.text} numberOfLines={1}>{value}</AppText>
        <AppText variant="caption">{label}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  text: { flex: 1 },
});
