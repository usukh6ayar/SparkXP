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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { lookupWord, type WordExplanation } from '../api/dictionary';
import { ApiError } from '../api/client';
import { AppText } from './Text';
import { colors, spacing, radius, elevation } from '../theme/theme';

interface DictionaryState {
  /** Look a word up and open the explanation sheet. */
  lookup: (word: string) => void;
}

const DictionaryContext = createContext<DictionaryState | undefined>(undefined);

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [word, setWord] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <DictionaryContext.Provider value={{ lookup }}>
      {children}

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
