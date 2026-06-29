/**
 * Tap-a-word dictionary.
 *
 * Wrap the app once in <DictionaryProvider>. Anywhere you render English text,
 * use <TappableText> — each word becomes tappable and opens a small popover
 * ABOVE the tapped word showing just its Mongolian meaning plus a speaker icon
 * that pronounces the English word (ElevenLabs, cached).
 *
 * Backend: Word DB → translation cache → Gemini (see /dictionary).
 */
import {
  createContext,
  useCallback,
  useContext,
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
  Dimensions,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { colors, spacing, radius, elevation } from '../theme/theme';

/** Where on screen the tapped word is — the popover anchors above this point. */
interface Anchor {
  x: number;
  y: number;
}

interface DictionaryState {
  /** Look a word up and open the popover anchored above the tap point. */
  lookup: (word: string, anchor: Anchor) => void;
}

const DictionaryContext = createContext<DictionaryState | undefined>(undefined);

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
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
        setError(err instanceof ApiError ? err.message : 'Олдсонгүй.');
      } finally {
        setLoading(false);
      }
    },
    [token],
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
    <DictionaryContext.Provider value={{ lookup }}>
      {children}

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
}: {
  children: string;
  variant?: React.ComponentProps<typeof AppText>['variant'];
  color?: string;
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
    <AppText variant={variant} color={color}>
      {tokens.map((tok, i) =>
        /^[A-Za-z]{2,}$/.test(tok) ? (
          <AppText
            key={i}
            variant={variant}
            color={color}
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

const styles = StyleSheet.create({
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
