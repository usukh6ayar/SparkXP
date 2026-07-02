import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { getReadingList, type ReadingPassage } from '../../src/api/reading';
import { TopBar } from '../../src/components/TopBar';
import { CategoryBrowser, type BrowserItem } from '../../src/components/CategoryBrowser';
import { t } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Reading (Унших материал), two levels via CategoryBrowser:
 *   1) сэдэв (category) — the topics authored in admin.
 *   2) the passages inside → open the reader (/reading/[id]).
 * Categories come from the passages' `category` field, so mobile always matches
 * whatever сэдэв admin created.
 */
export default function ReadingListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const c = useColors();

  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setPassages([]); return; }
    try {
      const r = await getReadingList(token);
      setPassages(r.items);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const rows: BrowserItem[] = useMemo(
    () =>
      passages.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: `${p.cefr?.toUpperCase()} · ${p.wordCount} үг · ~${Math.max(1, Math.round(p.estimatedReadingTime / 60))} мин`,
        category: p.category,
      })),
    [passages],
  );

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
  });

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
      />
    </SafeAreaView>
  );
}
