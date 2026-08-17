import { useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  type TextStyle,
  type TextProps,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { useDictionary } from './DictionaryProvider';
import { useColors } from '../settings/SettingsContext';
import { t } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';

/**
 * Reading text with two translate gestures:
 *  - **Double-tap a word** → word meaning popover (pronunciation + save).
 *  - **Long-press a word** → starts a highlight; **tap more words** to extend
 *    it, then tap **Translate** to translate the whole highlighted span.
 *
 * Word + whitespace are kept as separate inline spans so a highlight background
 * can be drawn across the selected range (like a native text selection).
 */
/** Inclusive index range as an array — used to mark a whole selection. */
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function SelectableText({
  text,
  variant = 'body',
  style,
  highlightRange,
  marks,
  onMarksChange,
  onTextLayout,
}: {
  text: string;
  variant?: React.ComponentProps<typeof AppText>['variant'];
  style?: TextStyle;
  /**
   * Character range of `text` to tint separately from the user's own selection
   * — used by read-along to mark the sentence being spoken. `to` is exclusive.
   */
  highlightRange?: { from: number; to: number } | null;
  /**
   * Persistent highlights, as token indices. Given, a **Highlight** action
   * appears next to Translate and the marked words stay tinted after the
   * selection is dropped — that is what a test taker does with a pen while
   * reading a passage, and it has to survive scrolling between questions.
   * Omitted (Reading screen) → the component behaves exactly as before.
   */
  marks?: Set<number>;
  onMarksChange?: (marks: Set<number>) => void;
  /**
   * Line metrics of the laid-out passage. `PagedReader` uses these to work out
   * where each page should start.
   */
  onTextLayout?: TextProps['onTextLayout'];
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { lookup, translatePhrase } = useDictionary();

  // Alternating [word, space, word, …] tokens; indices are stable render keys.
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  // Character offset of each token, so `highlightRange` can be resolved to tokens.
  const offsets = useMemo(() => {
    let at = 0;
    return tokens.map((tok) => {
      const start = at;
      at += tok.length;
      return start;
    });
  }, [tokens]);
  const spoken = (i: number) =>
    !!highlightRange && offsets[i] >= highlightRange.from && offsets[i] < highlightRange.to;
  const lastTap = useRef<{ key: number; time: number }>({ key: -1, time: 0 });
  // Selection = inclusive token-index range [a..b] (null = nothing selected).
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const selecting = sel !== null;
  const lo = sel ? Math.min(sel.a, sel.b) : -1;
  const hi = sel ? Math.max(sel.a, sel.b) : -1;

  const isWord = (tok: string) => /\S/.test(tok);
  const marked = (i: number) => !!marks?.has(i);

  /** Commit the current selection as a persistent highlight (or clear it). */
  const toggleMark = () => {
    if (!sel || !onMarksChange) return;
    const next = new Set(marks);
    // Already fully highlighted → the action reads as "remove".
    const all = range(lo, hi).every((i) => next.has(i));
    for (const i of range(lo, hi)) {
      if (all) next.delete(i);
      else next.add(i);
    }
    setSel(null);
    onMarksChange(next);
  };

  const onWordPress = (i: number, tok: string, e: GestureResponderEvent) => {
    // In selection mode a tap extends the highlight to this word.
    if (selecting) {
      setSel((s) => (s ? { a: s.a, b: i } : { a: i, b: i }));
      return;
    }
    // Otherwise: double-tap the same word → translate that single word.
    const now = Date.now();
    const { pageX, pageY } = e.nativeEvent;
    if (lastTap.current.key === i && now - lastTap.current.time < 300) {
      lastTap.current = { key: -1, time: 0 };
      const clean = tok.replace(/[^A-Za-z]/g, '');
      if (clean) lookup(clean, { x: pageX, y: pageY });
    } else {
      lastTap.current = { key: i, time: now };
    }
  };

  const translate = () => {
    const clean = sel ? tokens.slice(lo, hi + 1).join('').trim() : '';
    setSel(null);
    if (!clean) return;
    const screen = Dimensions.get('window');
    const at = { x: screen.width / 2, y: screen.height * 0.34 };
    // A single word still gets the word popover (audio + save).
    if (/^[A-Za-z]+$/.test(clean)) lookup(clean, at);
    else translatePhrase(clean, at);
  };

  return (
    <View>
      <AppText variant={variant} style={style} onTextLayout={onTextLayout}>
        {tokens.map((tok, i) => {
          if (!isWord(tok)) {
            // Whitespace inside a range keeps that highlight continuous.
            const inSel = i > lo && i < hi;
            const inMark = marked(i);
            return inSel || inMark || spoken(i) ? (
              <AppText
                key={i}
                variant={variant}
                style={[style, inSel ? styles.hl : inMark ? styles.mark : styles.spoken]}
              >
                {tok}
              </AppText>
            ) : (
              tok
            );
          }
          const highlighted = i >= lo && i <= hi;
          return (
            <AppText
              key={i}
              variant={variant}
              // Live selection wins over a saved highlight, which wins over
              // the read-along tint.
              style={[
                style,
                highlighted ? styles.hl : marked(i) ? styles.mark : spoken(i) && styles.spoken,
              ]}
              onPress={(e: GestureResponderEvent) => onWordPress(i, tok, e)}
              onLongPress={() => setSel({ a: i, b: i })}
              suppressHighlighting
            >
              {tok}
            </AppText>
          );
        })}
      </AppText>

      {selecting ? (
        <View style={styles.actions}>
          {onMarksChange ? (
            <Pressable
              onPress={toggleMark}
              style={({ pressed }) => [styles.markChip, pressed && styles.pressed]}
            >
              <Ionicons name="color-wand-outline" size={16} color={colors.text} />
              <AppText variant="label" color={colors.text}>{t('highlightSelection')}</AppText>
            </Pressable>
          ) : null}
          <Pressable onPress={translate} style={({ pressed }) => [styles.translateChip, pressed && styles.pressed]}>
            <Ionicons name="language" size={16} color={colors.white} />
            <AppText variant="label" color={colors.white}>{t('translateSelection')}</AppText>
          </Pressable>
          <Pressable onPress={() => setSel(null)} style={({ pressed }) => [styles.cancelChip, pressed && styles.pressed]}>
            <AppText variant="label" color={colors.textSecondary}>{t('cancel')}</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  hl: { backgroundColor: colors.primarySoft },
  // Read-along: a different tint from `hl` so "being spoken" never reads as
  // "I selected this".
  spoken: { backgroundColor: colors.successSoft },
  /** Хадгалагдсан тэмдэглэгээ — цаасан дээрх маркер шиг шар, сонголтоос ялгаатай. */
  mark: { backgroundColor: colors.warningSoft },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  translateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
  },
  markChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
  },
  cancelChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.85 },
});
