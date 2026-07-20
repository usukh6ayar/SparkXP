import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { getReadingList, type ReadingPassage } from '../../src/api/reading';
import { loadCompletedReading } from '../../src/lib/readingProgress';
import { haptics } from '../../src/lib/haptics';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { ProgressRing } from '../../src/components/ProgressRing';
import { CategoryBrowser, type BrowserItem } from '../../src/components/CategoryBrowser';
import { t, tf } from '../../src/i18n';
import { spacing, radius, elevation, tints, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Reading (Унших материал), two levels via CategoryBrowser:
 *   1) сэдэв (category) — the topics authored in admin (each with a progress ring).
 *   2) the passages inside → open the reader (/reading/[id]).
 * Completion is mirrored locally (`readingProgress`) to drive the rings +
 * checkmarks; the server still owns XP. Categories come from the passages'
 * `category` field, so mobile always matches whatever сэдэв admin created.
 */
export default function ReadingListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setPassages([]); return; }
    try {
      const [r, done] = await Promise.all([getReadingList(token), loadCompletedReading()]);
      setPassages(r.items);
      setCompleted(done);
      setError(false);
    } catch (e) {
      console.warn('Reading load failed:', (e as Error)?.message ?? e);
      setPassages([]);
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Refresh completion when returning from a passage (checkmarks update live).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCompletedReading().then((done) => { if (active) setCompleted(done); });
      return () => { active = false; };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    await load();
    setRefreshing(false);
  }, [load]);

  const rows: BrowserItem[] = useMemo(
    () =>
      passages.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: `${p.cefr?.toUpperCase()} · ${p.wordCount} ${t('unitWords')} · ~${Math.max(1, Math.round(p.estimatedReadingTime / 60))} ${t('unitMin')}`,
        category: p.category,
      })),
    [passages],
  );

  // Overall progress summary shown atop the сэдэв list.
  const doneCount = useMemo(() => passages.filter((p) => completed.has(p.id)).length, [passages, completed]);
  const hero =
    !selectedCat && passages.length > 0 ? (
      <View style={styles.hero}>
        <ProgressRing progress={doneCount / passages.length} size={62} stroke={6} color={tints.green.fg}>
          <AppText variant="label" color={c.text} style={styles.heroPct}>
            {Math.round((doneCount / passages.length) * 100)}%
          </AppText>
        </ProgressRing>
        <View style={{ flex: 1 }}>
          <AppText variant="h3">{t('readingProgressTitle')}</AppText>
          <AppText variant="caption" color={c.textSecondary}>
            {tf('readingProgressSub', { done: doneCount, total: passages.length })}
          </AppText>
        </View>
      </View>
    ) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        title={selectedCat ?? t('readingMaterials')}
        back
        showBadges={false}
        onBack={selectedCat ? () => setSelectedCat(null) : undefined}
      />
      <CategoryBrowser
        items={rows}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        error={error}
        onRetry={load}
        selectedCat={selectedCat}
        onSelectCat={setSelectedCat}
        onOpen={(id) => router.push(`/reading/${id}`)}
        emptyText={t('noReadingMaterials')}
        completedIds={completed}
        hero={hero}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...(elevation.sm as object),
    },
    heroPct: { fontWeight: '800', fontSize: 13 },
  });
