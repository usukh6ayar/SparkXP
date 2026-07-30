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
 * "Mastered" vs "learning" comes from the server's SM-2 state (`WordReview`),
 * NOT from anything counted on the client — a locally tallied number drifts the
 * moment the student uses a second device, and vocabulary size is exactly the
 * figure learners screenshot and compare.
 *
 * `stats === null` renders skeletons, so the card never flashes a "0 words
 * known" that is really just "still loading".
 */
export function VocabStats({ stats }: { stats: ReviewStats | null }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const total = stats ? stats.known + stats.learning : 0;
  const mastery = total > 0 ? (stats!.known / total) : 0;

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
              {tf('vocabStatsSub', { n: total })}
            </AppText>
          ) : (
            <Skeleton width={120} height={12} />
          )}
        </View>
      </View>

      {/* Mastery indicator — share of encountered words that are now "known". */}
      {stats ? (
        <>
          <ProgressBar value={mastery} height={8} color={c.success} />
          <View style={styles.legend}>
            <Legend color={c.success} label={t('knownLabel')} value={stats.known} styles={styles} />
            <Legend color={c.streak} label={t('vocabLearning')} value={stats.learning} styles={styles} />
            <AppText variant="label" color={c.success}>
              {Math.round(mastery * 100)}%
            </AppText>
          </View>
        </>
      ) : (
        <Skeleton height={8} radius={radius.full} />
      )}
    </View>
  );
}

/** One coloured dot + label + count in the legend row. */
function Legend({
  color, label, value, styles,
}: {
  color: string;
  label: string;
  value: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="caption">{label}</AppText>
      <AppText variant="label">{value}</AppText>
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
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});
