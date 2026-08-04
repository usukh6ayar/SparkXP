/**
 * Wires the app's TWO separate translation surfaces. Wrap the app once in
 * <DictionaryProvider>.
 *
 *  1. **Reading gesture** — `lookup(word, anchor)` / `translatePhrase(text,
 *     anchor)`. Double-tapping a word in a passage (or <TappableText>) opens a
 *     small popover above it with ONE short meaning + audio + save. You are
 *     mid-sentence; you want the meaning and your place back.
 *  2. **Dictionary** — `openSearch()`. The dictionary button opens the study
 *     panel: its own search field and up to four senses of the word, each with
 *     an example sentence.
 *
 * They share no state — each owns its own `useWordLookup()` — so looking a word
 * up while reading never disturbs a dictionary session, and vice versa.
 *
 * Backend: Word DB → translation cache → Gemini (see /dictionary).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { GestureResponderEvent, TextStyle } from 'react-native';
import { AppText } from './Text';
import { useWordLookup } from './dictionary/useWordLookup';
import { WordPopover, type Anchor } from './dictionary/WordPopover';
import { DictionaryPanel } from './dictionary/DictionaryPanel';

interface DictionaryState {
  /** Reader gesture: one short meaning, in a popover above the tapped word. */
  lookup: (word: string, anchor: Anchor) => void;
  /** Reader gesture: translate a selected sentence, same popover. */
  translatePhrase: (text: string, anchor: Anchor) => void;
  /**
   * Dictionary button: open the search panel (detailed, multi-sense).
   * Pass a word to open it already looking that word up — the Saved-words
   * screen uses this to reopen a starred word.
   */
  openSearch: (word?: string) => void;
}

const DictionaryContext = createContext<DictionaryState | undefined>(undefined);

export function DictionaryProvider({ children }: { children: ReactNode }) {
  // One lookup per surface — separate on purpose (see the file note).
  const reader = useWordLookup();
  // `detailed` is what makes the panel show four senses instead of one gloss:
  // it routes through GET /dictionary/search/:word. The reader stays on the
  // short-gloss endpoint on purpose.
  const dictionary = useWordLookup({ detailed: true });

  const [anchor, setAnchor] = useState<Anchor>({ x: 0, y: 0 });
  const [panelOpen, setPanelOpen] = useState(false);

  const readerLookup = reader.lookup;
  const readerTranslate = reader.translate;
  const dictionaryReset = dictionary.reset;
  const dictionaryLookup = dictionary.lookup;

  const lookup = useCallback(
    (word: string, at: Anchor) => {
      setAnchor(at);
      readerLookup(word);
    },
    [readerLookup],
  );

  const translatePhrase = useCallback(
    (text: string, at: Anchor) => {
      setAnchor(at);
      readerTranslate(text);
    },
    [readerTranslate],
  );

  const openSearch = useCallback(
    (word?: string) => {
      dictionaryReset(); // every session starts on an empty search
      setPanelOpen(true);
      if (word) dictionaryLookup(word);
    },
    [dictionaryReset, dictionaryLookup],
  );

  // Stable context value: the callbacks are already useCallback-stable, so
  // lookup state changes (loading → result) DON'T change the context identity —
  // otherwise every consumer (e.g. a passage's <SelectableText>) re-renders on
  // each tick and the text visibly re-lays-out under the tapped word.
  const value = useMemo(
    () => ({ lookup, translatePhrase, openSearch }),
    [lookup, translatePhrase, openSearch],
  );

  return (
    <DictionaryContext.Provider value={value}>
      {children}
      <WordPopover lk={reader} anchor={anchor} onClose={reader.reset} />
      <DictionaryPanel lk={dictionary} open={panelOpen} onClose={() => setPanelOpen(false)} />
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
 * reader popover above it. Punctuation and spacing are preserved verbatim.
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
  // Double-tap detection: two taps on the SAME word within 300ms open it.
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
