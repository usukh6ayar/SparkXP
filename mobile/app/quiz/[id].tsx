import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as quizzesApi from '../../src/api/quizzes';
import type { Quiz, AnswerItem, QuizResult } from '../../src/api/quizzes';
import { Button } from '../../src/components/Button';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { PressableScale } from '../../src/components/PressableScale';
import { WordMatchBoard } from '../../src/components/WordMatchBoard';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Confetti } from '../../src/components/Confetti';
import { CountUp } from '../../src/components/CountUp';
import { AppText } from '../../src/components/Text';
import { haptics } from '../../src/lib/haptics';
import { markExerciseCompleted } from '../../src/lib/exerciseProgress';
import { showXpToast } from '../../src/lib/xpToast';
import { alertError } from '../../src/lib/alerts';
import { t, tf } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, fontSize, type AppColors } from '../../src/theme/theme';

type Phase = 'loading' | 'quiz' | 'result' | 'error';

/** Longest run of consecutive correct answers — the quiz "combo" (Duolingo feel).
 *  Computed from the graded breakdown (no per-question data needed client-side). */
function bestCombo(breakdown: QuizResult['breakdown']): number {
  let best = 0, run = 0;
  for (const b of breakdown) {
    run = b.correct ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  const [fillText, setFillText] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  // word_match: leftIndex → chosen right value (drag/tap handled in WordMatchBoard).
  const [matches, setMatches] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setPhase('loading');
    return quizzesApi.getQuiz(id!, token!)
      .then((q) => { setQuiz(q); setPhase('quiz'); })
      .catch(() => setPhase('error'));
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  // Celebrate (or commiserate) the moment results land. On a pass with XP the
  // "+XP" toast already carries a success haptic, so we don't double it up.
  useEffect(() => {
    if (phase !== 'result' || !result) return;
    if (result.passed) {
      if (result.xpEarned > 0) showXpToast(result.xpEarned);
      else haptics.success();
    } else {
      haptics.error();
    }
  }, [phase, result]);

  const currentQ = quiz?.questions[currentIndex];
  const isLast = quiz ? currentIndex === quiz.questions.length - 1 : false;

  // word_match: right column shuffled once per question.
  const shuffledRights = useMemo(() => {
    if (currentQ?.type !== 'word_match' || !currentQ.pairs) return [];
    return [...currentQ.pairs.map((p) => p.right)].sort(() => Math.random() - 0.5);
  }, [currentIndex, currentQ]);

  /** The answer value for the current question, in the shape the server grades. */
  function currentAnswer(): number | string {
    if (currentQ?.type === 'multiple_choice') return selected!;
    if (currentQ?.type === 'word_match') {
      return JSON.stringify((currentQ.pairs ?? []).map((p, i) => ({ left: p.left, right: matches[i] ?? '' })));
    }
    return fillText.trim();
  }

  function saveAnswer() {
    const answer = currentAnswer();
    setAnswers((prev) => {
      const next = prev.filter((a) => a.questionIndex !== currentIndex);
      return [...next, { questionIndex: currentIndex, answer }];
    });
  }

  function canAdvance() {
    if (currentQ?.type === 'multiple_choice') return selected !== null;
    if (currentQ?.type === 'word_match') {
      const n = currentQ.pairs?.length ?? 0;
      return n > 0 && Object.keys(matches).length === n;
    }
    return fillText.trim().length > 0;
  }

  function nextQuestion() {
    saveAnswer();
    setSelected(null);
    setFillText('');
    setMatches({});
    setCurrentIndex((i) => i + 1);
  }

  async function handleSubmit() {
    saveAnswer();
    const finalAnswers: AnswerItem[] = [
      ...answers.filter((a) => a.questionIndex !== currentIndex),
      { questionIndex: currentIndex, answer: currentAnswer() },
    ];
    setSubmitting(true);
    try {
      const res = await quizzesApi.submitQuiz(id!, finalAnswers, token!);
      if (res.passed && id) markExerciseCompleted(id); // local mirror → checkmark on the list
      setResult(res);
      setPhase('result');
    } catch {
      alertError(t('submitAnswerError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Skeleton height={4} radius={2} style={{ marginBottom: spacing.xl }} />
          <Skeleton height={22} width="90%" style={{ marginBottom: spacing.xxl }} />
          <View style={styles.optionsContainer}>
            <Skeleton height={56} radius={radius.md} />
            <Skeleton height={56} radius={radius.md} />
            <Skeleton height={56} radius={radius.md} />
            <Skeleton height={56} radius={radius.md} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('quizRunnerLoadError')}
          action={{ label: t('retry'), onPress: load }}
        />
      </SafeAreaView>
    );
  }

  if (phase === 'result' && result) {
    return (
      <SafeAreaView style={styles.safe}>
        {result.passed && <Confetti />}
        <ScrollView contentContainerStyle={styles.container}>
          <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.resultHead}>
            <Text style={styles.resultEmoji}>{result.passed ? '🎉' : '😅'}</Text>
            <AppText variant="h1" center>
              {result.passed ? t('quizPassed') : t('quizTryAgain')}
            </AppText>
            <CountUp value={result.percentage} suffix="%" variant="display" color={c.primary}
              style={styles.resultScore} />
            <AppText variant="caption" center>
              {tf('scoreLine', { score: result.score, total: result.total })}
            </AppText>
          </Animated.View>

          <View style={styles.badgeRow}>
            {result.xpEarned > 0 && (
              <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.xpBadge}>
                <CountUp value={result.xpEarned} prefix="+" suffix=" XP ⚡" variant="bodyStrong"
                  color={c.primary} />
              </Animated.View>
            )}
            {bestCombo(result.breakdown) >= 2 && (
              <Animated.View entering={FadeInDown.delay(380).springify()} style={styles.comboBadge}>
                <AppText variant="bodyStrong" color={c.streak}>
                  {tf('comboLabel', { count: bestCombo(result.breakdown) })}
                </AppText>
              </Animated.View>
            )}
          </View>

          <View style={styles.breakdownBox}>
            {result.breakdown.map((b, i) => (
              <Animated.View
                key={b.questionIndex}
                entering={FadeInDown.delay(360 + i * 50)}
                style={styles.breakdownRow}
              >
                <Text style={styles.breakdownNum}>{b.questionIndex + 1}</Text>
                <Text style={b.correct ? styles.correct : styles.wrong}>
                  {b.correct ? '✓' : '✗'}
                </Text>
                <Text style={styles.breakdownPts}>{b.points} {t('pointsUnit')}</Text>
              </Animated.View>
            ))}
          </View>

          <Button label={t('finish')} onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backBtn}>← {t('back')}</Text>
        </Pressable>
        <Text style={styles.progress}>
          {currentIndex + 1} / {quiz!.questions.length}
        </Text>
      </View>

      {/* Progress bar — eases to its new value on each question. */}
      <ProgressBar
        value={(currentIndex + 1) / quiz!.questions.length}
        height={4}
        style={{ marginHorizontal: spacing.lg }}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <AppText variant="caption" style={styles.quizTitle}>{quiz!.title}</AppText>
        <AppText variant="h2" style={styles.questionText}>
          {currentQ!.question ?? (currentQ!.type === 'word_match' ? t('matchPairsPrompt') : '')}
        </AppText>

        {currentQ!.type === 'multiple_choice' && currentQ!.imageUrl ? (
          <Image source={{ uri: currentQ!.imageUrl }} style={styles.questionImage} resizeMode="cover" />
        ) : null}

        {currentQ!.type === 'multiple_choice' && (
          <View style={styles.optionsContainer}>
            {currentQ!.options!.map((opt, i) => (
              <PressableScale
                key={i}
                haptic={false}
                style={[styles.option, selected === i && styles.optionSelected]}
                onPress={() => { haptics.select(); setSelected(i); }}
              >
                <Text style={[styles.optionLabel, selected === i && styles.optionLabelSelected]}>
                  {String.fromCharCode(65 + i)}
                </Text>
                <AppText variant="body" style={[styles.optionText, selected === i && styles.optionTextSelected]}>
                  {opt}
                </AppText>
              </PressableScale>
            ))}
          </View>
        )}

        {currentQ!.type === 'fill_blank' && (
          <TextInput
            style={styles.fillInput}
            value={fillText}
            onChangeText={setFillText}
            placeholder={t('yourAnswer')}
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
          />
        )}

        {currentQ!.type === 'word_match' && (
          <WordMatchBoard
            pairs={currentQ!.pairs ?? []}
            rights={shuffledRights}
            matches={matches}
            onAssign={(leftIndex, right) =>
              setMatches((m) => {
                // Drop the right value from any other left it was on (1:1 mapping).
                const next: Record<number, string> = {};
                for (const [k, v] of Object.entries(m)) if (v !== right) next[Number(k)] = v;
                next[leftIndex] = right;
                return next;
              })
            }
          />
        )}

        <Button
          label={isLast ? (submitting ? t('submitting') : t('submit')) : t('next')}
          onPress={isLast ? handleSubmit : nextQuestion}
          disabled={!canAdvance() || submitting}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { color: c.primary, fontWeight: '600', fontSize: fontSize.md },
  progress: { color: c.textMuted, fontSize: fontSize.sm },
  container: { padding: spacing.lg, paddingTop: spacing.md },
  quizTitle: { fontSize: fontSize.sm, color: c.textMuted, marginBottom: spacing.sm },
  questionText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: c.navy,
    marginBottom: spacing.xl,
    lineHeight: 30,
  },
  questionImage: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
    marginBottom: spacing.lg,
  },
  optionsContainer: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  optionSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  optionLabel: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceAlt,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
    color: c.textMuted,
    fontSize: fontSize.sm,
  },
  optionLabelSelected: { backgroundColor: c.primary, color: c.white },
  optionText: { flex: 1, fontSize: fontSize.md, color: c.text },
  optionTextSelected: { color: c.navy, fontWeight: '600' },
  fillInput: {
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: c.text,
  },
  errorText: { color: c.danger, fontSize: fontSize.md },
  // Result styles
  resultHead: { alignItems: 'center', marginBottom: spacing.lg },
  resultEmoji: { fontSize: 64, textAlign: 'center', marginBottom: spacing.sm },
  resultScore: { fontSize: 56, lineHeight: 60, fontWeight: '900', marginTop: spacing.sm },
  badgeRow: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap',
    gap: spacing.sm, marginBottom: spacing.lg,
  },
  xpBadge: {
    backgroundColor: c.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  comboBadge: {
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  breakdownBox: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  breakdownNum: { width: 24, fontWeight: '700', color: c.textMuted, fontSize: fontSize.sm },
  correct: { fontSize: fontSize.lg, color: c.success },
  wrong: { fontSize: fontSize.lg, color: c.danger },
  breakdownPts: { color: c.textMuted, fontSize: fontSize.sm },
});
