import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../settings/SettingsContext';
import {
  getAnalyticsOverview,
  getAnalyticsHistory,
  type AnalyticsOverview,
  type AnalyticsHistory,
} from '../api/analytics';
import { spacing, radius, colors, tints, type PremiumPalette } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Range = 'week' | 'month';

/** minutes → "2ц 5м" / "45м" (localised unit). */
function fmtMinutes(min: number, t: (k: 'unitHour' | 'unitMin') => string): string {
  if (min >= 60) return `${Math.floor(min / 60)}${t('unitHour')} ${min % 60}${t('unitMin')}`;
  return `${min}${t('unitMin')}`;
}

const WEEKDAYS: Record<'mn' | 'en', string[]> = {
  mn: ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

/** Parse a `YYYY-MM-DD` day key as LOCAL midnight, so weekday/date labels read
 *  off the calendar date itself and don't shift by the device timezone. */
function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/**
 * Profile "Statistics" block — learner analytics from GET /analytics/*.
 * Self-contained: fetches its own data on focus so the profile screen just
 * drops it in. Read-only; the backend derives everything from existing activity.
 */
export function AnalyticsSection({ p }: { p: PremiumPalette }) {
  const { token } = useAuth();
  const { t, lang } = useSettings();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [ov, setOv] = useState<AnalyticsOverview | null>(null);
  const [hist, setHist] = useState<AnalyticsHistory | null>(null);
  const [range, setRange] = useState<Range>('week');
  const [error, setError] = useState(false);

  const load = useCallback(
    (r: Range) => {
      if (!token) return;
      setError(false);
      getAnalyticsOverview(token)
        .then(setOv)
        .catch((e) => {
          console.warn('Analytics load failed:', (e as Error)?.message ?? e);
          setError(true);
        });
      getAnalyticsHistory(token, r).then(setHist).catch(() => {});
    },
    [token],
  );

  useFocusEffect(useCallback(() => load(range), [load, range]));

  const setRangeAndLoad = (r: Range) => {
    setRange(r);
    if (token) getAnalyticsHistory(token, r).then(setHist).catch(() => {});
  };

  if (!ov) {
    // Don't spin forever if the request failed — offer a retry instead.
    return error ? (
      <Pressable style={styles.loading} onPress={() => load(range)}>
        <AppText variant="body" color={p.textMuted}>{t('analyticsError')}</AppText>
        <AppText variant="label" color={p.primary}>{t('retry')}</AppText>
      </Pressable>
    ) : (
      <View style={styles.loading}>
        <ActivityIndicator color={p.primary} />
      </View>
    );
  }

  const tiles: { icon: IconName; value: string | number; label: string; tint: { bg: string; fg: string } }[] = [
    { icon: 'time', value: fmtMinutes(ov.study.totalMinutes, t), label: t('statStudyTime'), tint: tints.blue },
    { icon: 'book', value: ov.lessons.completed, label: t('statLessonsDone'), tint: tints.purple },
    { icon: 'text', value: ov.vocabulary.learned, label: t('statWordsLearned'), tint: tints.green },
    { icon: 'ribbon', value: ov.vocabulary.mastered, label: t('statWordsMastered'), tint: tints.orange },
    { icon: 'chatbubbles', value: fmtMinutes(ov.buddy.minutes, t), label: t('statBuddyMin'), tint: tints.pink },
    { icon: 'barbell', value: ov.practice.sessions, label: t('statPractice'), tint: tints.blue },
    { icon: 'star', value: ov.gamification.stars, label: t('statStars'), tint: tints.orange },
    { icon: 'flame', value: ov.gamification.longestStreak, label: t('statLongestStreak'), tint: tints.pink },
    { icon: 'flash', value: ov.gamification.xp, label: t('statXp'), tint: tints.purple },
  ];

  // Chart: XP per day. Scale bars to the busiest day (min 1 to avoid /0).
  const days = hist?.days ?? [];
  const maxXp = Math.max(1, ...days.map((d) => d.xp));
  const wd = WEEKDAYS[lang === 'en' ? 'en' : 'mn'];

  return (
    <View>
      {/* Metrics grid */}
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <View style={[styles.tileIcon, { backgroundColor: tile.tint.bg }]}>
              <Ionicons name={tile.icon} size={18} color={tile.tint.fg} />
            </View>
            <AppText variant="h3" color={p.text} numberOfLines={1}>{tile.value}</AppText>
            <AppText variant="caption" color={p.textMuted} numberOfLines={1}>{tile.label}</AppText>
          </View>
        ))}
      </View>

      {/* Activity chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHead}>
          <AppText variant="bodyStrong" color={p.text}>{t('activityTitle')}</AppText>
          <View style={styles.toggle}>
            {(['week', 'month'] as Range[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRangeAndLoad(r)}
                style={[styles.togglePill, range === r && styles.togglePillOn]}
              >
                <AppText variant="caption" color={range === r ? colors.white : p.textSecondary}>
                  {t(r === 'week' ? 'activityWeek' : 'activityMonth')}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.bars}>
          {days.map((d, i) => (
            <View key={d.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { height: `${Math.max((d.xp / maxXp) * 100, d.xp > 0 ? 8 : 2)}%`, backgroundColor: d.xp > 0 ? p.primary : p.divider },
                  ]}
                />
              </View>
              {range === 'week' ? (
                <AppText variant="overline" color={p.textMuted}>{wd[parseDay(d.date).getDay()]}</AppText>
              ) : i % 6 === 0 ? (
                <AppText variant="overline" color={p.textMuted}>{parseDay(d.date).getDate()}</AppText>
              ) : (
                <View style={styles.barLabelGap} />
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (p: PremiumPalette) =>
  StyleSheet.create({
    loading: { paddingVertical: spacing.xl, alignItems: 'center' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: {
      width: '31%',
      flexGrow: 1,
      gap: 4,
      backgroundColor: p.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: p.cardBorder,
      padding: spacing.md,
    },
    tileIcon: {
      width: 34, height: 34, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center', marginBottom: 2,
    },

    chartCard: {
      backgroundColor: p.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: p.cardBorder,
      padding: spacing.lg,
      marginTop: spacing.md,
    },
    chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    toggle: { flexDirection: 'row', backgroundColor: p.track, borderRadius: radius.full, padding: 3, gap: 2 },
    togglePill: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full },
    togglePillOn: { backgroundColor: p.primary },

    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 108 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barTrack: { flex: 1, width: '100%', maxWidth: 22, justifyContent: 'flex-end', alignSelf: 'center' },
    barFill: { width: '100%', borderRadius: radius.sm, minHeight: 3 },
    barLabelGap: { height: 12 },
  });
