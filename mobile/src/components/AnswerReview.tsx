import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { enter } from '../lib/motion';
import { t, tf } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius } from '../theme/theme';

/**
 * One question as the result screen shows it.
 *
 * Answers arrive **already formatted** (`"B. london"`, `"cat → муур"`) because
 * every flow stores them differently — a lesson quiz keeps option indices, the
 * vocabulary games keep the Mongolian string. Formatting belongs to whoever
 * owns the question shape; this component only has to lay it out.
 */
export interface AnswerReviewItem {
  /** 0-based. Displayed as `index + 1`. */
  index: number;
  /** The prompt. Falls back to "N-р асуулт" for flows that have no text. */
  question?: string;
  correct: boolean;
  /** What the student answered. Omit when nothing was recorded. */
  given?: string;
  /** What it should have been. Omit when the flow can't supply it. */
  correctAnswer?: string;
}

/** A labelled answer inside an opened row ("Таны хариулт" → "B. london"). */
function AnswerLine({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useColors();
  return (
    <View style={styles.line}>
      <AppText variant="caption" color={c.textMuted}>{label}</AppText>
      <AppText variant="bodyStrong" color={color}>{value}</AppText>
    </View>
  );
}

/**
 * One question row.
 *
 * Right or wrong — and "wrong" means **wrong on first sight**, which is what
 * every flow here grades. A quiz that repeats a question until it is answered
 * correctly still lists it red, because the run being finished says nothing
 * about what the student knew when the question first appeared.
 */
function AnswerRow({ item, last, delay }: {
  item: AnswerReviewItem;
  /** Suppresses the divider so the card doesn't end on a hairline. */
  last: boolean;
  delay: number;
}) {
  const c = useColors();
  const tint = item.correct ? c.success : c.danger;
  const icon = item.correct ? 'checkmark-circle' : 'close-circle';
  // A right-first-time question has nothing to explain, and some flows can't
  // supply the answer at all (an ungraded open response, a backend that only
  // returns a score) — both stay one clean line rather than opening onto an
  // empty panel.
  const open = !item.correct && item.given !== undefined;

  return (
    <Animated.View
      entering={enter(delay)}
      style={[styles.row, last ? null : { borderBottomWidth: 1, borderBottomColor: c.border }]}
    >
      <View style={styles.head}>
        {/* Tinted from the state at 12% — one number that carries the verdict
            before the icon on the far side is even read. */}
        <View style={[styles.num, { backgroundColor: `${tint}1F` }]}>
          <AppText variant="caption" color={tint}>{item.index + 1}</AppText>
        </View>
        <AppText variant="body" numberOfLines={2} style={styles.question}>
          {item.question ?? tf('resultQuestionNo', { n: item.index + 1 })}
        </AppText>
        <Ionicons name={icon} size={20} color={tint} />
      </View>

      {open ? (
        <View style={[styles.detail, { backgroundColor: c.surfaceAlt }]}>
          <AnswerLine label={t('resultYourAnswer')} value={item.given!} color={c.danger} />
          {item.correctAnswer !== undefined ? (
            <AnswerLine
              label={t('resultCorrectAnswer')}
              value={item.correctAnswer}
              color={c.success}
            />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * **"What did I actually get wrong?" — the one thing a celebration can't tell
 * you.** Shared by every flow that ends in a score, so finishing a vocabulary
 * game teaches as much as finishing a lesson quiz.
 *
 * Rows sit in a single hairline-divided card: a fifteen-question quiz reads as
 * one list instead of fifteen floating boxes. An earlier version showed a grid
 * of ✓/✗ chips AND a separate "what you missed" list — the same information
 * twice, the first time in a form nobody can learn from.
 */
export function AnswerReview({ items, title }: {
  items: AnswerReviewItem[];
  /** Defaults to "Хариултын дэлгэрэнгүй". */
  title?: string;
}) {
  const c = useColors();
  if (items.length === 0) return null;

  // Right first time, every time — the only case that earns the badge.
  const flawless = items.every((i) => i.correct);

  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <AppText variant="overline" color={c.textSecondary}>
          {title ?? t('resultBreakdownTitle')}
        </AppText>
        {flawless ? (
          <View style={styles.flawless}>
            <Ionicons name="shield-checkmark" size={15} color={c.success} />
            <AppText variant="caption" color={c.success}>{t('resultNoMistakes')}</AppText>
          </View>
        ) : null}
      </View>

      <View style={[styles.list, { borderColor: c.border, backgroundColor: c.surface }]}>
        {items.map((item, i) => (
          <AnswerRow
            key={item.index}
            item={item}
            last={i === items.length - 1}
            delay={160 + i * 45}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The header belongs to its list, so they are grouped and spaced tighter
  // than the gap between a result screen's blocks.
  block: { gap: spacing.sm },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flawless: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  list: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },

  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  num: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  question: { flex: 1 },
  detail: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginLeft: 26 + spacing.sm, // aligns under the question, not the number
    padding: spacing.md,
    borderRadius: radius.md,
  },
  line: { gap: 1 },
});
