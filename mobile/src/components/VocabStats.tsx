import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { ProgressBar } from './ProgressBar';
import { Skeleton } from './Skeleton';
import { type ReviewStats } from '../api/reviews';
import { t, tf } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/**
 * Lifetime vocabulary progress, from `GET /reviews/stats`.
 *
 * `stats === null` renders skeletons, so the card never flashes a "0 words
 * known" that is really just "still loading".
 */
export function VocabStats({ stats }: { stats: ReviewStats | null }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const hasSrsBuckets =
    stats?.new !== undefined &&
    stats.young !== undefined &&
    stats.mature !== undefined &&
    stats.dueNow !== undefined;
  const buckets = stats
    ? {
        new: hasSrsBuckets ? (stats.new ?? 0) : 0,
        learning: stats.learning,
        young: hasSrsBuckets ? (stats.young ?? 0) : stats.known,
        mature: hasSrsBuckets ? (stats.mature ?? 0) : 0,
        dueNow: stats.dueNow ?? 0,
      }
    : null;
  const total = buckets
    ? buckets.new + buckets.learning + buckets.young + buckets.mature
    : 0;
  const primaryCount = hasSrsBuckets ? buckets!.mature : stats?.known ?? 0;
  const primaryShare = total > 0 ? primaryCount / total : 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name="library" size={18} color={c.primary} />
        </View>
        <View style={styles.headText}>
          <AppText variant="h3">{t('vocabStatsTitle')}</AppText>
          {stats ? (
            <AppText variant="caption" color={c.textSecondary}>
              {total > 0 ? tf('vocabStatsSub', { n: total }) : t('vocabEmpty')}
            </AppText>
          ) : (
            <Skeleton width={120} height={12} />
          )}
        </View>
      </View>

      {!stats ? (
        <Skeleton height={8} radius={radius.full} />
      ) : total === 0 ? (
        // A 0% bar over two zeroes reads as "you have failed", not "you have
        // not started". Say which it is.
        <AppText variant="caption" color={c.textMuted}>{t('vocabEmptyHint')}</AppText>
      ) : (
        <>
          {/* The bar's own caption — this is what the percentage is a share OF. */}
          <View style={styles.ratioRow}>
            <AppText variant="caption" color={c.textSecondary} style={styles.ratioText}>
              {hasSrsBuckets
                ? tf('vocabMasteryRatio', { mature: buckets!.mature, total })
                : tf('vocabKnownRatio', { known: stats.known, total })}
            </AppText>
            <AppText variant="label" color={c.success}>
              {Math.round(primaryShare * 100)}%
            </AppText>
          </View>
          <ProgressBar value={primaryShare} height={8} color={c.success} />
          <View style={styles.legend}>
            {hasSrsBuckets ? (
              <>
                <Legend
                  color={c.primary}
                  label={t('vocabNew')}
                  hint={t('vocabNewHint')}
                  value={buckets!.new}
                  styles={styles}
                />
                <Legend
                  color={c.streak}
                  label={t('vocabLearning')}
                  hint={t('vocabLearningHint')}
                  value={buckets!.learning}
                  styles={styles}
                />
                <Legend
                  color={c.xp}
                  label={t('vocabYoung')}
                  hint={tf('vocabYoungHint', { days: stats.masteryThresholdDays ?? 21 })}
                  value={buckets!.young}
                  styles={styles}
                />
                <Legend
                  color={c.success}
                  label={t('vocabMature')}
                  hint={tf('vocabMatureHint', { days: stats.masteryThresholdDays ?? 21 })}
                  value={buckets!.mature}
                  styles={styles}
                />
              </>
            ) : (
              <>
                <Legend
                  color={c.success}
                  label={t('knownLabel')}
                  hint={t('vocabKnownHint')}
                  value={stats.known}
                  styles={styles}
                />
                <Legend
                  color={c.streak}
                  label={t('vocabLearning')}
                  hint={t('vocabLearningHint')}
                  value={stats.learning}
                  styles={styles}
                />
              </>
            )}
          </View>
          {hasSrsBuckets && buckets!.dueNow > 0 ? (
            <AppText variant="caption" color={c.textMuted}>
              {tf('vocabDueNow', { n: buckets!.dueNow })}
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}

/** One legend entry: coloured dot + count + what that bucket actually means.
 *  The hint is the whole point — a lone "5" beside "Сурч байгаа" is a riddle. */
function Legend({
  color, label, hint, value, styles,
}: {
  color: string;
  label: string;
  hint: string;
  value: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  const c = useColors();
  return (
    <View style={styles.legendItem}>
      <View style={styles.legendHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText variant="label" color={color}>{value}</AppText>
        <AppText variant="caption" numberOfLines={1} style={styles.legendLabel}>{label}</AppText>
      </View>
      <AppText variant="caption" color={c.textMuted}>{hint}</AppText>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  card: {
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headIcon: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  headText: { flex: 1, gap: 2 },
  // Caption + percentage on one line, directly above the bar they describe.
  ratioRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  ratioText: { flex: 1 },
  // Two equal columns, not a tight row: each entry now carries a second line of
  // explanation, so they need real width to sit side by side without wrapping
  // into each other.
  legend: { flexDirection: 'row', gap: spacing.md },
  legendItem: { flex: 1, gap: 1 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLabel: { flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});
