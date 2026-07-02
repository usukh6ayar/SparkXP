import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { PersonRow } from './PersonRow';
import { MEDAL } from '../constants/leaderboard';
import { colors, spacing, radius } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/** One leaderboard entry: rank badge (medal for top 3), avatar, name, XP. */
export function LeaderboardRow({
  rank,
  name,
  username,
  avatarUrl,
  xp,
  isSelf,
}: {
  rank: number;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  xp: number;
  isSelf?: boolean;
}) {
  const c = useColors();
  const medalColor = rank <= 3 ? MEDAL[rank - 1] : null;
  return (
    <PersonRow
      name={isSelf ? `${name} (Та)` : name}
      username={username}
      avatarUrl={avatarUrl}
      avatarSize={36}
      style={StyleSheet.flatten([
        styles.row,
        { backgroundColor: c.surface, borderColor: c.border },
        isSelf && { borderColor: colors.primary, backgroundColor: c.primarySoft },
      ])}
      leading={
        <View style={[styles.rankBadge, { backgroundColor: medalColor ?? c.surfaceAlt }]}>
          <AppText variant="label" color={medalColor ? colors.white : c.textSecondary}>{rank}</AppText>
        </View>
      }
      right={
        <View style={styles.xp}>
          <Ionicons name="flash" size={13} color={colors.xp} />
          <AppText variant="bodyStrong" color={colors.primary}>{xp}</AppText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1,
  },
  rankBadge: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
