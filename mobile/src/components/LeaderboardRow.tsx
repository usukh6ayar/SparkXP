import { View, StyleSheet } from 'react-native';
import { AppIcon } from './AppIcon';
import { AppText } from './Text';
import { PersonRow } from './PersonRow';
import { MEDAL } from '../constants/leaderboard';
import { useT, useColors } from '../settings/SettingsContext';
import { colors, spacing, radius } from '../theme/theme';

/** One leaderboard entry: rank badge (medal for top 3), avatar, name, XP. */
export function LeaderboardRow({
  rank,
  name,
  username,
  avatarUrl,
  xp,
  isSelf,
  onPress,
}: {
  rank: number;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  xp: number;
  isSelf?: boolean;
  onPress?: () => void;
}) {
  const t = useT();
  const c = useColors();
  const medalColor = rank <= 3 ? MEDAL[rank - 1] : null;
  return (
    <PersonRow
      name={isSelf ? `${name} ${t('youSuffix')}` : name}
      username={username}
      avatarUrl={avatarUrl}
      avatarSize={36}
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.row,
        { backgroundColor: c.surface, borderColor: c.border },
        // Top-3 get a soft coloured glow so the podium reads at a glance.
        medalColor && { borderColor: medalColor, shadowColor: medalColor, ...styles.medalGlow },
        // The current user's own row gets a thin left accent bar instead of a full
        // box — their standing is already shown in the pinned "my standing" card
        // above, so a second boxed highlight would read as a duplicate. A slim
        // accent + the "(Та)" name suffix is enough to spot their row.
        isSelf && styles.selfAccent,
      ])}
      leading={
        <View style={[styles.rankBadge, { backgroundColor: medalColor ?? c.surfaceAlt }]}>
          <AppText variant="label" color={medalColor ? colors.white : c.textSecondary}>{rank}</AppText>
        </View>
      }
      right={
        <View style={styles.xp}>
          <AppIcon name="xp" size={14} />
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
  // Thin purple bar on the left edge marks the current user's row (no full box).
  selfAccent: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.md - 2 },
  rankBadge: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  medalGlow: { shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
