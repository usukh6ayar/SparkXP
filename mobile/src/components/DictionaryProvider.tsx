/**
 * Tap-a-word dictionary + header word search.
 *
 * Wrap the app once in <DictionaryProvider>. Anywhere you render English text,
 * use <TappableText> — each word becomes tappable (double-tap) and opens a small
 * popover ABOVE the tapped word showing its Mongolian meaning, a speaker icon
 * that pronounces the English word (ElevenLabs, cached) and a save button.
 *
 * The same popover also powers a header search: call openSearch() to show an
 * in-place search overlay; submitting a word looks it up in the popover.
 *
 * Backend: Word DB → translation cache → Gemini (see /dictionary).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Dimensions,
  type GestureResponderEvent,
  type TextStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useAuth } from '../auth/AuthContext';
import { haptics } from '../lib/haptics';
import { DURATION, useReduceMotion } from '../lib/motion';
import {
  lookupWord,
  translateSentence,
  getWordAudio,
  searchWord,
  getDictionarySaves,
  toggleDictionarySave,
  type WordLookup,
  type WordSense,
} from '../api/dictionary';
import { ApiError } from '../api/client';
import { AppText } from './Text';
import { t } from '../i18n';
import { spacing, radius, elevation, type AppColors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

const RECENTS_KEY = 'dictionary_recents';
const MAX_RECENTS = 12;

/** Where on screen the tapped word is — the popover anchors above this point. */
interface Anchor {
  x: number;
  y: number;
}

interface DictionaryState {
  /** Look a word up and open the popover anchored above the tap point. */
  lookup: (word: string, anchor: Anchor) => void;
  /** Translate a full sentence/phrase and open the popover above the anchor. */
  translatePhrase: (text: string, anchor: Anchor) => void;
  /** Open the in-place search overlay (transparent — no screen change). */
  openSearch: () => void;
  /** Open the full Толь card for a word (used by the Saved-words screen). */
  openWordCard: (word: string) => void;
}

const DictionaryContext = createContext<DictionaryState | undefined>(undefined);

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer();

  const [word, setWord] = useState<string | null>(null);
  // Sentence mode: the popover shows a full-sentence translation (no save,
  // wrapping text) instead of a single-word gloss.
  const [isPhrase, setIsPhrase] = useState(false);
  const [anchor, setAnchor] = useState<Anchor>({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  // Every word this user has starred, loaded once. Both the reader popover and
  // the Толь card read their ⭐ state from here, so the star is never wrong on
  // first open (the old code always started un-starred).
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [saveBusy, setSaveBusy] = useState(false);

  // Толь search card state (separate from the tap popover — different layout).
  const [cardWord, setCardWord] = useState<string | null>(null);
  const [cardSenses, setCardSenses] = useState<WordSense[] | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  // In-place search overlay state.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);

  const close = useCallback(() => setWord(null), []);

  const lookup = useCallback(
    async (raw: string, at: Anchor) => {
      const clean = raw.trim().toLowerCase();
      if (!clean || !token) return;

      setIsPhrase(false);
      setWord(clean);
      setAnchor(at);
      setResult(null);
      setError(null);
      setLoading(true);
      haptics.select(); // tactile tick as the meaning popover reveals
      try {
        setResult(await lookupWord(token, clean));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('notFoundShort'));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // Translate a whole sentence (long-press in the reader). Keeps original case
  // for display + text-to-speech; opens the same popover in sentence mode.
  const translatePhrase = useCallback(
    async (raw: string, at: Anchor) => {
      const text = raw.trim();
      if (!text || !token) return;

      setIsPhrase(true);
      setWord(text);
      setAnchor(at);
      setResult(null);
      setError(null);
      setLoading(true);
      haptics.select(); // tactile tick as the translation popover reveals
      try {
        const { translation } = await translateSentence(token, text);
        setResult({ word: text, translation, audioUrl: null, cached: false });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('notFoundShort'));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

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

  // Load the ⭐ list once per session. Deliberately not refreshed afterwards:
  // if an admin deletes an entry mid-session the star stays until restart, which
  // is the same cache semantics the rest of the dictionary already has.
  useEffect(() => {
    if (!token) return;
    getDictionarySaves(token)
      .then((rows) => setSavedWords(new Set(rows.map((r) => r.word))))
      .catch(() => {});
  }, [token]);

  const openSearch = useCallback(() => {
    setQuery('');
    setSearchOpen(true);
  }, []);

  // Clear the recent-search history (state + persisted cache).
  const clearRecents = useCallback(() => {
    haptics.tap();
    setRecents([]);
    AsyncStorage.removeItem(RECENTS_KEY).catch(() => {});
  }, []);

  /** Speak an English word: ElevenLabs clip if we have one, else device TTS. */
  const speakEnglish = useCallback(
    async (w: string, knownUrl?: string | null) => {
      const playUrl = (uri: string) => {
        try {
          player.replace({ uri });
          player.play();
          return true;
        } catch {
          return false;
        }
      };
      if (knownUrl && playUrl(knownUrl)) return;
      if (token) {
        setAudioBusy(true);
        try {
          const { audioUrl } = await getWordAudio(token, w);
          if (playUrl(audioUrl)) return;
        } catch {
          // fall through to device TTS
        } finally {
          setAudioBusy(false);
        }
      }
      Speech.stop();
      Speech.speak(w, { language: 'en-US', rate: 0.9 });
    },
    [token, player],
  );

  // Speak the English word: prefer the ElevenLabs clip (generated + cached on
  // the backend), fall back to the device voice so it always says something.
  const speak = useCallback(async () => {
    if (!word) return;
    // Sentences: read aloud with the on-device voice (no per-sentence ElevenLabs).
    if (isPhrase) {
      Speech.stop();
      Speech.speak(word, { language: 'en-US', rate: 0.9 });
      return;
    }
    await speakEnglish(word, result?.audioUrl);
  }, [word, isPhrase, result, speakEnglish]);

  // ⭐ toggle. Goes to `user_dictionary_saves` — never to the curated word bank.
  const toggleStar = useCallback(
    async (raw: string) => {
      const w = raw.trim().toLowerCase();
      if (!w || !token || saveBusy) return;
      setSaveBusy(true);
      try {
        const { saved: isSaved } = await toggleDictionarySave(token, w);
        setSavedWords((prev) => {
          const next = new Set(prev);
          if (isSaved) next.add(w);
          else next.delete(w);
          return next;
        });
      } catch {
        // leave the star as-is so the user can retry
      } finally {
        setSaveBusy(false);
      }
    },
    [token, saveBusy],
  );

  /** Open the Толь card for a word: 4 senses in a wide, scrollable sheet. */
  const openWordCard = useCallback(
    async (raw: string) => {
      const clean = raw.trim().toLowerCase();
      if (!clean || !token) return;
      setCardWord(clean);
      setCardSenses(null);
      setCardError(null);
      setCardLoading(true);
      haptics.select();
      try {
        const { senses } = await searchWord(token, clean);
        setCardSenses(senses);
      } catch (err) {
        setCardError(err instanceof ApiError ? err.message : t('noSensesFound'));
      } finally {
        setCardLoading(false);
      }
    },
    [token],
  );

  // Search from the overlay: remember it, close the overlay, then open the
  // wide Толь card (4 senses) — not the tap popover, which can't fit them.
  const runSearch = useCallback(
    (raw: string) => {
      const clean = raw.trim().toLowerCase();
      if (!clean) return;
      Keyboard.dismiss();
      setSearchOpen(false);
      setRecents((prev) => {
        const next = [clean, ...prev.filter((w) => w !== clean)].slice(0, MAX_RECENTS);
        AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      openWordCard(clean);
    },
    [openWordCard],
  );

  // Position the popover next to the tapped word, clamped to the screen.
  // Both dimensions are anchored by a FIXED edge so that when the content grows
  // (loading spinner → full result) the box expands *away* from the word instead
  // of re-centering — which used to make the popover visibly jump/shake.
  const screen = Dimensions.get('window');
  const GAP = 10;
  // Fixed width → no horizontal shift when the text length changes.
  const POP_W = isPhrase ? Math.min(320, screen.width - spacing.lg * 2) : 260;
  const left = clamp(anchor.x - POP_W / 2, spacing.sm, screen.width - POP_W - spacing.sm);
  // Enough room above? pin the popover's BOTTOM just above the word (grows up);
  // otherwise pin its TOP just below the word (grows down). Either way the
  // anchored edge stays put as the height changes.
  const placeAbove = anchor.y > 150;
  const vpos = placeAbove
    ? { bottom: screen.height - anchor.y + GAP }
    : { top: anchor.y + 22 };

  // Reveal: fade + slide the popover up when it opens, so it "presents" instead
  // of snapping in. Respects Reduce Motion. Position no longer depends on a
  // measured size, so this only runs once per open (no re-measure flicker).
  const reveal = useSharedValue(0);
  const reduce = useReduceMotion();
  useEffect(() => {
    reveal.value = word ? (reduce ? 1 : withTiming(1, { duration: DURATION.fast })) : 0;
  }, [word, reduce]);
  const popoverStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 8 }],
  }));

  // Stable context value: the callbacks are already useCallback-stable, so
  // memoizing here means popover state changes (loading → result) DON'T change
  // the context identity — otherwise every consumer (e.g. the passage's
  // <SelectableText>) re-renders on each lookup tick and the text visibly
  // re-lays-out / "trembles" under the tapped word.
  const value = useMemo(
    () => ({ lookup, translatePhrase, openSearch, openWordCard }),
    [lookup, translatePhrase, openSearch, openWordCard],
  );

  return (
    <DictionaryContext.Provider value={value}>
      {children}

      {/* In-place search overlay — transparent backdrop, no screen change */}
      <Modal
        visible={searchOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchOpen(false)}
      >
        <Pressable style={styles.searchBackdrop} onPress={() => setSearchOpen(false)}>
          {/* Top panel; taps inside don't close. */}
          <Pressable
            style={[styles.searchPanel, { paddingTop: insets.top + spacing.sm }]}
            onPress={() => {}}
          >
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchEnglishWord')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => runSearch(query)}
                autoFocus
              />
              {query ? (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
              <Pressable hitSlop={8} onPress={() => setSearchOpen(false)}>
                <AppText variant="label" color={colors.primary}>{t('cancel')}</AppText>
              </Pressable>
            </View>

            {recents.length > 0 ? (
              <>
                <View style={styles.recentsHead}>
                  <AppText variant="overline" color={colors.textMuted}>
                    {t('recentSearches')}
                  </AppText>
                  <Pressable hitSlop={8} onPress={clearRecents}>
                    <AppText variant="label" color={colors.primary}>{t('clearHistory')}</AppText>
                  </Pressable>
                </View>
                <View style={styles.searchRecents}>
                  {recents.map((w) => (
                    <Pressable
                      key={w}
                      style={styles.recentChip}
                      onPress={() => runSearch(w)}
                    >
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                      <AppText variant="label">{w}</AppText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tap-word meaning popover */}
      <Modal visible={word !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          style={[styles.popover, { left, width: POP_W, ...vpos }, popoverStyle]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : error ? (
            <AppText variant="caption" color={colors.danger}>
              {error}
            </AppText>
          ) : result ? (
            <View style={styles.popoverBody}>
              <View style={styles.popoverRow}>
                <AppText
                  variant={isPhrase ? 'body' : 'h3'}
                  color={colors.text}
                  style={styles.translation}
                >
                  {result.translation}
                </AppText>
                <Pressable onPress={speak} hitSlop={8} style={styles.iconBtn}>
                  {audioBusy ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="volume-high" size={22} color={colors.primary} />
                  )}
                </Pressable>
                {/* Save is word-only — sentences aren't added to vocabulary. */}
                {!isPhrase ? (
                  <Pressable onPress={() => toggleStar(word!)} hitSlop={8} style={styles.iconBtn}>
                    {saveBusy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons
                        name={savedWords.has(word ?? '') ? 'bookmark' : 'bookmark-outline'}
                        size={22}
                        color={savedWords.has(word ?? '') ? colors.success : colors.primary}
                      />
                    )}
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </Modal>

      {/* Толь card — the 4-sense search result. Wide + scrollable, unlike the
          260px tap popover, which cannot fit four 3-line senses. */}
      <Modal
        visible={!!cardWord}
        transparent
        animationType="fade"
        onRequestClose={() => setCardWord(null)}
      >
        <Pressable style={styles.cardBackdrop} onPress={() => setCardWord(null)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.cardHead}>
              <AppText variant="h3" style={styles.cardWord}>{cardWord}</AppText>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => cardWord && speakEnglish(cardWord)}
              >
                {audioBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="volume-high" size={22} color={colors.primary} />
                )}
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => cardWord && toggleStar(cardWord)}
              >
                {saveBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={savedWords.has(cardWord ?? '') ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={savedWords.has(cardWord ?? '') ? colors.success : colors.primary}
                  />
                )}
              </Pressable>
            </View>

            {cardLoading ? (
              <ActivityIndicator style={styles.cardLoading} color={colors.primary} />
            ) : cardError ? (
              <AppText variant="body" color={colors.textMuted}>{cardError}</AppText>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(cardSenses ?? []).map((s, i) => (
                  <View key={i} style={styles.sense}>
                    <AppText variant="label" color={colors.primary}>
                      {i + 1}. {s.word}
                    </AppText>
                    <AppText variant="body">{s.example}</AppText>
                    <AppText variant="body" color={colors.textSecondary}>
                      {s.translation}
                    </AppText>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </DictionaryContext.Provider>
  );
}

/** Access the dictionary. Throws if used outside <DictionaryProvider>. */
export function useDictionary(): DictionaryState {
  const ctx = useContext(DictionaryContext);
  if (!ctx) {
    throw new Error('useDictionary must be used within <DictionaryProvider>');
  }
  return ctx;
}

/**
 * Renders text where each English word (2+ letters) is tappable and opens the
 * meaning popover above it. Punctuation and spacing are preserved verbatim.
 */
export function TappableText({
  children,
  variant = 'body',
  color,
  style,
}: {
  children: string;
  variant?: React.ComponentProps<typeof AppText>['variant'];
  color?: string;
  style?: TextStyle;
}) {
  const { lookup } = useDictionary();
  // Double-tap detection: two taps on the SAME word within 300ms open the popover.
  const lastTap = useRef<{ key: number; time: number }>({ key: -1, time: 0 });
  const tokens = children.split(/([A-Za-z]+)/);

  const handlePress = (key: number, tok: string, e: GestureResponderEvent) => {
    const now = Date.now();
    const { pageX, pageY } = e.nativeEvent;
    if (lastTap.current.key === key && now - lastTap.current.time < 300) {
      lastTap.current = { key: -1, time: 0 };
      lookup(tok, { x: pageX, y: pageY });
    } else {
      lastTap.current = { key, time: now };
    }
  };

  return (
    <AppText variant={variant} color={color} style={style}>
      {tokens.map((tok, i) =>
        /^[A-Za-z]{2,}$/.test(tok) ? (
          <AppText
            key={i}
            variant={variant}
            color={color}
            style={style}
            onPress={(e: GestureResponderEvent) => handlePress(i, tok, e)}
            suppressHighlighting
          >
            {tok}
          </AppText>
        ) : (
          tok
        ),
      )}
    </AppText>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  // In-place search overlay
  searchBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 30, 0.6)',
    justifyContent: 'flex-start',
  },
  searchPanel: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...elevation.float,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, height: '100%' },
  recentsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  searchRecents: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },

  // Tap-word meaning popover
  popover: {
    position: 'absolute',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.float,
  },
  popoverBody: { gap: spacing.sm },
  popoverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  translation: { flexShrink: 1, marginRight: spacing.xs },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Толь search card (4 senses) — wide, centred, scrollable.
  cardBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    maxHeight: '65%',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...elevation.float,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardWord: { flex: 1 },
  cardLoading: { paddingVertical: spacing.xl },
  sense: { marginBottom: spacing.lg, gap: 2 },
});
