import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { PersonRow } from './PersonRow';
import { MEDAL } from '../constants/leaderboard';
import { useT } from '../settings/SettingsContext';
import { colors, spacing, radius } from '../theme/theme';

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
  const t = useT();
  const medalColor = rank <= 3 ? MEDAL[rank - 1] : null;
  return (
    <PersonRow
      name={isSelf ? `${name} ${t('youSuffix')}` : name}
      username={username}
      avatarUrl={avatarUrl}
      avatarSize={36}
      style={isSelf ? StyleSheet.flatten([styles.row, styles.rowMe]) : styles.row}
      leading={
        <View style={[styles.rankBadge, medalColor ? { backgroundColor: medalColor } : styles.rankPlain]}>
          <AppText variant="label" color={medalColor ? colors.white : colors.textSecondary}>{rank}</AppText>
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
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  rowMe: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rankBadge: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  rankPlain: { backgroundColor: colors.surfaceAlt },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
