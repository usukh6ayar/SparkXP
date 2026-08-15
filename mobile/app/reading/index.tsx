import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { getReadingList, type ReadingPassage } from '../../src/api/reading';
import {
  loadReadingStates,
  completedIdsFrom,
  readShare,
  type ReadingState,
} from '../../src/lib/readingProgress';
import { loadSavedWords, newWordCount } from '../../src/lib/newWords';
import { haptics } from '../../src/lib/haptics';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { ProgressHero } from '../../src/components/ProgressHero';
import { ContinueReading } from '../../src/components/reading/ContinueReading';
import { CategoryBrowser, type BrowserItem } from '../../src/components/CategoryBrowser';
import { t, tf } from '../../src/i18n';
import { spacing, radius, skillGradients, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Reading (Унших материал) — the library, in three parts:
 *   0) "Үргэлжлүүлэх" — the passage last left unfinished (server bookmark).
 *   1) сэдэв (category) — the topics authored in admin, under a progress hero,
 *      filterable by CEFR level.
 *   2) the passages inside → open the reader (/reading/[id]).
 *
 * Progress comes from the server (`GET /reading/progress`) so a passage started
 * on one device continues on another; the local mirror only backs it up when
 * offline (see `lib/readingProgress`). Categories come from the passages' own
 * `category` field, so mobile always matches whatever сэдэв admin created.
 */
export default function ReadingListScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [states, setStates] = useState<Map<string, ReadingState>>(new Map());
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  /** CEFR filter, null = бүх түвшин. */
  const [level, setLevel] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setPassages([]); return; }
    try {
      const [r, progress, saved] = await Promise.all([
        getReadingList(token),
        loadReadingStates(token),
        loadSavedWords(token),
      ]);
      setPassages(r.items);
      setStates(progress);
      setSavedWords(saved);
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

  // Refresh progress when returning from a passage (checkmarks + the continue
  // card update live, without re-fetching the whole library). Saved words come
  // along because starring one inside the reader changes the "шинэ үг" counts —
  // it is a cache hit unless that actually happened (see `lib/newWords`).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadReadingStates(token).then((s) => { if (active) setStates(s); });
      loadSavedWords(token).then((w) => { if (active) setSavedWords(w); });
      return () => { active = false; };
    }, [token]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    await load();
    setRefreshing(false);
  }, [load]);

  const completed = useMemo(() => completedIdsFrom(states), [states]);

  /** The CEFR levels actually present, in the ladder's own order. */
  const levels = useMemo(() => {
    const order = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
    const present = new Set(passages.map((p) => p.cefr?.toLowerCase()).filter(Boolean));
    return order.filter((l) => present.has(l));
  }, [passages]);

  const visible = useMemo(
    () => (level ? passages.filter((p) => p.cefr?.toLowerCase() === level) : passages),
    [passages, level],
  );

  const rows: BrowserItem[] = useMemo(
    () =>
      visible.map((p) => {
        const state = states.get(p.id);
        const share = readShare(state, p.sentences?.length ?? 0);
        const meta = [
          p.cefr?.toUpperCase(),
          `${p.wordCount} ${t('unitWords')}`,
          `~${Math.max(1, Math.round(p.estimatedReadingTime / 60))} ${t('unitMin')}`,
        ];
        // One extra fact per row, whichever is the more useful right now: how
        // far in you are if you started, otherwise what it can teach you.
        if (share > 0 && share < 1) meta.push(`${Math.round(share * 100)}% ${t('readingReadShare')}`);
        else {
          const fresh = newWordCount(p.keyVocab, savedWords);
          if (fresh > 0) meta.push(tf('newWordsCount', { n: fresh }));
        }
        return { id: p.id, title: p.title, subtitle: meta.join(' · '), category: p.category };
      }),
    [visible, states, savedWords],
  );

  // Overall progress summary shown atop the сэдэв list.
  const doneCount = useMemo(
    () => visible.filter((p) => completed.has(p.id)).length,
    [visible, completed],
  );

  /** Most recently touched passage that is started but not finished. */
  const continuePassage = useMemo(() => {
    let best: { passage: ReadingPassage; state: ReadingState } | null = null;
    for (const p of passages) {
      const state = states.get(p.id);
      if (!state || state.completed || state.sentenceIndex <= 0) continue;
      if (!best || state.rank < best.state.rank) best = { passage: p, state };
    }
    return best;
  }, [passages, states]);

  // Everything above the сэдэв list: continue card, progress banner, level
  // filter. Level 2 (inside a сэдэв) shows none of it — there the passages are
  // the subject, not the library.
  const hero =
    !selectedCat && passages.length > 0 ? (
      <>
        {continuePassage ? (
          <ContinueReading
            title={continuePassage.passage.title}
            share={readShare(continuePassage.state, continuePassage.passage.sentences?.length ?? 0)}
            onPress={() => {
              haptics.tap();
              router.push(`/reading/${continuePassage.passage.id}`);
            }}
          />
        ) : null}
        <ProgressHero
          eyebrow={t('catReading')}
          done={doneCount}
          total={visible.length}
          gradient={skillGradients.reading}
          icon="book"
        />
        {levels.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.levelRow}
          >
            <LevelChip
              label={t('allLevels')}
              active={level === null}
              onPress={() => setLevel(null)}
            />
            {levels.map((l) => (
              <LevelChip
                key={l}
                label={l.toUpperCase()}
                active={level === l}
                onPress={() => setLevel(l)}
              />
            ))}
          </ScrollView>
        ) : null}
      </>
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

/** One CEFR filter chip. */
function LevelChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress(); }}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: c.primary, borderColor: c.primary },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <AppText variant="label" color={active ? c.white : c.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    levelRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.lg },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
  });
