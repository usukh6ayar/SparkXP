import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { getLeaderboard, type Period, type Scope, type LeaderboardResult } from '../src/api/leaderboard';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { PeriodTabs } from '../src/components/PeriodTabs';
import { LeaderboardRow } from '../src/components/LeaderboardRow';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { EmptyState } from '../src/components/EmptyState';
import { PERIODS } from '../src/constants/leaderboard';
import { t } from '../src/i18n';
import { colors, spacing, radius } from '../src/theme/theme';

function scopes(): { key: Scope; label: string }[] {
  return [
    { key: 'teacher', label: t('scopeClass') },
    { key: 'global', label: t('scopeGlobal') },
    { key: 'province', label: t('scopeProvince') },
    { key: 'district', label: t('scopeDistrict') },
  ];
}

export default function LeaderboardScreen() {
  const { token, user } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [scope, setScope] = useState<Scope>('global');
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await getLeaderboard(token, period, scope));
      setError(false);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token, period, scope]);

  useEffect(() => { load(); }, [load]);
  const SCOPES = scopes();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('leaderboardTitle')} back />

      {/* Period segmented control */}
      <PeriodTabs value={period} options={PERIODS} onChange={setPeriod} style={styles.tabs} />

      {/* Scope chips */}
      <View style={styles.chips}>
        {SCOPES.map((s) => {
          const active = scope === s.key;
          return (
            <Pressable
              key={s.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setScope(s.key)}
            >
              <AppText variant="label" color={active ? colors.white : colors.textSecondary}>{s.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <SkeletonRows count={6} style={styles.skeleton} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* My standing */}
          <View style={styles.meCard}>
            <View style={styles.meRankWrap}>
              <AppText variant="h3" color={colors.sparks}>{data?.me?.rank ? `#${data.me.rank}` : '—'}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={colors.textOnDarkMuted}>{t('myStanding')}</AppText>
              <AppText variant="h3" color={colors.white} numberOfLines={1}>{user?.fullName}</AppText>
            </View>
            <View style={styles.meXp}>
              <Ionicons name="flash" size={14} color={colors.xp} />
              <AppText variant="bodyStrong" color={colors.white}>{data?.me?.xp ?? 0}</AppText>
            </View>
          </View>

          {error ? (
            <EmptyState
              icon="alert-circle-outline"
              title={t('error')}
              hint={t('errorGeneric')}
              action={{ label: t('retry'), onPress: load }}
              style={styles.empty}
            />
          ) : !data || data.entries.length === 0 ? (
            <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
              {t('noLeaderboardData')}
            </AppText>
          ) : (
            data.entries.map((e) => (
              <LeaderboardRow
                key={e.userId}
                rank={e.rank}
                name={e.fullName}
                username={e.username}
                avatarUrl={e.avatarUrl}
                xp={e.xp}
                isSelf={e.userId === user?.id}
              />
            ))
          )}
          <View style={{ height: 110 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabs: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginVertical: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.navy },
  list: { paddingHorizontal: spacing.lg },
  skeleton: { marginHorizontal: spacing.lg },
  meCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  meRankWrap: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  meXp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { marginTop: spacing.xxl },
});
