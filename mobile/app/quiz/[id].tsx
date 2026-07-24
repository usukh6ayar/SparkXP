import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useAuth } from '../../src/auth/AuthContext';
import * as quizzesApi from '../../src/api/quizzes';
import type { Quiz, AnswerItem, QuizResult } from '../../src/api/quizzes';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { PressableScale } from '../../src/components/PressableScale';
import { AppImage } from '../../src/components/AppImage';
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
import { formatBand } from '../../src/constants/ielts';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, fontSize, type AppColors } from '../../src/theme/theme';
import { bounded } from '../../src/theme/responsive';

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

/** One stat pill on the result screen (correct count / XP / combo). */
function StatTile({ value, label, color, bg, sub }: {
  value: string; label: string; color: string; bg: string; sub: string;
}) {
  return (
    <View style={[tileStyles.tile, { backgroundColor: bg }]}>
      <AppText variant="h2" color={color}>{value}</AppText>
      <AppText variant="caption" color={sub}>{label}</AppText>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: 2,
  },
});

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
  // IELTS Reading passage panel + Listening playback.
  const [passageOpen, setPassageOpen] = useState(true);
  const audio = useAudioPlayer();
  const playing = useAudioPlayerStatus(audio).playing;

  /** Play / pause the IELTS Listening recording (pause keeps the position, so a
   *  student can stop mid-section and resume instead of restarting). */
  function toggleAudio() {
    if (playing) audio.pause();
    else audio.play();
  }

  const load = useCallback(() => {
    setPhase('loading');
    return quizzesApi.getQuiz(id!, token!)
      .then((q) => { setQuiz(q); setPhase('quiz'); })
      .catch(() => setPhase('error'));
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  // Load the IELTS Listening recording once the quiz arrives (nothing to do for
  // ordinary quizzes, which have no audioUrl).
  useEffect(() => {
    if (quiz?.audioUrl) audio.replace({ uri: quiz.audioUrl });
  }, [quiz?.audioUrl]);

  // Celebrate (or commiserate) the moment results land. On a pass with XP the
  // "+XP" toast already carries a success haptic, so we don't double it up.
  useEffect(() => {
    if (phase !== 'result' || !result) return;
    if (quiz?.audioUrl) audio.pause(); // the IELTS recording shouldn't outlive the test
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

  function canAnswer() {
    if (currentQ?.type === 'multiple_choice') return selected !== null;
    if (currentQ?.type === 'word_match') {
      const n = currentQ.pairs?.length ?? 0;
      return n > 0 && Object.keys(matches).length === n;
    }
    return fillText.trim().length > 0;
  }

  /** The full answer list including the current question's choice. */
  function answersWithCurrent(): AnswerItem[] {
    const rest = answers.filter((a) => a.questionIndex !== currentIndex);
    return [...rest, { questionIndex: currentIndex, answer: currentAnswer() }];
  }

  /**
   * Save the current answer and move on — no per-question feedback. The last
   * question submits the whole set; grading happens server-side and the score
   * only appears at the end.
   */
  function advance() {
    if (!canAnswer() || submitting) return;
    haptics.select();
    const all = answersWithCurrent();
    setAnswers(all);
    if (isLast) submit(all);
    else nextQuestion();
  }

  function nextQuestion() {
    setSelected(null);
    setFillText('');
    setMatches({});
    setCurrentIndex((i) => i + 1);
  }

  async function submit(all: AnswerItem[]) {
    setSubmitting(true);
    try {
      const res = await quizzesApi.submitQuiz(id!, all, token!);
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
    const combo = bestCombo(result.breakdown);
    const accent = result.passed ? c.success : c.danger;
    return (
      <SafeAreaView style={styles.safe}>
        {result.passed && <Confetti />}
        <ScrollView contentContainerStyle={[styles.resultContainer, bounded]}>
          {/* Hero: verdict + big score ring */}
          <Animated.View entering={FadeInDown.springify().damping(14)}>
            <Card variant="raised" padding="xl" style={styles.heroCard}>
              <Text style={styles.resultEmoji}>{result.passed ? '🎉' : '😅'}</Text>
              <AppText variant="h1" center>
                {result.passed ? t('quizPassed') : t('quizTryAgain')}
              </AppText>
              <View style={[styles.scoreRing, { borderColor: accent }]}>
                <CountUp value={result.percentage} suffix="%" variant="display"
                  color={accent} style={styles.ringScore} />
              </View>
              <AppText variant="caption" center color={c.textSecondary}>
                {tf('scoreLine', { score: result.score, total: result.total })}
              </AppText>
              {/* IELTS Listening/Reading — the server's approximate band (0–9). */}
              {result.band !== undefined ? (
                <View style={styles.bandBox}>
                  <AppText variant="overline" color={c.textSecondary}>{t('ieltsBandLabel')}</AppText>
                  <AppText variant="display" color={c.xp}>{formatBand(result.band)}</AppText>
                  <AppText variant="caption" center color={c.textMuted}>{t('ieltsBandHint')}</AppText>
                </View>
              ) : null}
            </Card>
          </Animated.View>

          {/* At-a-glance stats */}
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.statRow}>
            <StatTile value={`${result.score}/${result.total}`} label={t('resultCorrectLabel')}
              color={c.success} bg={c.surfaceAlt} sub={c.textSecondary} />
            {result.xpEarned > 0 && (
              <StatTile value={`+${result.xpEarned}`} label={t('xp')}
                color={c.primary} bg={c.surfaceAlt} sub={c.textSecondary} />
            )}
            {combo >= 2 && (
              <StatTile value={`🔥 ${combo}`} label={t('resultComboLabel')}
                color={c.streak} bg={c.surfaceAlt} sub={c.textSecondary} />
            )}
          </Animated.View>

          {/* Per-question breakdown as compact chips */}
          <AppText variant="overline" color={c.textSecondary} style={styles.breakdownTitle}>
            {t('resultBreakdownTitle')}
          </AppText>
          <View style={styles.chipWrap}>
            {result.breakdown.map((b, i) => (
              <Animated.View
                key={b.questionIndex}
                entering={FadeInDown.delay(300 + i * 40)}
                style={[styles.chip, { backgroundColor: b.correct ? c.successSoft : c.dangerSoft }]}
              >
                <Text style={[styles.chipNum, { color: b.correct ? c.success : c.danger }]}>
                  {b.questionIndex + 1}
                </Text>
                <Text style={[styles.chipMark, { color: b.correct ? c.success : c.danger }]}>
                  {b.correct ? '✓' : '✗'}
                </Text>
              </Animated.View>
            ))}
          </View>

          <Button label={t('finish')} onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <AppText variant="h3" numberOfLines={1} style={styles.headerTitle}>
          {quiz!.title}
        </AppText>
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

      <ScrollView contentContainerStyle={[styles.container, bounded]}>

        {/* IELTS Listening — the section recording, replayable at any time. */}
        {quiz!.audioUrl ? (
          <PressableScale haptic={false} onPress={toggleAudio} style={styles.audioBar}>
            <Ionicons name={playing ? 'pause' : 'play'} size={22} color={c.primary} />
            <AppText variant="bodyStrong" color={c.primary}>
              {playing ? t('ieltsAudioPause') : t('ieltsAudioPlay')}
            </AppText>
          </PressableScale>
        ) : null}

        {/* IELTS Reading — the passage, open by default and collapsible so the
            questions stay reachable on a phone screen. */}
        {quiz!.passageText ? (
          <View style={styles.passageBox}>
            <Pressable onPress={() => setPassageOpen((v) => !v)} hitSlop={6} style={styles.passageHead}>
              <AppText variant="bodyStrong">{t('ieltsPassage')}</AppText>
              <Ionicons name={passageOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
            </Pressable>
            {passageOpen ? (
              <AppText variant="body" style={styles.passageText}>{quiz!.passageText}</AppText>
            ) : null}
          </View>
        ) : null}
        <AppText variant="h2" style={styles.questionText}>
          {currentQ!.question ?? (currentQ!.type === 'word_match' ? t('matchPairsPrompt') : '')}
        </AppText>

        {currentQ!.type === 'multiple_choice' && currentQ!.imageUrl ? (
          <AppImage
            source={{ uri: currentQ!.imageUrl }}
            width={800}
            style={styles.questionImage}
            contentFit="cover"
          />
        ) : null}

        {currentQ!.type === 'multiple_choice' && (
          <View style={styles.optionsContainer}>
            {currentQ!.options!.map((opt, i) => {
              const isSel = selected === i;
              return (
                <PressableScale
                  key={i}
                  haptic={false}
                  style={[styles.option, isSel && styles.optionSelected]}
                  onPress={() => { haptics.select(); setSelected(i); }}
                >
                  <Text style={[styles.optionLabel, isSel && styles.optionLabelSelected]}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                  <AppText variant="body" style={[styles.optionText, isSel && styles.optionTextSelected]}>
                    {opt}
                  </AppText>
                </PressableScale>
              );
            })}
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
            onAssign={(leftIndex, right) => {
              setMatches((m) => {
                // Drop the right value from any other left it was on (1:1 mapping).
                const next: Record<number, string> = {};
                for (const [k, v] of Object.entries(m)) if (v !== right) next[Number(k)] = v;
                next[leftIndex] = right;
                return next;
              });
            }}
          />
        )}

        <Button
          label={isLast ? (submitting ? t('submitting') : t('finish')) : t('continue')}
          onPress={advance}
          disabled={!canAnswer() || submitting}
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
  backBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  progress: { color: c.textMuted, fontSize: fontSize.sm },
  container: { padding: spacing.lg, paddingTop: spacing.md },

  // IELTS: Listening player bar, Reading passage panel, result band.
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: c.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  passageBox: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  passageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passageText: { lineHeight: 24 },
  bandBox: { alignItems: 'center', marginTop: spacing.md, gap: 2 },
  questionText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: c.navy,
    marginBottom: spacing.xl,
    lineHeight: 30,
  },
  questionImage: {
    width: '100%',
    // Width-relative height → scales with the screen instead of a fixed 200.
    aspectRatio: 16 / 9,
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
  resultContainer: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  heroCard: { alignItems: 'center', gap: spacing.sm },
  resultEmoji: { fontSize: 64, textAlign: 'center' },
  scoreRing: {
    width: 132, height: 132, borderRadius: 66,
    borderWidth: 6,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
  ringScore: { fontSize: 40, lineHeight: 44, fontWeight: '900' },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  breakdownTitle: { marginBottom: -spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 46,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  chipNum: { fontWeight: '800', fontSize: fontSize.sm },
  chipMark: { fontWeight: '800', fontSize: fontSize.md },
});
