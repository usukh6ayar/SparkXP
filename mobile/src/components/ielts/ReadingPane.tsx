import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { SelectableText } from '../SelectableText';
import { useColors } from '../../settings/SettingsContext';
import { haptics } from '../../lib/haptics';
import { t, tf } from '../../i18n';
import { spacing, radius, type AppColors } from '../../theme/theme';

/** How much of the screen the passage takes, per size step. */
const HEIGHT_SHARE = { normal: 0.34, tall: 0.55 } as const;
type Size = keyof typeof HEIGHT_SHARE;

/**
 * The Reading passage, sitting above the questions.
 *
 * It used to be behind a "Passage ↔ Questions" toggle, which meant you could
 * never see the text and the question you were answering at the same time —
 * the one thing reading comprehension is actually made of. Now both are on
 * screen: the passage keeps its own scroll in a pane of fixed height, the
 * questions scroll underneath it, and neither hides the other.
 *
 * The pane can be **collapsed** to a single bar (for a question you have
 * already found the answer to) and **enlarged** (for a dense paragraph), so the
 * split is the reader's choice rather than a number we picked.
 *
 * Highlighting is the other half: long-press a word, tap to extend, then
 * **Тэмдэглэх**. The marks are kept per part by the screen above, so scrolling
 * away and coming back does not lose them.
 */
export function ReadingPane({
  text,
  label,
  section,
  marks,
  onMarksChange,
}: {
  text: string;
  /** Passage · Section — the module's word for a part. */
  label: string;
  section: number;
  marks: Set<number>;
  onMarksChange: (marks: Set<number>) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { height } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(false);
  const [size, setSize] = useState<Size>('normal');

  if (!text.trim()) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="document-text-outline" size={16} color={c.primary} />
        <AppText variant="label" color={c.text} style={styles.title}>
          {tf('ieltsPassageTitle', { label, n: section })}
        </AppText>

        {marks.size > 0 ? (
          <Pressable
            onPress={() => { haptics.tap(); onMarksChange(new Set()); }}
            hitSlop={6}
            style={styles.clear}
          >
            <AppText variant="caption" color={c.textMuted}>{t('ieltsClearMarks')}</AppText>
          </Pressable>
        ) : null}

        {/* Enlarge is pointless while collapsed, so it hides with the text. */}
        {!collapsed ? (
          <Pressable
            onPress={() => { haptics.tap(); setSize(size === 'normal' ? 'tall' : 'normal'); }}
            hitSlop={8}
          >
            <Ionicons
              name={size === 'normal' ? 'chevron-expand-outline' : 'chevron-collapse-outline'}
              size={18}
              color={c.textSecondary}
            />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => { haptics.tap(); setCollapsed((v) => !v); }}
          hitSlop={8}
        >
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={c.textSecondary}
          />
        </Pressable>
      </View>

      {!collapsed ? (
        <ScrollView
          style={{ maxHeight: height * HEIGHT_SHARE[size] }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator
          // The passage owns vertical drags inside it; the page keeps the rest.
          nestedScrollEnabled
        >
          <SelectableText
            text={text}
            variant="body"
            style={styles.text}
            marks={marks}
            onMarksChange={onMarksChange}
          />
        </ScrollView>
      ) : null}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: c.surfaceAlt,
    },
    title: { flex: 1, fontWeight: '700' },
    clear: { paddingHorizontal: spacing.xs },
    body: { padding: spacing.md },
    text: { lineHeight: 26 },
  });
