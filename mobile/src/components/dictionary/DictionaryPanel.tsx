/**
 * The DICTIONARY — the full study view behind the search button. Slides in from
 * the right over 80% of the screen and carries its own search field, so one
 * word leads to the next without leaving. Each result lists up to four senses
 * ordered by how often the word is really used in them.
 *
 * A sense is three lines and nothing more — the word/phrase, an English
 * example, its Mongolian translation. No definitions, no grammar labels.
 *
 * This is NOT the reader's translate gesture: double-tapping a word inside a
 * passage opens the small single-meaning `WordPopover` instead, so reading is
 * never interrupted by a full-screen panel.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '../Text';
import { haptics } from '../../lib/haptics';
import { DURATION, enter, useReduceMotion } from '../../lib/motion';
import { MAX_SENSES, type DictionarySense } from '../../api/dictionary';
import { t } from '../../i18n';
import { spacing, radius, elevation, type AppColors } from '../../theme/theme';
import { useColors } from '../../settings/SettingsContext';
import { speakEnglish, type WordLookupState } from './useWordLookup';

const RECENTS_KEY = 'dictionary_recents';
const MAX_RECENTS = 12;
/** The panel covers this much of the screen width (the rest stays visible). */
const PANEL_RATIO = 0.8;

/** Frosted fills used only ON the hero gradient, where white is the ink. */
const ON_HERO = 'rgba(255,255,255,0.18)';
const ON_HERO_STRONG = 'rgba(255,255,255,0.30)';

export function DictionaryPanel({
  lk,
  open,
  onClose,
}: {
  lk: WordLookupState;
  open: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const reduce = useReduceMotion();
  const { word, isPhrase, loading, result, error, audioBusy, saved, saveBusy } = lk;

  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);
  // Kept apart from `open` so the panel can animate OUT before it unmounts.
  const [mounted, setMounted] = useState(false);

  const panelW = Math.round(screenW * PANEL_RATIO);
  // 0 = off-screen right, 1 = fully open. Drives both slide and backdrop fade.
  const reveal = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setMounted(true);
      reveal.value = reduce ? 1 : withTiming(1, { duration: DURATION.base });
      return;
    }
    if (reduce) {
      setMounted(false);
      return;
    }
    reveal.value = withTiming(0, { duration: DURATION.fast }, (done) => {
      if (done) runOnJS(setMounted)(false);
    });
  }, [open, reduce, reveal]);

  // Load recent searches once.
  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY).then((v) => {
      if (!v) return;
      try {
        setRecents(JSON.parse(v));
      } catch {
        // ignore corrupt cache
      }
    });
  }, []);

  const clearRecents = useCallback(() => {
    haptics.tap();
    setRecents([]);
    AsyncStorage.removeItem(RECENTS_KEY).catch(() => {});
  }, []);

  const runSearch = useCallback(
    (raw: string) => {
      const clean = raw.trim().toLowerCase();
      if (!clean) return;
      Keyboard.dismiss();
      setQuery(clean);
      setRecents((prev) => {
        const next = [clean, ...prev.filter((w) => w !== clean)].slice(0, MAX_RECENTS);
        AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      lk.lookup(clean);
    },
    [lk],
  );

  /**
   * The senses to show, most-used first, capped at MAX_SENSES.
   *
   * The `translation` fallback is for a result with no senses at all — a
   * translated sentence (`isPhrase`), or a lookup that only produced a short
   * gloss. When senses ARE present the meaning is not repeated here: it already
   * has its own line under the headword.
   */
  const senses: DictionarySense[] = useMemo(() => {
    if (result?.meanings?.length) return result.meanings.slice(0, MAX_SENSES);
    if (result?.translation) {
      return [{ word: result.word, example: '', translation: result.translation }];
    }
    return [];
  }, [result]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - reveal.value) * panelW }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  // Swipe the panel to the right to dismiss it (it enters from the right, so
  // that's the natural "back" direction). Follows the finger, then either flings
  // closed past a third of the width / a fast flick, or springs back open.
  const swipeBack = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      if (e.translationX > 0) reveal.value = Math.max(0, 1 - e.translationX / panelW);
    })
    .onEnd((e) => {
      if (e.translationX > panelW * 0.33 || e.velocityX > 700) {
        runOnJS(onClose)();
      } else {
        reveal.value = withTiming(1, { duration: DURATION.fast });
      }
    });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* RN Modal renders outside the app's root gesture tree, so gestures inside
          it need their own root to be recognised. */}
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <GestureDetector gesture={swipeBack}>
          <Animated.View style={[styles.panel, { width: panelW }, panelStyle]}>
        {/* Hero — search, the word and its actions on one brand gradient, so
            the panel opens with a single confident block instead of four
            stacked grey strips. White-on-gradient is also the only way this
            purple can legally carry text (DESIGN.md → Brand). */}
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
        >
          <View style={styles.heroTop}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textOnDarkMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchEnglishWord')}
                placeholderTextColor={colors.textOnDarkMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => runSearch(query)}
                autoFocus
              />
              {query ? (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textOnDarkMuted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textOnDark} />
            </Pressable>
          </View>

          {/* The word under study — the hero's headline. */}
          {word ? (
            <AppText
              variant="h1"
              color={colors.textOnDark}
              numberOfLines={1}
              style={styles.heroWord}
            >
              {word}
            </AppText>
          ) : null}

          {/* The word's own Mongolian meaning — one line, right under the
              headword. Without it the panel answered "how is it used?" but
              never "what does it mean?". Omitted entirely when the backend has
              none, so no empty row is left behind. */}
          {word && !isPhrase && result?.translation ? (
            <AppText
              variant="body"
              color={colors.textOnDarkMuted}
              style={styles.heroMeaning}
            >
              {result.translation}
            </AppText>
          ) : null}

          {word ? (
            <View style={styles.actions}>
              <Pressable onPress={lk.speak} style={styles.actionBtn}>
                {audioBusy ? (
                  <ActivityIndicator size="small" color={colors.textOnDark} />
                ) : (
                  <Ionicons name="volume-high" size={18} color={colors.textOnDark} />
                )}
                <AppText variant="label" color={colors.textOnDark}>{t('pronounce')}</AppText>
              </Pressable>
              {!isPhrase ? (
                <Pressable
                  onPress={lk.save}
                  style={[styles.actionBtn, saved && styles.actionBtnDone]}
                >
                  {saveBusy ? (
                    <ActivityIndicator size="small" color={colors.textOnDark} />
                  ) : (
                    <Ionicons
                      name={saved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={colors.textOnDark}
                    />
                  )}
                  <AppText variant="label" color={colors.textOnDark}>
                    {saved ? t('savedWord') : t('save')}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </LinearGradient>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : error ? (
            <AppText variant="body" color={colors.danger}>{error}</AppText>
          ) : !word ? (
            /* Nothing looked up yet — offer the words already searched. */
            recents.length > 0 ? (
              <>
                <View style={styles.recentsHead}>
                  <AppText variant="overline" color={colors.textMuted}>
                    {t('recentSearches')}
                  </AppText>
                  <Pressable hitSlop={8} onPress={clearRecents}>
                    <AppText variant="label" color={colors.primary}>{t('clearHistory')}</AppText>
                  </Pressable>
                </View>
                <View style={styles.recentsWrap}>
                  {recents.map((w) => (
                    <Pressable key={w} style={styles.recentChip} onPress={() => runSearch(w)}>
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                      <AppText variant="label">{w}</AppText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="search" size={34} color={colors.textMuted} />
                <AppText variant="body" color={colors.textMuted} center>
                  {t('dictionaryEmptyHint')}
                </AppText>
              </View>
            )
          ) : (
            /* Three lines per sense — the word/phrase, an English example, its
               Mongolian translation. The numeral sits in its own column so all
               three lines share one left edge, which is what makes a plain list
               read as a dictionary entry. */
            senses.map((s, i) => (
              <Animated.View
                // Keyed by the word too, so each new lookup re-mounts the list
                // and the entries stagger in again.
                key={`${word}-${i}`}
                entering={reduce ? undefined : enter(i * 60, 260)}
                style={[styles.sense, i > 0 && styles.senseRule]}
              >
                <AppText variant="h3" color={colors.textMuted} style={styles.senseNum}>
                  {i + 1}.
                </AppText>
                <View style={styles.senseBody}>
                  <AppText variant="h3">{s.word}</AppText>
                  {s.example ? (
                    <View style={styles.exampleRow}>
                      <AppText variant="body" style={styles.example}>{s.example}</AppText>
                      <Pressable onPress={() => speakEnglish(s.example)} hitSlop={8}>
                        <Ionicons name="volume-medium" size={17} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  ) : null}
                  <AppText variant="body" color={colors.textSecondary}>{s.translation}</AppText>
                </View>
              </Animated.View>
            ))
          )}
          </ScrollView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  flex: { flex: 1 },

  // `overflow: hidden` is what lets the gradient hero inherit the panel's
  // rounded left corners.
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 6, 30, 0.5)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    overflow: 'hidden',
    ...elevation.float,
  },

  // Hero (search + word + actions on the brand gradient)
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // A notch above h1 (27): the looked-up word is the whole point of the panel.
  heroWord: { fontSize: 32, lineHeight: 40 },
  // Sits tight under the headword — `hero` has a gap of its own, which would
  // otherwise read as two unrelated lines rather than word + meaning.
  heroMeaning: { marginTop: -spacing.sm + 2 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 42,
    backgroundColor: ON_HERO,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textOnDark, height: '100%' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: ON_HERO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ON_HERO,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  actionBtnDone: { backgroundColor: ON_HERO_STRONG },

  // Senses — a hairline rule between entries, never a card.
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  loader: { marginTop: spacing.xl },
  sense: { flexDirection: 'row', gap: spacing.sm },
  senseRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  senseNum: { width: 22 },
  senseBody: { flex: 1, gap: 3 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  example: { flex: 1, lineHeight: 24 },

  // Nothing looked up yet
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  recentsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  recentsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
});
