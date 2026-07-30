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
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { EmptyState } from '../src/components/EmptyState';
import { IconButton } from '../src/components/IconButton';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { SavedFlashcards } from '../src/components/SavedFlashcards';
import { VocabStats } from '../src/components/VocabStats';
import { SwipeToDelete } from '../src/components/SwipeToDelete';
import { t } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { haptics } from '../src/lib/haptics';
import { spacing, radius, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/**
 * Saved words (⭐). Lists everything the user starred from the flashcard deck.
 * Tap 🔊 to hear it (uploaded audio or device TTS); tap ★ to unsave.
 */
export default function SavedScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [words, setWords] = useState<LearnWord[]>([]);
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

  const renderItem = useCallback(
    ({ item }: { item: LearnWord }) => (
      <SavedRow item={item} styles={styles} c={c} onPlay={play} onUnsave={unsave} />
    ),
    [styles, c, play, unsave],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar title={t('savedWords')} back showBadges={false} />
        <SkeletonRows count={5} style={styles.skeleton} />
      </SafeAreaView>
    );
  }

  if (error && words.length === 0) {
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
        data={words}
        keyExtractor={(w) => w.id}
        contentContainerStyle={[words.length === 0 ? styles.emptyWrap : styles.list, bounded]}
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
            {words.length > 0 ? (
              <View style={styles.practiceBar}>
                <AppText variant="caption" color={c.textSecondary}>
                  {words.length} {t('unitWords')}
                </AppText>
                <Button
                  label={t('startReview')}
                  icon="school-outline"
                  size="md"
                  fullWidth={false}
                  onPress={() => { haptics.tap(); setPracticing(true); }}
                />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText style={styles.emptyEmoji}>⭐</AppText>
            <AppText variant="h3" center>{t('noSavedWords')}</AppText>
            <AppText variant="body" color={c.textSecondary} center style={styles.emptyHint}>
              {t('noSavedWordsHint')}
            </AppText>
          </View>
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
    <SwipeToDelete onDelete={() => onUnsave(item)} label={`${t('removeFromSaved')}: ${item.english}`}>
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
      <IconButton icon="star" size={38} variant="filled" iconColor={c.xp} accessibilityLabel={t('removeFromSaved')} onPress={() => onUnsave(item)} />
    </Card>
    </SwipeToDelete>
  );
});

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  list: { padding: spacing.lg, gap: spacing.sm },
  practiceBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  skeleton: { margin: spacing.lg },
  // Still padded: the vocabulary card sits above the "nothing saved" art.
  emptyWrap: { flexGrow: 1, padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  // absoluteFill (not width/height:'100%') so the picture reliably fills the
  // 48×48 tile even though the tile centers its content for the letter fallback.
  thumbImg: { ...StyleSheet.absoluteFillObject },
  info: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 52, marginBottom: spacing.md },
  emptyHint: { marginTop: spacing.xs },
});
