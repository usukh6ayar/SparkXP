import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
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
import { ProgressHero } from '../../src/components/ProgressHero';
import { SkeletonRows } from '../../src/components/SkeletonRows';
import { EmptyState } from '../../src/components/EmptyState';
import { t } from '../../src/i18n';
import { spacing, radius, tints, type AppColors, skillGradients } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';
import { bounded } from '../../src/theme/responsive';

/** Idioms per page — the list pages in as you scroll (hundreds exist now). */
const PAGE_SIZE = 50;

/** Idioms list — tap a card to open the detail. Learned ones get a checkmark.
 *  Virtualised (FlatList) + infinite scroll so the full library loads in pages. */
export default function IdiomsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const router = useRouter();
  const [idioms, setIdioms] = useState<Idiom[]>([]);
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  // Next page + an in-flight guard (a ref so onEndReached can't double-fire).
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);

  // First page (fresh) + learned state.
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [r, done] = await Promise.all([
        getIdiomList(token, { page: 1, limit: PAGE_SIZE }),
        loadLearnedIdioms(),
      ]);
      setIdioms(r.items);
      setTotal(r.total);
      setLearned(done);
      pageRef.current = 1;
      setError(false);
    } catch (e) {
      console.warn('Idioms load failed:', (e as Error)?.message ?? e);
      setIdioms([]);
      setError(true);
    }
  }, [token]);

  // Append the next page when the list scrolls near the end, until all loaded.
  const loadMore = useCallback(async () => {
    if (!token || loadingMoreRef.current || idioms.length >= total) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const r = await getIdiomList(token, { page: next, limit: PAGE_SIZE });
      setIdioms((prev) => {
        // De-dup by id — the library can grow between page fetches.
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...r.items.filter((i) => !seen.has(i.id))];
      });
      setTotal(r.total);
      pageRef.current = next;
    } catch (e) {
      console.warn('Idioms loadMore failed:', (e as Error)?.message ?? e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [token, idioms.length, total]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Refresh learned state on focus (checkmarks update after visiting an idiom)
  // without resetting the scrolled-in pages.
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

  const renderItem = useCallback(
    ({ item: it }: { item: Idiom }) => {
      const isDone = learned.has(it.id);
      return (
        <Card variant="raised" onPress={() => router.push(`/idiom/${it.id}`)} padding="md" style={styles.row}>
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
    },
    [learned, colors, styles, router],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('idiomsTitle')} back showBadges={false} />
        <SkeletonRows count={6} style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('idiomsTitle')} back showBadges={false} />
      <FlatList
        data={idioms}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.container, bounded]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          idioms.length > 0 ? (
            <ProgressHero
              eyebrow={t('idiomsTitle')}
              done={doneCount}
              total={total}
              gradient={skillGradients.grammar}
              icon="chatbubbles"
            />
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <EmptyState
              icon="alert-circle-outline"
              title={t('error')}
              hint={t('errorGeneric')}
              action={{ label: t('retry'), onPress: load }}
              style={styles.empty}
            />
          ) : (
            <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
              {t('noIdioms')}
            </AppText>
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.footer} />
          ) : (
            <View style={styles.footerSpacer} />
          )
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  skeleton: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  body: { flex: 1, gap: 2 },
  empty: { marginTop: spacing.xxl },
  footer: { marginVertical: spacing.lg },
  footerSpacer: { height: 110 },
});
