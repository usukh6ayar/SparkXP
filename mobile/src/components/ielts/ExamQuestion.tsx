import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { AppImage } from '../AppImage';
import { SpeakingAnswer } from './SpeakingAnswer';
import { useColors } from '../../settings/SettingsContext';
import { haptics } from '../../lib/haptics';
import type { QuizQuestion } from '../../api/quizzes';
import { t } from '../../i18n';
import { spacing, radius, type AppColors } from '../../theme/theme';

/** Answer value as the API expects it: index for MC, string for the rest. */
export type ExamAnswer = number | string;

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * One numbered question, rendered the way its format is actually answered in an
 * IELTS paper.
 *
 * Each format gets the shape the exam uses, not a generic quiz row: multiple
 * choice is a lettered list (examiners and answer keys speak in A/B/C/D), gap
 * fill keeps the sentence intact and puts the blank inside it, and matching is
 * one row per stem so the whole set reads as a single task. The card never
 * says whether an answer is right — nothing is graded until the paper is
 * submitted, and marking as you go would turn the test into a drill.
 */
export function ExamQuestion({
  question,
  number,
  value,
  onChange,
  openMode = 'write',
}: {
  question: QuizQuestion;
  /** 1-based number shown to the student. */
  number: number;
  value: ExamAnswer | undefined;
  onChange: (value: ExamAnswer) => void;
  /**
   * Задгай даалгаврыг хэрхэн хариулах вэ. Writing бол бичнэ, Speaking бол
   * **ярина** — ярих шалгалтад бичих талбар тавих нь огт өөр чадвар дасгалжуулж
   * байгаа хэрэг (хэн ч IELTS Speaking-ийг бичиж өгдөггүй).
   */
  openMode?: 'write' | 'speak';
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <AppText variant="caption" color={c.white} style={styles.badgeText}>{number}</AppText>
        </View>
        <AppText variant="body" style={styles.stem}>
          {question.type === 'open_response'
            ? question.prompt
            : question.type === 'word_match'
              ? t('ieltsMatchPick')
              : question.question}
        </AppText>
      </View>

      {question.imageUrl ? (
        <AppImage source={question.imageUrl} width={640} style={styles.image} contentFit="cover" />
      ) : null}

      {question.type === 'multiple_choice' ? (
        <ChoiceList
          options={question.options ?? []}
          selected={typeof value === 'number' ? value : null}
          onSelect={(i) => { haptics.select(); onChange(i); }}
          styles={styles}
          c={c}
        />
      ) : null}

      {question.type === 'fill_blank' ? (
        <GapFill
          choices={question.choices}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          styles={styles}
          c={c}
        />
      ) : null}

      {question.type === 'word_match' ? (
        <Matching
          pairs={question.pairs ?? []}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          styles={styles}
          c={c}
        />
      ) : null}

      {question.type === 'open_response' ? (
        <View style={styles.openWrap}>
          {openMode === 'speak' ? (
            <SpeakingAnswer
              recordedUri={typeof value === 'string' && value ? value : undefined}
              onRecorded={onChange}
            />
          ) : (
            <TextInput
              style={styles.input}
              multiline
              placeholder={t('ieltsTypeAnswer')}
              placeholderTextColor={c.textMuted}
              value={typeof value === 'string' ? value : ''}
              onChangeText={onChange}
            />
          )}

          {/* Жишиг хариулт — өөрийгөө харьцуулах цорын ганц хэмжүүр тул
              заавал байх ёстой, гэхдээ оролдохоос ӨМНӨ харвал утгагүй. */}
          {question.modelAnswer ? (
            <ModelAnswer text={question.modelAnswer} styles={styles} c={c} />
          ) : null}

          <AppText variant="caption" color={c.textMuted}>
            {openMode === 'speak' ? t('ieltsSpeakNote') : t('ieltsSelfStudyNote')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** A/B/C/D rows — the shape an IELTS answer key is written in. */
function ChoiceList({
  options, selected, onSelect, styles, c,
}: {
  options: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  styles: Styles;
  c: AppColors;
}) {
  return (
    <View style={styles.options}>
      {options.map((option, i) => {
        const on = selected === i;
        return (
          <Pressable
            key={`${option}-${i}`}
            onPress={() => onSelect(i)}
            style={[styles.option, on && styles.optionOn]}
          >
            <View style={[styles.letter, on && styles.letterOn]}>
              <AppText variant="caption" color={on ? c.white : c.textSecondary}>
                {LETTERS[i] ?? i + 1}
              </AppText>
            </View>
            <AppText variant="body" color={on ? c.primary : c.text} style={styles.optionText}>
              {option}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Gap fill. With `choices` the student picks a word (typing a perfect spelling
 * under time pressure is a different skill from the one being tested here);
 * without them it falls back to a text field, which is what older sets have.
 */
function GapFill({
  choices, value, onChange, styles, c,
}: {
  choices?: string[];
  value: string;
  onChange: (value: string) => void;
  styles: Styles;
  c: AppColors;
}) {
  if (!choices?.length) {
    return (
      <TextInput
        style={styles.input}
        placeholder={t('ieltsTypeAnswer')}
        placeholderTextColor={c.textMuted}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
      />
    );
  }

  return (
    <View style={styles.chips}>
      {choices.map((choice) => {
        const on = value === choice;
        return (
          <Pressable
            key={choice}
            onPress={() => { haptics.select(); onChange(choice); }}
            style={[styles.chip, on && styles.chipOn]}
          >
            <AppText variant="bodyStrong" color={on ? c.white : c.text}>{choice}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Matching — one row per stem, options scroll beside it.
 *
 * The whole task is a single graded question (the API marks it all-or-nothing),
 * so the answer travels as one JSON string of the chosen pairs.
 */
function Matching({
  pairs, value, onChange, styles, c,
}: {
  pairs: { left: string; right: string }[];
  value: string;
  onChange: (value: string) => void;
  styles: Styles;
  c: AppColors;
}) {
  const picked = useMemo<Record<string, string>>(() => {
    try {
      const parsed: unknown = value ? JSON.parse(value) : [];
      if (!Array.isArray(parsed)) return {};
      return Object.fromEntries(
        parsed.map((p: { left: string; right: string }) => [p.left, p.right]),
      );
    } catch {
      return {};
    }
  }, [value]);

  // Shown in the authored order; the correct pairing is never implied by it
  // because every stem offers the same full list.
  const options = pairs.map((p) => p.right);

  function choose(left: string, right: string) {
    haptics.select();
    const next = { ...picked, [left]: right };
    onChange(JSON.stringify(Object.entries(next).map(([l, r]) => ({ left: l, right: r }))));
  }

  return (
    <View style={styles.matchWrap}>
      {pairs.map((pair) => (
        <View key={pair.left} style={styles.matchRow}>
          <AppText variant="bodyStrong" style={styles.matchLeft}>{pair.left}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {options.map((option) => {
              const on = picked[pair.left] === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => choose(pair.left, option)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <AppText variant="caption" color={on ? c.white : c.textSecondary}>{option}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

/** Жишиг хариулт — дарж нээнэ (өмнө нь харвал өөрийгөө сорих утга алдагдана). */
function ModelAnswer({ text, styles, c }: { text: string; styles: Styles; c: AppColors }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.modelWrap}>
      <Pressable
        onPress={() => { haptics.tap(); setOpen((v) => !v); }}
        style={styles.modelHead}
      >
        <Ionicons
          name={open ? 'eye-off-outline' : 'eye-outline'}
          size={16}
          color={c.primary}
        />
        <AppText variant="caption" color={c.primary} style={styles.modelLabel}>
          {t(open ? 'ieltsHideModel' : 'ieltsRevealModel')}
        </AppText>
      </Pressable>
      {open ? (
        <AppText variant="body" color={c.textSecondary} style={styles.modelText}>
          {text}
        </AppText>
      ) : null}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    head: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    badge: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 5,
      borderRadius: radius.full,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontWeight: '700' },
    stem: { flex: 1, lineHeight: 23 },
    image: { width: '100%', height: 170, borderRadius: radius.md },
    options: { gap: spacing.sm },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    optionOn: { borderColor: c.primary, backgroundColor: c.primarySoft },
    letter: {
      width: 26,
      height: 26,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    letterOn: { backgroundColor: c.primary },
    optionText: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    input: {
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 46,
      color: c.text,
      fontSize: 16,
    },
    openWrap: { gap: spacing.sm },
    modelWrap: { gap: spacing.xs },
    modelHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    modelLabel: { fontWeight: '700' },
    modelText: { lineHeight: 23 },
    matchWrap: { gap: spacing.md },
    matchRow: { gap: spacing.xs },
    matchLeft: { color: c.text },
  });
