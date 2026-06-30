/**
 * Double-tap (tap-a-word) dictionary.
 *
 * Wrap the app once in <DictionaryProvider>. Anywhere you render English text,
 * use <TappableText> — each word becomes tappable and opens a bottom sheet with
 * a Mongolian explanation (Words DB → AI fallback, see backend /dictionary).
 *
 * The sheet lives at the root (rendered once) so screens stay lightweight: a
 * tapped word just calls `useDictionary().lookup(word)`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { lookupWord, type WordExplanation } from '../api/dictionary';
import { ApiError } from '../api/client';
import { AppText } from './Text';
import { colors, spacing, radius, elevation } from '../theme/theme';

const RECENTS_KEY = 'dictionary_recents';
const MAX_RECENTS = 12;

interface DictionaryState {
  /** Look a word up and open the explanation sheet. */
  lookup: (word: string) => void;
  /** Open the in-place search overlay (transparent — no screen change). */
  openSearch: () => void;
}

const DictionaryContext = createContext<DictionaryState | undefined>(undefined);

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [word, setWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // In-place search overlay state.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>([]);

  const close = useCallback(() => setWord(null), []);

  const lookup = useCallback(
    async (raw: string) => {
      const clean = raw.trim().toLowerCase();
      if (!clean || !token) return;

      setWord(clean);
      setResult(null);
      setError(null);
      setLoading(true);
      try {
        setResult(await lookupWord(token, clean));
      } catch (err) {
        // Plan-limit (403) and other backend messages come through ApiError.
        setError(
          err instanceof ApiError ? err.message : 'Тайлбарыг ачаалж чадсангүй.',
        );
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

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

  // Search from the overlay: remember it, close the overlay, open the sheet.
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
      lookup(clean);
    },
    [lookup],
  );

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
                placeholder="Англи үг хайх..."
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
                <AppText variant="label" color={colors.primary}>Болих</AppText>
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

      <Modal
        visible={word !== null}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Stop taps inside the sheet from closing it. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <AppText variant="h2">{word}</AppText>
              <Pressable hitSlop={10} onPress={close}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {loading && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <AppText variant="caption" style={styles.centerText}>
                  Тайлбар хайж байна...
                </AppText>
              </View>
            )}

            {!loading && error && (
              <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
                <AppText variant="body" color={colors.textSecondary} center style={styles.centerText}>
                  {error}
                </AppText>
              </View>
            )}

            {!loading && result && (
              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                <Markdown text={result.explanation} />
                <View style={styles.sourceRow}>
                  <Ionicons
                    name={result.cached ? 'book-outline' : 'sparkles-outline'}
                    size={13}
                    color={colors.textMuted}
                  />
                  <AppText variant="caption">
                    {result.cached ? 'Толь бичгээс' : 'AI-аар тайлбарласан'}
                  </AppText>
                </View>
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
 * dictionary sheet. Punctuation and spacing are preserved verbatim.
 */
export function TappableText({
  children,
  variant = 'body',
  color,
}: {
  children: string;
  variant?: React.ComponentProps<typeof AppText>['variant'];
  color?: string;
}) {
  const { lookup } = useDictionary();
  // Split into word / non-word tokens, keeping the separators.
  const tokens = children.split(/([A-Za-z]+)/);

  return (
    <AppText variant={variant} color={color}>
      {tokens.map((tok, i) =>
        /^[A-Za-z]{2,}$/.test(tok) ? (
          <AppText
            key={i}
            variant={variant}
            color={color}
            onPress={() => lookup(tok)}
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

/**
 * Tiny inline markdown renderer for the explanation text. Supports **bold** and
 * *italic* only — that's all the backend produces. Anything fancier is overkill.
 */
function Markdown({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <AppText key={i} variant="body" style={styles.line}>
          {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <AppText key={j} variant="bodyStrong">
                  {part.slice(2, -2)}
                </AppText>
              );
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return (
                <AppText key={j} variant="body" style={styles.italic}>
                  {part.slice(1, -1)}
                </AppText>
              );
            }
            return part;
          })}
        </AppText>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 36, 74, 0.45)',
    justifyContent: 'flex-end',
  },

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
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.sm,
    maxHeight: '70%',
    ...elevation.float,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  body: { flexGrow: 0 },
  line: { marginBottom: spacing.xs },
  italic: { fontStyle: 'italic', color: colors.textSecondary },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  centerText: { marginTop: spacing.xs },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
