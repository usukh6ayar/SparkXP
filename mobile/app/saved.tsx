import { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppImage } from '../src/components/AppImage';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useAuth } from '../src/auth/AuthContext';
import {
  getSaved,
  toggleSave,
  getReviewStats,
  type LearnWord,
  type ReviewStats,
} from '../src/api/reviews';
import {
  getDictionarySaves,
  toggleDictionarySave,
  type SavedDictionaryWord,
} from '../src/api/dictionary';
import { forgetSavedWords } from '../src/lib/newWords';
import { useDictionary } from '../src/components/DictionaryProvider';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { EmptyState } from '../src/components/EmptyState';
import { IconButton } from '../src/components/IconButton';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { PeriodTabs } from '../src/components/PeriodTabs';
import { SavedFlashcards } from '../src/components/SavedFlashcards';
import { VocabStats } from '../src/components/VocabStats';
import { SwipeToDelete } from '../src/components/SwipeToDelete';
import { t } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { haptics } from '../src/lib/haptics';
import { spacing, radius, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/** The two kinds of saved word, each its own tab. */
type Tab = 'lesson' | 'dictionary';

const TABS = [
  { key: 'lesson', labelKey: 'lessonWords' },
  { key: 'dictionary', labelKey: 'dictionaryWords' },
] as const;

/** A row in whichever tab is open. `id` only exists on curated lesson words. */
type Row = LearnWord | SavedDictionaryWord;
const isLessonWord = (row: Row): row is LearnWord => 'id' in row;

/**
 * Saved words (⭐).
 *
 * Two separate lists live here and they are NOT the same thing: curated lesson
 * words (image, level, SM-2 state → they can be practised as flashcards) and
 * plain Толь lookups (a word + one gloss). They used to be stacked in one
 * scroll, which stops working the moment a student saves a few hundred words —
 * so each is now its own tab, and only the open one renders.
 *
 * Rows are thrown away with a Gmail-style sideways swipe (see `SwipeToDelete`).
 */
export default function SavedScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<Tab>('lesson');
  const [words, setWords] = useState<LearnWord[]>([]);
  // Толь (dictionary) ⭐ saves — a separate table/endpoint from the curated
  // lesson words above. See DictionarySensesService.listSaves.
  const [dictWords, setDictWords] = useState<SavedDictionaryWord[]>([]);
  const { openSearch } = useDictionary();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [practicing, setPracticing] = useState(false);
  // Lifetime vocabulary size (SM-2 state on the server), not just the saved list.
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const player = useAudioPlayer();

  const load = useCallback(async () => {
    if (!token) return;
    // Stats are a nice-to-have: a failure there must not blank the word list.
    getReviewStats(token).then(setStats).catch(() => {});
    // Толь saves are a separate list — a failure there must not blank the
    // curated words in the other tab.
    getDictionarySaves(token).then(setDictWords).catch(() => {});
    try {
      setWords(await getSaved(token));
      setError(false);
    } catch (e) {
      console.warn('Saved words load failed:', (e as Error)?.message ?? e);
      setError(true);
    }
  }, [token]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    haptics.tap();
    await load();
    setRefreshing(false);
  }

  // Stable callbacks so memoized rows don't re-render when the screen re-renders.
  const play = useCallback((w: LearnWord) => {
    if (w.audioUrl) {
      try { player.replace({ uri: w.audioUrl }); player.play(); return; } catch { /* fall through */ }
    }
    Speech.stop();
    Speech.speak(w.english, { language: 'en-US', rate: 0.9 });
  }, [player]);

  const unsave = useCallback((w: LearnWord) => {
    setWords((list) => list.filter((x) => x.id !== w.id)); // optimistic
    if (token) toggleSave(token, w.id).catch(() => {});
  }, [token]);

  // The provider holds no shared ⭐ state (each dictionary surface owns its own
  // useWordLookup), so calling the endpoint directly is safe here.
  const unsaveDictWord = useCallback(
    (word: string) => {
      setDictWords((list) => list.filter((r) => r.word !== word)); // optimistic
      forgetSavedWords(); // the reading list's "шинэ үг" counts just changed
      if (token) toggleDictionarySave(token, word).catch(() => {});
    },
    [token],
  );

  const isLesson = tab === 'lesson';
  const data: Row[] = isLesson ? words : dictWords;

  const renderItem = useCallback(
    ({ item }: { item: Row }) =>
      isLessonWord(item) ? (
        <SavedRow item={item} styles={styles} c={c} onPlay={play} onUnsave={unsave} />
      ) : (
        <DictRow
          row={item}
          colors={c}
          onOpen={() => openSearch(item.word)}
          onUnsave={() => unsaveDictWord(item.word)}
        />
      ),
    [styles, c, play, unsave, openSearch, unsaveDictWord],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar title={t('savedWords')} back showBadges={false} />
        <SkeletonRows count={5} style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  if (error && words.length === 0 && dictWords.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar title={t('savedWords')} back showBadges={false} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: load }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar title={t('savedWords')} back showBadges={false} />
      <FlatList
        // Remount on tab change so the new list starts at the top and no row
        // keeps a half-open swipe from the list it no longer belongs to.
        key={tab}
        data={data}
        keyExtractor={(row) => (isLessonWord(row) ? row.id : row.word)}
        contentContainerStyle={[styles.list, bounded]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
        ListHeaderComponent={
          <>
            {/* Vocabulary size + mastery — shown even with nothing starred, since
                knowing words and saving words are different things. */}
            <VocabStats stats={stats} />
            <PeriodTabs
              value={tab}
              options={[
                { ...TABS[0], count: words.length },
                { ...TABS[1], count: dictWords.length },
              ]}
              onChange={(key) => { haptics.select(); setTab(key); }}
              style={styles.tabs}
            />
            {data.length > 0 ? (
              <>
                <View style={styles.actionBar}>
                  <AppText variant="caption" color={c.textSecondary}>
                    {data.length} {t('unitWords')}
                  </AppText>
                  {isLesson ? (
                    <Button
                      label={t('startReview')}
                      icon="school-outline"
                      size="md"
                      fullWidth={false}
                      onPress={() => { haptics.tap(); setPracticing(true); }}
                    />
                  ) : (
                    <Button
                      label={t('dictionary')}
                      icon="search-outline"
                      variant="secondary"
                      size="md"
                      fullWidth={false}
                      onPress={() => { haptics.tap(); openSearch(); }}
                    />
                  )}
                </View>
                {/* The delete gesture is invisible until you try it — say it once. */}
                <AppText variant="caption" color={c.textMuted} style={styles.hint}>
                  {t('swipeToDeleteHint')}
                </AppText>
              </>
            ) : null}
          </>
        }
        ListEmptyComponent={
          isLesson ? (
            <EmptyState
              icon="star-outline"
              title={t('noSavedWords')}
              hint={t('noSavedWordsHint')}
            />
          ) : (
            <EmptyState
              icon="book-outline"
              title={t('noDictionaryWords')}
              hint={t('noDictionaryWordsHint')}
            />
          )
        }
        renderItem={renderItem}
      />

      <SavedFlashcards
        visible={practicing}
        words={words}
        onClose={() => setPracticing(false)}
        onPlay={play}
      />
    </SafeAreaView>
  );
}

/** One saved-word row. Memoized so scrolling / unsaving one row doesn't
 *  re-render every other row (props are stable: item + stable callbacks). */
const SavedRow = memo(function SavedRow({
  item, styles, c, onPlay, onUnsave,
}: {
  item: LearnWord;
  styles: ReturnType<typeof makeStyles>;
  c: AppColors;
  onPlay: (w: LearnWord) => void;
  onUnsave: (w: LearnWord) => void;
}) {
  return (
    <SwipeToDelete onDelete={() => onUnsave(item)}>
      {/* `remove` = the same animated removal the swipe uses, so un-starring
          leaves the list the same way instead of blinking out. */}
      {(remove) => (
        <Card variant="raised" padding="md" style={styles.row}>
          <View style={styles.thumb}>
            {item.imageUrl ? (
              <AppImage source={{ uri: item.imageUrl }} width={120} style={styles.thumbImg} contentFit="cover" recyclingKey={item.id} />
            ) : (
              // Words saved from the tap-to-translate dictionary have no picture —
              // show a clean letter tile instead of a broken-image icon.
              <AppText variant="h3" color={c.primary}>
                {(item.english?.trim().charAt(0) || '?').toUpperCase()}
              </AppText>
            )}
          </View>
          <View style={styles.info}>
            <AppText variant="h3" color={c.navy} numberOfLines={1}>{item.english}</AppText>
            <AppText variant="caption" color={c.primary} numberOfLines={1}>{item.mongolian}</AppText>
          </View>
          <IconButton icon="volume-high" size={38} variant="filled" iconColor={c.primary} accessibilityLabel={t('playAudio')} onPress={() => onPlay(item)} />
          <IconButton icon="star" size={38} variant="filled" iconColor={c.xp} accessibilityLabel={t('removeFromSaved')} onPress={remove} />
        </Card>
      )}
    </SwipeToDelete>
  );
});

/**
 * One ⭐ dictionary word. Tapping opens the full Толь card; the bookmark
 * unsaves it. No flashcard practice here — these rows have no image, level
 * or SM-2 state, so they never enter the SavedFlashcards deck.
 */
const DictRow = memo(function DictRow({
  row,
  colors: c,
  onOpen,
  onUnsave,
}: {
  row: SavedDictionaryWord;
  colors: AppColors;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  return (
    <SwipeToDelete onDelete={onUnsave}>
      {(remove) => (
        <Card variant="raised" padding="md">
          <View style={dictStyles.row}>
            <View style={dictStyles.info}>
              <AppText variant="label">{row.word}</AppText>
              {row.translation ? (
                <AppText variant="caption" color={c.textSecondary} numberOfLines={1}>
                  {row.translation}
                </AppText>
              ) : null}
            </View>
            <IconButton
              icon="book-outline"
              size={38}
              variant="filled"
              iconColor={c.primary}
              accessibilityLabel={t('openInDictionary')}
              onPress={onOpen}
            />
            <IconButton
              icon="bookmark"
              size={38}
              variant="filled"
              iconColor={c.xp}
              accessibilityLabel={t('removeFromSaved')}
              onPress={remove}
            />
          </View>
        </Card>
      )}
    </SwipeToDelete>
  );
});

const dictStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  info: { flex: 1 },
});

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  tabs: { marginTop: spacing.md },
  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  hint: { marginTop: spacing.xs, marginBottom: spacing.sm },
  skeleton: { margin: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  // absoluteFill (not width/height:'100%') so the picture reliably fills the
  // 48×48 tile even though the tile centers its content for the letter fallback.
  thumbImg: { ...StyleSheet.absoluteFillObject },
  info: { flex: 1 },
});
