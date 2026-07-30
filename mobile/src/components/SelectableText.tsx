import { useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  type TextStyle,
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
export function SelectableText({
  text,
  variant = 'body',
  style,
  highlightRange,
}: {
  text: string;
  variant?: React.ComponentProps<typeof AppText>['variant'];
  style?: TextStyle;
  /**
   * Character range of `text` to tint separately from the user's own selection
   * — used by read-along to mark the sentence being spoken. `to` is exclusive.
   */
  highlightRange?: { from: number; to: number } | null;
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
    // A single word still gets the richer word popover (audio + save).
    if (/^[A-Za-z]+$/.test(clean)) lookup(clean, at);
    else translatePhrase(clean, at);
  };

  return (
    <View>
      <AppText variant={variant} style={style}>
        {tokens.map((tok, i) => {
          if (!isWord(tok)) {
            // Whitespace inside a range keeps that highlight continuous.
            const inSel = i > lo && i < hi;
            return inSel || spoken(i) ? (
              <AppText key={i} variant={variant} style={[style, inSel ? styles.hl : styles.spoken]}>
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
              // The user's own selection wins over the read-along highlight.
              style={[style, highlighted ? styles.hl : spoken(i) && styles.spoken]}
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  translateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
  },
  cancelChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  pressed: { opacity: 0.85 },
});
