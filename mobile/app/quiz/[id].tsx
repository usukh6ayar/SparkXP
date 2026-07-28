import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable,
} from 'react-native';
import Animated, {
  FadeInDown, SlideInDown, useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useAuth } from '../../src/auth/AuthContext';
import * as quizzesApi from '../../src/api/quizzes';
import type { Quiz, AnswerItem, QuizResult } from '../../src/api/quizzes';
import { getHearts, refillHearts, type HeartsState } from '../../src/api/hearts';
import { getMe } from '../../src/api/auth';
import { HeartsBar } from '../../src/components/HeartsBar';
import { HeartsEmptySheet } from '../../src/components/HeartsEmptySheet';
import { Button } from '../../src/components/Button';
import { AwardBadge } from '../../src/components/AwardBadge';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { PressableScale } from '../../src/components/PressableScale';
import { AppImage } from '../../src/components/AppImage';
import { WordMatchBoard } from '../../src/components/WordMatchBoard';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Confetti } from '../../src/components/Confetti';
import { RewardBurst } from '../../src/components/RewardBurst';
import { CountUp } from '../../src/components/CountUp';
import { AppText } from '../../src/components/Text';
import { haptics } from '../../src/lib/haptics';
import { sound } from '../../src/lib/sound';
import { markExerciseCompleted } from '../../src/lib/exerciseProgress';
import { showXpToast } from '../../src/lib/xpToast';
import { alertError } from '../../src/lib/alerts';
import { t, tf, type TranslationKey } from '../../src/i18n';
import { formatBand } from '../../src/constants/ielts';
import { useColors } from '../../src/settings/SettingsContext';
import { colors, spacing, radius, fontSize, type AppColors } from '../../src/theme/theme';
import { bounded } from '../../src/theme/responsive';

type Phase = 'loading' | 'quiz' | 'result' | 'error';

type RewardFlash = {
  id: number;
  run: number;
  titleKey: TranslationKey;
};

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

/** Performance grade shown on a pass — "EXCELLENT" for a near-perfect score down
 *  to a plain "GOOD", so finishing feels rewarding (not just a bare percentage). */
function gradeKey(percentage: number): 'gradeExcellent' | 'gradeGreat' | 'gradeGood' {
  if (percentage >= 90) return 'gradeExcellent';
  if (percentage >= 75) return 'gradeGreat';
  return 'gradeGood';
}

function praiseKey(run: number): TranslationKey {
  if (run >= 5) return 'correctPraise5';
  if (run >= 3) return 'correctPraise3';
  return run === 2 ? 'correctPraise2' : 'correctPraise1';
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
  const { token, user, updateUser } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  // Presentation order: a queue of question indices (not a plain counter) so a
  // wrong answer can be re-queued to the end (Duolingo). `answers` only ever
  // records the FIRST attempt per index, which is what the score is graded from.
  const [queue, setQueue] = useState<number[]>([]);
  const [queuePos, setQueuePos] = useState(0);
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  // Hearts (lives) — server is the only source of truth (API.md §6a).
  const [hearts, setHearts] = useState<HeartsState | null>(null);
  const [refilling, setRefilling] = useState(false);
  const [fillText, setFillText] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  // word_match: leftIndex → chosen right value (drag/tap handled in WordMatchBoard).
  const [matches, setMatches] = useState<Record<number, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Instant per-question feedback (C2): after answering, we grade THIS question
  // via /check and show ✓/✗ (+ the correct answer) before letting the student
  // move on — instead of silently advancing and only revealing the score at the end.
  const [feedback, setFeedback] = useState<quizzesApi.CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [correctRun, setCorrectRun] = useState(0);
  const [rewardFlash, setRewardFlash] = useState<RewardFlash | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // IELTS Reading passage panel + Listening playback.
  const [passageOpen, setPassageOpen] = useState(true);
  const audio = useAudioPlayer();
  const playing = useAudioPlayerStatus(audio).playing;

  // Wrong-answer shake (C1c): a quick left/right wobble of the answer area.
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  function triggerShake() {
    // Bigger, snappier wobble so a wrong answer is unmistakable (Duolingo feel).
    shakeX.value = withSequence(
      withTiming(-12, { duration: 40 }),
      withTiming(12, { duration: 40 }),
      withTiming(-10, { duration: 40 }),
      withTiming(10, { duration: 40 }),
      withTiming(-6, { duration: 40 }),
      withTiming(6, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  }

  /** Play / pause the IELTS Listening recording (pause keeps the position, so a
   *  student can stop mid-section and resume instead of restarting). */
  function toggleAudio() {
    if (playing) audio.pause();
    else audio.play();
  }

  const load = useCallback(() => {
    setPhase('loading');
    return quizzesApi.getQuiz(id!, token!)
      .then((q) => {
        setQuiz(q);
        setQueue(q.questions.map((_, i) => i)); // start with each question once, in order
        setQueuePos(0);
        setAnswers([]);
        setPhase('quiz');
      })
      .catch(() => setPhase('error'));
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  // Load current hearts once, so the top bar and the out-of-hearts gate are
  // right from the first question (later updates come from /check responses).
  useEffect(() => {
    if (token) getHearts(token).then(setHearts).catch(() => { /* hearts optional */ });
  }, [token]);

  // While blocked at 0 hearts, refetch exactly when the next heart regenerates so
  // the gate lifts on its own (no polling) even if the learner just waits.
  useEffect(() => {
    const blocked = !!hearts && !hearts.unlimited && hearts.hearts <= 0;
    if (!blocked || !token || !hearts?.nextHeartAt) return;
    const ms = new Date(hearts.nextHeartAt).getTime() - Date.now();
    const timer = setTimeout(() => {
      getHearts(token).then(setHearts).catch(() => {});
    }, Math.max(1000, ms + 500));
    return () => clearTimeout(timer);
  }, [token, hearts]);

  useEffect(() => () => {
    if (rewardTimer.current) clearTimeout(rewardTimer.current);
  }, []);

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
      if (result.xpEarned > 0) { showXpToast(result.xpEarned); sound.xp(); }
      else haptics.success();
    } else {
      haptics.error();
    }
  }, [phase, result]);

  const currentIndex = queue[queuePos] ?? 0;
  const currentQ = quiz?.questions[currentIndex];
  // This presentation is a first attempt unless we already locked an answer for it.
  const wasFirstAttempt = !answers.some((a) => a.questionIndex === currentIndex);
  // A first-time wrong answer gets re-queued, so it is NOT the final step yet.
  const willReask = !!feedback && !feedback.correct && wasFirstAttempt;
  const isFinalStep = queuePos >= queue.length - 1 && !willReask;
  // Hearts gate: 0 left on a non-premium plan blocks progress until refill/regen.
  const outOfHearts = !!hearts && !hearts.unlimited && hearts.hearts <= 0;

  // word_match: right column shuffled once per question.
  const shuffledRights = useMemo(() => {
    if (currentQ?.type !== 'word_match' || !currentQ.pairs) return [];
    return [...currentQ.pairs.map((p) => p.right)].sort(() => Math.random() - 0.5);
  }, [currentQ]);

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

  /** Spend Sparks to refill hearts, then refresh the balance so it stays in sync. */
  async function handleRefill() {
    if (!token || refilling) return;
    setRefilling(true);
    try {
      const next = await refillHearts(token);
      setHearts(next);
      getMe(token).then(updateUser).catch(() => {}); // Sparks just dropped — resync
    } catch {
      alertError(t('errorGeneric'));
    } finally {
      setRefilling(false);
    }
  }

  /**
   * Grade the current answer (instant ✓/✗), then on a second tap record it and
   * move on. Wrong first attempts are re-asked at the end; the score is graded
   * server-side from first attempts only.
   */
  async function advance() {
    if (!canAnswer() || submitting || checking) return;
    // Phase 1 — answer is in, but not yet checked: grade THIS question, show
    // ✓/✗ feedback, and wait for a second tap before moving on.
    if (!feedback) {
      setChecking(true);
      try {
        const fb = await quizzesApi.checkAnswer(id!, currentIndex, currentAnswer(), token!);
        setFeedback(fb);
        if (fb.hearts) setHearts(fb.hearts); // server-authoritative — never count locally
        if (fb.correct) {
          sound.correct();
          setCorrectRun((run) => {
            const nextRun = run + 1;
            haptics.combo(nextRun);
            setRewardFlash({ id: Date.now(), run: nextRun, titleKey: praiseKey(nextRun) });
            if (rewardTimer.current) clearTimeout(rewardTimer.current);
            rewardTimer.current = setTimeout(() => setRewardFlash(null), 1250);
            return nextRun;
          });
        } else {
          sound.wrong();
          triggerShake();
          setCorrectRun(0);
          setRewardFlash(null);
          haptics.error();
        }
      } catch {
        // /check failed → don't block the quiz. Reconcile hearts from the server
        // (a lost heart may have applied before the response dropped) and advance.
        if (token) getHearts(token).then(setHearts).catch(() => {});
        proceed();
      } finally {
        setChecking(false);
      }
      return;
    }
    // Phase 2 — feedback already shown: record the answer and continue.
    proceed();
  }

  /**
   * Move on from the current question. On a FIRST attempt we lock its answer
   * (that is what the final score is graded from) and, if it was wrong, re-queue
   * the question once at the end. Re-ask attempts never change the locked answer.
   */
  function proceed() {
    haptics.select();
    const idx = currentIndex;
    const firstAttempt = !answers.some((a) => a.questionIndex === idx);
    const wrong = feedback ? !feedback.correct : false;

    let finalAnswers = answers;
    let nextQueue = queue;
    if (firstAttempt) {
      finalAnswers = [...answers, { questionIndex: idx, answer: currentAnswer() }];
      setAnswers(finalAnswers);
      if (wrong) {
        nextQueue = [...queue, idx]; // ask it again at the very end
        setQueue(nextQueue);
      }
    }

    setFeedback(null);
    const nextPos = queuePos + 1;
    if (nextPos >= nextQueue.length) {
      submit(finalAnswers);
    } else {
      setSelected(null);
      setFillText('');
      setMatches({});
      setQueuePos(nextPos);
    }
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
          {/* Hero: a celebratory gradient card on a pass (white text + bright
              grade badge + ring), a calm neutral card on a miss. */}
          <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.heroShadow}>
            <LinearGradient
              colors={result.passed ? colors.primaryGradient : [c.surfaceAlt, c.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <AwardBadge
                icon={result.passed ? 'trophy' : 'refresh'}
                color={result.passed ? colors.white : c.textSecondary}
                bg={result.passed ? 'rgba(255,255,255,0.22)' : c.surfaceAlt}
              />
              {/* Performance grade badge — EXCELLENT / GREAT / GOOD on a pass. */}
              {result.passed ? (
                <View style={styles.gradeBadge}>
                  <AppText variant="label" color={colors.primary}>{t(gradeKey(result.percentage))}</AppText>
                </View>
              ) : null}
              <AppText variant="h1" center color={result.passed ? colors.white : c.text}>
                {result.passed ? t('quizPassed') : t('quizTryAgain')}
              </AppText>
              <View style={[styles.scoreRing, { borderColor: result.passed ? 'rgba(255,255,255,0.85)' : accent }]}>
                <CountUp value={result.percentage} suffix="%" variant="display"
                  color={result.passed ? colors.white : accent} style={styles.ringScore} />
              </View>
              <AppText variant="caption" center color={result.passed ? 'rgba(255,255,255,0.85)' : c.textSecondary}>
                {tf('scoreLine', { score: result.score, total: result.total })}
              </AppText>
              {/* IELTS Listening/Reading — the server's approximate band (0–9). */}
              {result.band !== undefined ? (
                <View style={styles.bandBox}>
                  <AppText variant="overline" color={result.passed ? 'rgba(255,255,255,0.85)' : c.textSecondary}>{t('ieltsBandLabel')}</AppText>
                  <AppText variant="display" color={result.passed ? colors.white : c.xp}>{formatBand(result.band)}</AppText>
                  <AppText variant="caption" center color={result.passed ? 'rgba(255,255,255,0.7)' : c.textMuted}>{t('ieltsBandHint')}</AppText>
                </View>
              ) : null}
            </LinearGradient>
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
              <StatTile value={`×${combo}`} label={t('resultComboLabel')}
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
      {rewardFlash ? (
        <RewardBurst
          key={rewardFlash.id}
          title={t(rewardFlash.titleKey)}
          subtitle={rewardFlash.run >= 2
            ? tf('correctComboToast', { n: rewardFlash.run })
            : t('correctInstantToast')}
          icon={rewardFlash.run >= 3 ? 'flame' : 'flash'}
          confettiCount={rewardFlash.run >= 3 ? 24 : 14}
        />
      ) : null}
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
        {/* Hearts — hidden entirely for premium (unlimited). */}
        {hearts && !hearts.unlimited ? <HeartsBar hearts={hearts} /> : null}
        <Text style={styles.progress}>
          {queuePos + 1} / {queue.length}
        </Text>
      </View>

      {/* Progress bar — eases to its new value on each step (re-asks included). */}
      <ProgressBar
        value={queue.length ? (queuePos + 1) / queue.length : 0}
        height={4}
        style={{ marginHorizontal: spacing.lg }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.container, bounded]}>

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

        {/* Answer area — wobbles on a wrong answer (C1c). */}
        <Animated.View style={shakeStyle}>
        {currentQ!.type === 'multiple_choice' && (
          <View style={styles.optionsContainer}>
            {currentQ!.options!.map((opt, i) => {
              const isSel = selected === i;
              const showFb = feedback !== null;
              // On a correct answer the picked option IS the right one; on a wrong
              // one the backend hands back the correct index so we can reveal it.
              const correctIdx = feedback?.correct
                ? selected
                : (typeof feedback?.correctAnswer === 'number' ? feedback.correctAnswer : null);
              const isCorrectOpt = showFb && correctIdx === i;
              const isWrongSel = showFb && isSel && !feedback!.correct;
              return (
                <PressableScale
                  key={i}
                  haptic={false}
                  disabled={showFb}
                  style={[
                    styles.option,
                    isSel && !showFb && styles.optionSelected,
                    isCorrectOpt && styles.optionCorrect,
                    isWrongSel && styles.optionWrong,
                  ]}
                  onPress={() => { haptics.select(); setSelected(i); }}
                >
                  <Text style={[styles.optionLabel, isSel && !showFb && styles.optionLabelSelected]}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                  <AppText variant="body" style={[styles.optionText, isSel && !showFb && styles.optionTextSelected]}>
                    {opt}
                  </AppText>
                  {isCorrectOpt ? <Ionicons name="checkmark-circle" size={20} color={c.success} /> : null}
                  {isWrongSel ? <Ionicons name="close-circle" size={20} color={c.danger} /> : null}
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
            editable={!feedback}
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
        </Animated.View>

      </ScrollView>

      {/* Duolingo-style docked feedback footer: sits at the bottom, tints
          green/red and slides its ✓/✗ verdict up the moment the answer is
          checked. For fill_blank it also spells out the answer that was missed. */}
      <View
        style={[
          styles.footer,
          feedback && (feedback.correct ? styles.footerCorrect : styles.footerWrong),
        ]}
      >
        {feedback ? (
          <Animated.View entering={SlideInDown.springify().damping(18)} style={styles.fbRow}>
            <Ionicons
              name={feedback.correct ? 'checkmark-circle' : 'close-circle'}
              size={26}
              color={feedback.correct ? c.success : c.danger}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" color={feedback.correct ? c.success : c.danger}>
                {feedback.correct
                  ? `${t('answerCorrect')} ${correctRun >= 2 ? tf('correctComboInline', { n: correctRun }) : ''}`.trim()
                  : t('answerWrong')}
              </AppText>
              {!feedback.correct && currentQ!.type === 'fill_blank' && typeof feedback.correctAnswer === 'string' ? (
                <AppText variant="caption" color={c.textSecondary}>
                  {tf('correctAnswerLabel', { answer: feedback.correctAnswer })}
                </AppText>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        <Button
          label={
            checking ? t('checking')
              : !feedback ? t('check')
              : isFinalStep ? (submitting ? t('submitting') : t('finish'))
              : t('continue')
          }
          onPress={advance}
          disabled={!canAnswer() || submitting || checking}
        />
      </View>

      {/* Out-of-hearts gate — blocks the quiz until a refill/regen (API.md §6a). */}
      {outOfHearts && hearts ? (
        <HeartsEmptySheet
          hearts={hearts}
          sparks={user?.sparks ?? 0}
          refilling={refilling}
          onRefill={handleRefill}
          onQuit={() => router.back()}
        />
      ) : null}
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
  scroll: { flex: 1 },
  container: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },

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
  // Instant-feedback option states.
  optionCorrect: { borderColor: c.success, backgroundColor: c.successSoft },
  optionWrong: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  // Docked feedback footer (Duolingo-style) — always holds the action button;
  // tints + reveals the verdict once the answer is checked.
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  footerCorrect: { backgroundColor: c.successSoft, borderTopColor: c.success },
  footerWrong: { backgroundColor: c.dangerSoft, borderTopColor: c.danger },
  fbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
  heroShadow: {
    borderRadius: radius.xl,
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  hero: {
    alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.xl, overflow: 'hidden',
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
  },
  // lineHeight ≥ fontSize so the celebration emoji isn't clipped on Android.
  resultEmoji: { fontSize: 60, lineHeight: 72, textAlign: 'center' },
  gradeBadge: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full,
  },
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
