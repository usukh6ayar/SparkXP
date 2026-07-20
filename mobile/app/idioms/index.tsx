import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppImage } from '../../src/components/AppImage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getIdiomList, type Idiom } from '../../src/api/idioms';
import { loadLearnedIdioms } from '../../src/lib/idiomProgress';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { ProgressRing } from '../../src/components/ProgressRing';
import { SkeletonRows } from '../../src/components/SkeletonRows';
import { EmptyState } from '../../src/components/EmptyState';
import { t, tf } from '../../src/i18n';
import { spacing, radius, elevation, tints, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/** Idioms list — tap a card to open the detail. Learned ones get a checkmark. */
export default function IdiomsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const router = useRouter();
  const [idioms, setIdioms] = useState<Idiom[]>([]);
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [r, done] = await Promise.all([getIdiomList(token), loadLearnedIdioms()]);
      setIdioms(r.items);
      setLearned(done);
      setError(false);
    } catch (e) {
      console.warn('Idioms load failed:', (e as Error)?.message ?? e);
      setIdioms([]);
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Refresh learned state when returning from an idiom (checkmarks update live).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadLearnedIdioms().then((done) => { if (active) setLearned(done); });
      return () => { active = false; };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const doneCount = useMemo(() => idioms.filter((it) => learned.has(it.id)).length, [idioms, learned]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('idiomsTitle')} back showBadges={false} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <SkeletonRows count={6} />
        ) : error ? (
          <EmptyState
            icon="alert-circle-outline"
            title={t('error')}
            hint={t('errorGeneric')}
            action={{ label: t('retry'), onPress: load }}
            style={styles.empty}
          />
        ) : idioms.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            {t('noIdioms')}
          </AppText>
        ) : (
          <>
            {/* Progress summary */}
            <View style={styles.hero}>
              <ProgressRing progress={doneCount / idioms.length} size={62} stroke={6} color={tints.green.fg}>
                <AppText variant="label" color={colors.text} style={styles.heroPct}>
                  {Math.round((doneCount / idioms.length) * 100)}%
                </AppText>
              </ProgressRing>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{t('readingProgressTitle')}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {tf('idiomsProgressSub', { done: doneCount, total: idioms.length })}
                </AppText>
              </View>
            </View>

            {idioms.map((it) => {
              const isDone = learned.has(it.id);
              return (
                <Card key={it.id} variant="raised" onPress={() => router.push(`/idiom/${it.id}`)} padding="md" style={styles.row}>
                  {it.imageUrl ? (
                    <AppImage source={{ uri: it.imageUrl }} width={140} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Ionicons name="chatbubbles" size={22} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.body}>
                    <AppText variant="h3" numberOfLines={1}>{it.phrase}</AppText>
                    <AppText variant="caption" numberOfLines={1}>{it.mongolian}</AppText>
                  </View>
                  {it.audioUrl ? <Ionicons name="volume-high" size={18} color={colors.primary} /> : null}
                  {isDone ? (
                    <Ionicons name="checkmark-circle" size={22} color={tints.green.fg} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
                  )}
                </Card>
              );
            })}
          </>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...(elevation.sm as object),
  },
  heroPct: { fontWeight: '800', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  body: { flex: 1, gap: 2 },
  empty: { marginTop: spacing.xxl },
});
