import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../Text';
import { Button } from '../Button';
import { useColors } from '../../settings/SettingsContext';
import { formatBand } from '../../constants/ielts';
import type { QuizQuestion, QuizResult } from '../../api/quizzes';
import type { ExamAnswer } from './ExamQuestion';
import { t, tf } from '../../i18n';
import { spacing, radius, type AppColors } from '../../theme/theme';

/**
 * What the paper scored.
 *
 * The band is the headline because it is the only number that means anything
 * outside this app — "8 of 12" is a set-size artefact, a band is comparable to
 * the real exam. The review below marks each question right or wrong and shows
 * what was written; it deliberately does NOT reveal the key, because the answers
 * are not in the submit response and the per-question check endpoint costs the
 * student a heart.
 */
export function ExamResult({
  result,
  questions,
  answers,
  onRetake,
  onLeave,
}: {
  result: QuizResult;
  questions: QuizQuestion[];
  answers: Record<number, ExamAnswer>;
  onRetake: () => void;
  onLeave: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const correctByIndex = useMemo(
    () => new Map(result.breakdown.map((b) => [b.questionIndex, b.correct])),
    [result.breakdown],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <LinearGradient
          colors={c.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {result.band !== undefined ? (
          <>
            <AppText variant="overline" color={c.textOnDarkMuted}>{t('ieltsBandLabel')}</AppText>
            <AppText variant="display" color={c.white}>{formatBand(result.band)}</AppText>
          </>
        ) : (
          <AppText variant="display" color={c.white}>{result.percentage}%</AppText>
        )}
        <AppText variant="bodyStrong" color={c.white}>
          {tf('ieltsScoreLine', { score: result.score, total: result.total })}
        </AppText>
        {result.xpEarned > 0 ? (
          <View style={styles.xpChip}>
            <Ionicons name="flash" size={14} color={c.xp} />
            <AppText variant="caption" color={c.white}>+{result.xpEarned} XP</AppText>
          </View>
        ) : null}
      </View>

      {result.band !== undefined ? (
        <AppText variant="caption" center color={c.textMuted}>{t('ieltsBandHint')}</AppText>
      ) : null}

      <AppText variant="h3">{t('ieltsReviewTitle')}</AppText>
      <View style={styles.review}>
        {questions.map((question, index) => {
          const correct = correctByIndex.get(index) ?? false;
          const given = answers[index];
          return (
            <View key={index} style={styles.row}>
              <View style={[styles.mark, { backgroundColor: correct ? c.successSoft : c.dangerSoft }]}>
                <Ionicons
                  name={correct ? 'checkmark' : 'close'}
                  size={15}
                  color={correct ? c.success : c.danger}
                />
              </View>
              <View style={styles.rowBody}>
                <AppText variant="caption" color={c.textMuted}>
                  {tf('ieltsQuestionNo', { n: index + 1 })}
                </AppText>
                <AppText variant="body" numberOfLines={2}>
                  {question.question ?? question.prompt ?? ''}
                </AppText>
                <AppText variant="caption" color={c.textSecondary}>
                  {t('ieltsYourAnswer')}: {describeAnswer(question, given)}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>

      <Button label={t('ieltsRetake')} icon="refresh" onPress={onRetake} />
      <Button label={t('back')} variant="ghost" onPress={onLeave} />
    </ScrollView>
  );
}

/** The student's answer as readable text, whatever format it was stored in. */
function describeAnswer(question: QuizQuestion, value: ExamAnswer | undefined): string {
  if (value === undefined || value === '') return '—';
  if (question.type === 'multiple_choice' && typeof value === 'number') {
    return question.options?.[value] ?? String(value);
  }
  if (question.type === 'word_match' && typeof value === 'string') {
    try {
      const pairs: { left: string; right: string }[] = JSON.parse(value);
      return pairs.map((p) => `${p.left} → ${p.right}`).join(', ');
    } catch {
      return value;
    }
  }
  return String(value);
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    hero: {
      alignItems: 'center',
      gap: 2,
      paddingVertical: spacing.xl,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    xpChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    review: { gap: spacing.sm },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.surface,
    },
    mark: {
      width: 26,
      height: 26,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 2 },
  });
