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
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Dimensions,
  type GestureResponderEvent,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useAuth } from '../auth/AuthContext';
import {
  lookupWord,
  getWordAudio,
  saveWord,
  type WordLookup,
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
  /** Open the in-place search overlay (transparent — no screen change). */
  openSearch: () => void;
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
  const [anchor, setAnchor] = useState<Anchor>({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // In-place search overlay state.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);

  const close = useCallback(() => setWord(null), []);

  const lookup = useCallback(
    async (raw: string, at: Anchor) => {
      const clean = raw.trim().toLowerCase();
      if (!clean || !token) return;

      setWord(clean);
      setAnchor(at);
      setResult(null);
      setError(null);
      setSaved(false);
      setSize({ w: 0, h: 0 });
      setLoading(true);
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

  const openSearch = useCallback(() => {
    setQuery('');
    setSearchOpen(true);
  }, []);

  // Search from the overlay: remember it, close the overlay, then open the
  // popover near the top-centre of the screen (no tapped-word anchor here).
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
      const screen = Dimensions.get('window');
      lookup(clean, { x: screen.width / 2, y: screen.height * 0.32 });
    },
    [lookup],
  );

  // Speak the English word: prefer the ElevenLabs clip (generated + cached on
  // the backend), fall back to the device voice so it always says something.
  const speak = useCallback(async () => {
    if (!word) return;
    const playUrl = (uri: string) => {
      try {
        player.replace({ uri });
        player.play();
        return true;
      } catch {
        return false;
      }
    };
    if (result?.audioUrl && playUrl(result.audioUrl)) return;
    if (token) {
      setAudioBusy(true);
      try {
        const { audioUrl } = await getWordAudio(token, word);
        setResult((r) => (r ? { ...r, audioUrl } : r));
        if (playUrl(audioUrl)) return;
      } catch {
        // fall through to device TTS
      } finally {
        setAudioBusy(false);
      }
    }
    Speech.stop();
    Speech.speak(word, { language: 'en-US', rate: 0.9 });
  }, [word, result, token, player]);

  // Save the word (+ translation) to the user's saved vocabulary.
  const save = useCallback(async () => {
    if (!word || !token || saved || saveBusy) return;
    setSaveBusy(true);
    try {
      await saveWord(token, word);
      setSaved(true);
    } catch {
      // ignore — keep the icon un-saved so the user can retry
    } finally {
      setSaveBusy(false);
    }
  }, [word, token, saved, saveBusy]);

  // Position the popover above the tapped word, clamped to the screen.
  const screen = Dimensions.get('window');
  const GAP = 10;
  const left = clamp(anchor.x - size.w / 2, spacing.sm, screen.width - size.w - spacing.sm);
  const above = anchor.y - size.h - GAP;
  const top = above < 60 ? anchor.y + 22 : above; // flip below if no room above

  return (
    <DictionaryContext.Provider value={{ lookup, openSearch }}>
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
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tap-word meaning popover */}
      <Modal visible={word !== null} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View
          onLayout={(e) =>
            setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
          style={[styles.popover, { left, top, opacity: size.w ? 1 : 0 }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : error ? (
            <AppText variant="caption" color={colors.danger}>
              {error}
            </AppText>
          ) : result ? (
            <>
              <AppText variant="h3" color={colors.text} style={styles.translation}>
                {result.translation}
              </AppText>
              <Pressable onPress={speak} hitSlop={8} style={styles.iconBtn}>
                {audioBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="volume-high" size={22} color={colors.primary} />
                )}
              </Pressable>
              <Pressable onPress={save} hitSlop={8} style={styles.iconBtn}>
                {saveBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={saved ? colors.success : colors.primary}
                  />
                )}
              </Pressable>
            </>
          ) : null}
        </View>
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
  searchRecents: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.float,
  },
  translation: { flexShrink: 1, marginRight: spacing.xs },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
