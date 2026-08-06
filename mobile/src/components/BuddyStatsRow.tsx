import { View, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';
import { t } from '../i18n';
import type { BuddyStatistics } from '../api/ai';

/**
 * AI Buddy practice-time summary shown on the buddy picker: minutes practised
 * today / all-time and total conversations. Renders nothing until there is at
 * least one finished session, so a new user sees no empty zeros.
 */
export function BuddyStatsRow({ stats }: { stats: BuddyStatistics | null }) {
  const c = useColors();
  const styles = makeStyles(c);
  if (!stats || stats.totalSessions <= 0) return null;

  const cells: { value: number; label: string }[] = [
    { value: stats.todayMinutes, label: t('buddyStatToday') },
    { value: stats.totalMinutes, label: t('buddyStatTotal') },
    { value: stats.totalSessions, label: t('buddyStatSessions') },
  ];

  return (
    <View style={styles.row}>
      {cells.map((cell, i) => (
        <View key={cell.label} style={[styles.cell, i > 0 && styles.cellBorder]}>
          <AppText variant="h2" color={c.primary}>{cell.value}</AppText>
          <AppText variant="caption" color={c.textSecondary} numberOfLines={1}>{cell.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: spacing.md,
    },
    cell: { flex: 1, alignItems: 'center', gap: 2 },
    cellBorder: { borderLeftWidth: 1, borderLeftColor: c.border },
  });
