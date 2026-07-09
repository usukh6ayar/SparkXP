import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { getAchievements, type Achievements, type Trophy } from '../src/api/achievements';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { AppImage } from '../src/components/AppImage';
import { Loading } from '../src/components/Loading';
import { EmptyState } from '../src/components/EmptyState';
import { ProgressBar } from '../src/components/ProgressBar';
import { spacing, radius, type AppColors } from '../src/theme/theme';
import { useColors } from '../src/settings/SettingsContext';

/** Mongolian tier labels (catalog tiers → display). */
const TIER_LABEL: Record<string, string> = {
  starter: 'Эхлэл', bronze: 'Хүрэл', silver: 'Мөнгө', gold: 'Алт',
  sapphire: 'Индранил', crystal: 'Болор', ruby: 'Бадмаараг',
  emerald: 'Маргад', mythic: 'Домогт', celestial: 'Тэнгэрлэг',
};

export default function AchievementsScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = makeStyles(c);
  const [data, setData] = useState<Achievements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await getAchievements(token));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={[styles.safe]} edges={['top']}>
      <TopBar title="Цом" back showBadges={false} />

      {loading ? (
        <Loading />
      ) : error || !data ? (
        <EmptyState
          icon="alert-circle-outline"
          title="Ачаалж чадсангүй"
          hint="Дахин оролдоно уу"
          action={{ label: 'Дахин', onPress: load }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Progress summary */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Ionicons name="trophy" size={22} color={c.xp} />
              <AppText variant="h2">
                {data.earned}
                <AppText variant="h3" color={c.textMuted}> / {data.total}</AppText>
              </AppText>
              <AppText variant="caption" color={c.textMuted} style={styles.summaryLabel}>
                цуглуулсан цом
              </AppText>
            </View>
            <ProgressBar value={data.total ? data.earned / data.total : 0} height={8} />
          </View>

          {/* Trophies grouped by tier */}
          {data.tiers.map((tier) => {
            const items = data.trophies.filter((tr) => tr.tier === tier);
            if (!items.length) return null;
            const earned = items.filter((tr) => tr.earned).length;
            return (
              <View key={tier} style={styles.tier}>
                <View style={styles.tierHead}>
                  <AppText variant="h3">{TIER_LABEL[tier] ?? tier}</AppText>
                  <AppText variant="caption" color={c.textMuted}>{earned}/{items.length}</AppText>
                </View>
                <View style={styles.grid}>
                  {items.map((tr) => <TrophyCell key={tr.slug} trophy={tr} styles={styles} c={c} />)}
                </View>
              </View>
            );
          })}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TrophyCell({ trophy, styles, c }: { trophy: Trophy; styles: ReturnType<typeof makeStyles>; c: AppColors }) {
  return (
    <View style={styles.cell}>
      <View style={[styles.badge, !trophy.earned && styles.badgeLocked]}>
        <AppImage
          source={{ uri: trophy.thumb }}
          width={72}
          contentFit="contain"
          style={[styles.badgeImg, !trophy.earned && styles.imgLocked]}
        />
        {!trophy.earned && (
          <View style={styles.lock}>
            <Ionicons name="lock-closed" size={16} color={c.white} />
          </View>
        )}
      </View>
      <AppText
        variant="caption"
        color={trophy.earned ? c.text : c.textMuted}
        numberOfLines={2}
        style={styles.name}
      >
        {trophy.name}
      </AppText>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  container: { padding: spacing.lg },
  summary: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryLabel: { marginLeft: 'auto' },
  tier: { marginBottom: spacing.xl },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '30%', alignItems: 'center', gap: 6 },
  badge: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeLocked: { opacity: 0.9 },
  badgeImg: { width: '86%', height: '86%' },
  imgLocked: { opacity: 0.25 },
  lock: {
    position: 'absolute',
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { textAlign: 'center', minHeight: 30 },
});
