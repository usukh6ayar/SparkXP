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

const WEEK = 7;
/** Height the weekday/date labels take under each bar (text + its 4pt gap). */
const BAR_LABEL_H = 16;

/**
 * This week against the one before it.
 *
 * The backend seeds every day in the range to zero and returns them oldest →
 * newest (`analytics.service.ts` → `history`), so the last 7 entries are always
 * this week and the 7 before them always last week — no date maths needed, and
 * a quiet day counts as the zero it was.
 */
function weekOverWeek(days: { xp: number }[]) {
  const sum = (list: { xp: number }[]) => list.reduce((n, d) => n + d.xp, 0);
  const current = sum(days.slice(-WEEK));
  const previous = days.length >= WEEK * 2 ? sum(days.slice(-WEEK * 2, -WEEK)) : 0;
  return {
    current,
    previous,
    /** Percent change, or `null` when there is no previous week to divide by. */
    changePct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
    /** Last week's daily average — drawn on the chart as the line to beat. */
    previousAvg: previous / WEEK,
  };
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

  /**
   * Always fetch the 30-day series, whichever range is on screen.
   *
   * The week view is the last 7 of those same days (both ranges bucket by the
   * identical UB day keys server-side), and comparing this week with the one
   * before it needs 14 — so one request now serves the chart AND the
   * comparison, where refetching per toggle served neither.
   */
  const load = useCallback(() => {
    if (!token) return;
    setError(false);
    getAnalyticsOverview(token)
      .then(setOv)
      .catch((e) => {
        console.warn('Analytics load failed:', (e as Error)?.message ?? e);
        setError(true);
      });
    getAnalyticsHistory(token, 'month').then(setHist).catch(() => {});
  }, [token]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!ov) {
    // Don't spin forever if the request failed — offer a retry instead.
    return error ? (
      <Pressable style={styles.loading} onPress={load}>
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
  const allDays = hist?.days ?? [];
  const days = range === 'week' ? allDays.slice(-WEEK) : allDays;
  const maxXp = Math.max(1, ...days.map((d) => d.xp));
  const wd = WEEKDAYS[lang === 'en' ? 'en' : 'mn'];

  const week = weekOverWeek(allDays);
  const up = week.changePct !== null && week.changePct > 0;
  const flat = week.changePct === 0;
  const trendColor = flat ? p.textMuted : up ? tints.green.fg : tints.orange.fg;
  // Where last week's daily average sits on this chart, as a % of its height.
  // Only meaningful on the week view — on the month view the bars already span
  // both weeks, so a "last week" line would cut through its own data.
  const avgLinePct =
    range === 'week' && week.previousAvg > 0
      ? Math.min(100, (week.previousAvg / maxXp) * 100)
      : null;

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
                onPress={() => setRange(r)}
                style={[styles.togglePill, range === r && styles.togglePillOn]}
              >
                <AppText variant="caption" color={range === r ? colors.white : p.textSecondary}>
                  {t(r === 'week' ? 'activityWeek' : 'activityMonth')}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
        {/* This week against last — the chart alone shows activity but never
            answers "am I doing more than before?", which is the whole point of
            a progress section. */}
        <View style={styles.compare}>
          <View>
            <AppText variant="caption" color={p.textMuted}>{t('progressThisWeek')}</AppText>
            <AppText variant="h2" color={p.text}>{week.current} XP</AppText>
          </View>
          <View style={styles.compareRight}>
            {week.changePct === null ? (
              <AppText variant="caption" color={p.textMuted}>{t('progressFirstWeek')}</AppText>
            ) : (
              <>
                <View style={styles.trend}>
                  <Ionicons
                    name={flat ? 'remove' : up ? 'arrow-up' : 'arrow-down'}
                    size={16}
                    color={trendColor}
                  />
                  <AppText variant="bodyStrong" color={trendColor}>
                    {flat ? t('progressSame') : `${Math.abs(week.changePct)}%`}
                  </AppText>
                </View>
                <AppText variant="caption" color={p.textMuted}>
                  {t('progressPrevWeek').replace('{xp}', String(week.previous))}
                </AppText>
              </>
            )}
          </View>
        </View>

        <View style={styles.bars}>
          {/* Last week's daily average — the line to beat. Sits behind the bars
              so a day that clears it reads at a glance. The wrapper stops above
              the weekday labels, so the percentage is measured against the bar
              track and not the whole row. */}
          {avgLinePct !== null ? (
            <View pointerEvents="none" style={styles.avgWrap}>
              <View style={[styles.avgLine, { bottom: `${avgLinePct}%` }]}>
                <View style={[styles.avgDash, { borderColor: p.textMuted }]} />
                <AppText variant="overline" color={p.textMuted}>{t('progressPrevAvg')}</AppText>
              </View>
            </View>
          ) : null}
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

    compare: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    compareRight: { alignItems: 'flex-end', gap: 2 },
    trend: { flexDirection: 'row', alignItems: 'center', gap: 2 },

    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 108 },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barTrack: { flex: 1, width: '100%', maxWidth: 22, justifyContent: 'flex-end', alignSelf: 'center' },
    barFill: { width: '100%', borderRadius: radius.sm, minHeight: 3 },
    barLabelGap: { height: 12 },

    // Confined to the bar track: `bars` also holds the weekday labels (12pt of
    // text + a 4pt gap), and a percentage measured over those would float the
    // line above where its value actually is.
    avgWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: BAR_LABEL_H },
    avgLine: { position: 'absolute', left: 0, right: 0, alignItems: 'flex-end' },
    avgDash: { width: '100%', borderTopWidth: 1, borderStyle: 'dashed', opacity: 0.6 },
  });
