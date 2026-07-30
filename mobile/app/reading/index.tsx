import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { getReadingList, type ReadingPassage } from '../../src/api/reading';
import { loadCompletedReading } from '../../src/lib/readingProgress';
import { haptics } from '../../src/lib/haptics';
import { TopBar } from '../../src/components/TopBar';
import { ProgressHero } from '../../src/components/ProgressHero';
import { CategoryBrowser, type BrowserItem } from '../../src/components/CategoryBrowser';
import { t } from '../../src/i18n';
import { type AppColors, skillGradients } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Reading (Унших материал), two levels via CategoryBrowser:
 *   1) сэдэв (category) — the topics authored in admin, under a progress hero.
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
  // Same gradient banner the skill screens use, so Унших does not look like a
  // different app from Сонсгол / Ярих / Бичих.
  const hero =
    !selectedCat && passages.length > 0 ? (
      <ProgressHero
        eyebrow={t('catReading')}
        done={doneCount}
        total={passages.length}
        gradient={skillGradients.reading}
        icon="book"
      />
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
  });
