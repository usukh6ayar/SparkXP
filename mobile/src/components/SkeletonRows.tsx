import { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';
import { Skeleton } from './Skeleton';

/**
 * Ghost-loading placeholder for a row list (icon circle + title/subtitle
 * lines) — matches the row shape shared by CategoryBrowser, saved words,
 * idioms, leaderboard and assignments lists.
 */
export function SkeletonRows({ count = 5, style }: { count?: number; style?: ViewStyle }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.listCard, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
          <Skeleton width={44} height={44} radius={radius.md} />
          <View style={styles.lines}>
            <Skeleton width="70%" height={15} />
            <Skeleton width="40%" height={12} style={{ marginTop: spacing.xs }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    listCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    rowBorder: { borderTopWidth: 1, borderTopColor: c.border },
    lines: { flex: 1 },
  });
