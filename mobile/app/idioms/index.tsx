import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getIdiomList, type Idiom } from '../../src/api/idioms';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { SkeletonRows } from '../../src/components/SkeletonRows';
import { EmptyState } from '../../src/components/EmptyState';
import { t } from '../../src/i18n';
import { colors, spacing, radius } from '../../src/theme/theme';

/** Idioms list — tap a card to open the detail. */
export default function IdiomsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [idioms, setIdioms] = useState<Idiom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await getIdiomList(token);
      setIdioms(r.items);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('idiomsTitle')} back />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <AppText variant="caption" style={styles.subtitle}>
          {t('idiomsSubtitle')}
        </AppText>

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
          idioms.map((it) => (
            <Card key={it.id} variant="raised" onPress={() => router.push(`/idiom/${it.id}`)} padding="md" style={styles.row}>
              {it.imageUrl ? (
                <Image source={{ uri: it.imageUrl }} style={styles.thumb} />
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
              <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
            </Card>
          ))
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  subtitle: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  body: { flex: 1, gap: 2 },
  empty: { marginTop: spacing.xxl },
});
