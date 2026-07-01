import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { IconTile } from './IconTile';
import { spacing, radius } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

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
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <IconTile icon={icon} bg={bg} fg={color} size={38} iconSize={20} />
      <View style={styles.text}>
        <AppText variant="h2" numberOfLines={1}>{value}</AppText>
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
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  text: { flex: 1 },
});
