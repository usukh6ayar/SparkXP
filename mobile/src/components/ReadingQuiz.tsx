import { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { type ReadingQuestion } from '../api/reading';
import { t } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';

/** True if a fill-blank answer matches (case-insensitive, trimmed). */
function fillCorrect(q: ReadingQuestion, ans: string): boolean {
  return (ans ?? '').trim().toLowerCase() === (q.answer ?? '').trim().toLowerCase();
}

/**
 * Comprehension quiz shown after finishing a reading passage. Questions come
 * from the passage (`comprehensionQuestions`, AI-generated in admin). Two answer
 * modes: multiple_choice (tap an option) and fill_blank (type). Correctness is
 * checked on-device — reading passages return their answers to the client (same
 * as keyVocab). No extra XP: the +15 is awarded for finishing the reading.
 */
export function ReadingQuiz({ questions }: { questions: ReadingQuestion[] }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // answers[i] = chosen option index (MC) or typed string (fill).
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    let s = 0;
    questions.forEach((q, i) => {
      const a = answers[i];
      if (q.type === 'multiple_choice') {
        if (a === q.correctIndex) s++;
      } else if (typeof a === 'string' && fillCorrect(q, a)) {
        s++;
      }
    });
    return s;
  }, [answers, questions]);

  if (!questions || questions.length === 0) return null;

  const allAnswered = questions.every((q, i) => {
    const a = answers[i];
    return q.type === 'multiple_choice' ? typeof a === 'number' : typeof a === 'string' && a.trim().length > 0;
  });

  return (
    <View style={styles.wrap}>
      <AppText variant="h3" style={styles.heading}>{t('questionsHeading')}</AppText>

      {questions.map((q, i) => {
        const a = answers[i];
        return (
          <View key={i} style={styles.qCard}>
            <AppText variant="bodyStrong" style={styles.qText}>{i + 1}. {q.question}</AppText>

            {q.type === 'multiple_choice' ? (
              (q.options ?? []).map((opt, oi) => {
                const chosen = a === oi;
                const isCorrect = q.correctIndex === oi;
                // After submit: correct = green, wrongly-chosen = red.
                const showCorrect = submitted && isCorrect;
                const showWrong = submitted && chosen && !isCorrect;
                return (
                  <Pressable
                    key={oi}
                    disabled={submitted}
                    onPress={() => setAnswers((m) => ({ ...m, [i]: oi }))}
                    style={[
                      styles.opt,
                      chosen && !submitted && styles.optChosen,
                      showCorrect && styles.optCorrect,
                      showWrong && styles.optWrong,
                    ]}
                  >
                    <Ionicons
                      name={
                        showCorrect ? 'checkmark-circle'
                        : showWrong ? 'close-circle'
                        : chosen ? 'radio-button-on' : 'radio-button-off'
                      }
                      size={18}
                      color={showCorrect ? c.success : showWrong ? c.danger : chosen ? c.primary : c.textMuted}
                    />
                    <AppText variant="body" style={{ flex: 1 }}>{opt}</AppText>
                  </Pressable>
                );
              })
            ) : (
              <>
                <TextInput
                  editable={!submitted}
                  value={typeof a === 'string' ? a : ''}
                  onChangeText={(t) => setAnswers((m) => ({ ...m, [i]: t }))}
                  placeholder={t('yourAnswer')}
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    submitted && (fillCorrect(q, (a as string) ?? '') ? styles.inputCorrect : styles.inputWrong),
                  ]}
                />
                {submitted && !fillCorrect(q, (a as string) ?? '') && (
                  <AppText variant="caption" color={c.success} style={styles.answerHint}>
                    {t('correctAnswerPrefix')} {q.answer}
                  </AppText>
                )}
              </>
            )}
          </View>
        );
      })}

      {submitted ? (
        <View style={styles.result}>
          <Ionicons name="ribbon" size={20} color={c.xp} />
          <AppText variant="bodyStrong">{score} / {questions.length} {t('correctSuffix')}</AppText>
        </View>
      ) : (
        <Pressable
          onPress={() => setSubmitted(true)}
          disabled={!allAnswered}
          style={[styles.checkBtn, !allAnswered && styles.checkBtnOff]}
        >
          <AppText variant="bodyStrong" color={c.white}>{t('checkAnswers')}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: { marginTop: spacing.xl, gap: spacing.md },
    heading: {},
    qCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    qText: {},
    opt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.sm,
    },
    optChosen: { borderColor: c.primary, backgroundColor: c.primarySoft },
    optCorrect: { borderColor: c.success, backgroundColor: c.successSoft },
    optWrong: { borderColor: c.danger, backgroundColor: c.dangerSoft },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: c.text,
      backgroundColor: c.surfaceAlt,
    },
    inputCorrect: { borderColor: c.success },
    inputWrong: { borderColor: c.danger },
    answerHint: { marginTop: 2 },
    result: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    checkBtn: {
      alignItems: 'center',
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
    },
    checkBtnOff: { opacity: 0.5 },
  });
