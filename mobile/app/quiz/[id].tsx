import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useAuth } from '../../src/auth/AuthContext';
import * as quizzesApi from '../../src/api/quizzes';
import type { Quiz, QuizQuestion, AnswerItem, QuizResult } from '../../src/api/quizzes';
import { getHearts, type HeartsState } from '../../src/api/hearts';
import { getStats } from '../../src/api/users';
import { HeartsRow } from '../../src/components/HeartsRow';
import { HeartsSheet } from '../../src/components/HeartsSheet';
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
import { markDailyTask } from '../../src/lib/dailyTasks';
import { showXpToast } from '../../src/lib/xpToast';
import { alertError } from '../../src/lib/alerts';
import { t, tf, type TranslationKey } from '../../src/i18n';
import { formatBand } from '../../src/constants/ielts';
import { useColors } from '../../src/settings/SettingsContext';
import { colors, spacing, radius, fontSize, type AppColors } from '../../src/theme/theme';
import { bounded } from '../../src/theme/responsive';

type Phase = 'loading' | 'quiz' | 'result' | 'error';

/** Wrong attempts at one question before the correct answer is revealed. */
const REVEAL_AFTER_TRIES = 2;

type RewardFlash = {
  id: number;
  run: number;
  titleKey: TranslationKey;
};

/**
 * One question the student got wrong, kept so the result screen can explain it.
 *
 * Nothing else can supply this: `GET /quizzes/:id` deliberately withholds the
 * answer key, and `/submit`'s breakdown is only pass/fail per question. The one
 * place the key ever appears is the `/check` response for a WRONG answer — so we
 * catch it as it goes past, or it is gone by the time the score is on screen.
 */
type Mistake = {
  /** What they answered the FIRST time they missed it — the instructive one. */
  given: number | string;
  /** The key from `/check` (mc → index, fill_blank → string, word_match → pairs). */
  correctAnswer?: quizzesApi.CheckResult['correctAnswer'];
};

/** word_match answers travel as a JSON string (student) or a real array (key). */
function parsePairs(value: unknown): { left: string; right: string }[] {
  if (Array.isArray(value)) return value as { left: string; right: string }[];
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as { left: string; right: string }[]) : [];
  } catch {
    return []; // not JSON → nothing sensible to show
  }
}

/**
 * Render an answer the way the student saw it: a multiple-choice index becomes
 * "B. london", word-match pairs become "left → right" lines. A bare index or a
 * JSON blob on the review screen would be unreadable.
 */
function formatAnswer(q: QuizQuestion | undefined, value: unknown): string {
  if (value == null || value === '') return '—';
  if (q?.type === 'multiple_choice' && typeof value === 'number') {
    const opt = q.options?.[value];
    return opt ? `${String.fromCharCode(65 + value)}. ${opt}` : String(value + 1);
  }
  if (q?.type === 'word_match') {
    const pairs = parsePairs(value);
    return pairs.length
      ? pairs.map((p) => `${p.left} → ${p.right || '—'}`).join('\n')
      : '—';
  }
  return String(value);
}

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
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  /**
   * Question indices still to answer, in order — the head is what's on screen.
   *
   * A wrong answer moves its question to the BACK to be retried instead of
   * being scored and forgotten — that retry is what makes hearts meaningful.
   * After REVEAL_AFTER_TRIES wrong tries the answer is shown and the question
   * is dropped, so nobody can be stuck on one question forever.
   * `/submit` keeps the LAST answer per question and grants XP once per quiz,
   * so re-answering can't be farmed.
   */
  const [queue, setQueue] = useState<number[]>([]);
  /** Bumped on every question change — re-shuffles a re-queued word_match. */
  const [attempt, setAttempt] = useState(0);
  /**
   * Wrong attempts per question index.
   *
   * Since a wrong answer comes back to be retried, revealing the right one
   * straight away would make the retry pointless — the student just copies what
   * they were shown. So the answer stays hidden until they have genuinely tried
   * `REVEAL_AFTER_TRIES` times; at that point it is shown AND the question is
   * dropped from the queue, so nobody loops on one question forever.
   */
  const [wrongTries, setWrongTries] = useState<Record<number, number>>({});
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  /**
   * Questions missed at least once, by index → what the result screen reviews.
   * Recorded as `/check` grades each answer (see `Mistake`), and kept even when
   * the retry succeeds: "I got it eventually" is exactly the thing worth
   * re-reading afterwards.
   */
  const [mistakes, setMistakes] = useState<Record<number, Mistake>>({});
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
  // Hearts ("lives"). The server owns the count — every /check response carries
  // the new state, so this is only ever assigned from the API, never decremented
  // here. `sparks` is what the refill sheet needs to know if refilling is possible.
  const [hearts, setHearts] = useState<HeartsState | null>(null);
  const [sparks, setSparks] = useState(0);
  const [heartsSheet, setHeartsSheet] = useState(false);

  // Wrong-answer shake: a quick left/right wobble of the answer area. Pairs
  // with haptics.error() + sound.wrong() so a mistake registers through three
  // senses at once (kept from Boju's #184 when the two quiz reworks merged).
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  function triggerShake() {
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
  const [rewardFlash, setRewardFlash] = useState<RewardFlash | null>(null);
  const rewardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      .then((q) => {
        setQuiz(q);
        setQueue(q.questions.map((_, i) => i));
        setWrongTries({}); // a reloaded quiz starts a fresh run
        setMistakes({});
        setPhase('quiz');
      })
      .catch(() => setPhase('error'));
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  /**
   * Hearts + Sparks balance. Deliberately off the quiz's load path: if either
   * call fails the quiz must stay playable — the server still charges the real
   * cost on /check, so a missing display never lets anyone cheat.
   */
  const loadHearts = useCallback(async () => {
    if (!token) return;
    const [state, stats] = await Promise.all([
      // Swallowed on purpose (a dead hearts call must not break the quiz), but
      // logged in dev — otherwise a missing hearts row looks like a UI bug when
      // it is really a 401/404/500 from the API.
      getHearts(token).catch((e: unknown) => {
        if (__DEV__) console.warn('[hearts] GET /hearts failed:', e);
        return null;
      }),
      getStats(token).catch(() => null),
    ]);
    if (state) {
      setHearts(state);
      // Already empty on arrival → say so now, not after a wasted answer.
      if (!state.unlimited && state.hearts <= 0) setHeartsSheet(true);
    }
    if (stats) setSparks(stats.sparks);
  }, [token]);

  useEffect(() => { loadHearts(); }, [loadHearts]);

  // Hearts came back — regenerated while the student waited, or refilled with
  // Sparks. Close the blocking sheet rather than making them dismiss a dialog
  // whose reason no longer applies.
  useEffect(() => {
    if (heartsSheet && hearts && (hearts.unlimited || hearts.hearts > 0)) {
      setHeartsSheet(false);
    }
  }, [heartsSheet, hearts]);

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

  const total = quiz?.questions.length ?? 0;
  // Questions are asked from the head of `queue`; a wrong one goes to the back.
  const currentIndex = queue[0] ?? 0;
  const currentQ = quiz?.questions[currentIndex];
  // "Last" only if this answer is right — a wrong one re-queues, so the run
  // isn't over. Computed from the feedback we already have.
  const solved = total - queue.length;
  // Only give the answer away once they've really tried — see `wrongTries`.
  const revealAnswer = (wrongTries[currentIndex] ?? 0) >= REVEAL_AFTER_TRIES;
  /**
   * Does the current answer take us off this question? True when it's right,
   * and also when it's wrong for the REVEAL_AFTER_TRIES-th time — the answer is
   * on screen by then, so asking again would only be asking them to copy it.
   */
  const advances = feedback !== null && (feedback.correct || revealAnswer);
  const isLast = queue.length === 1 && advances;

  // word_match: right column shuffled once per question. `attempt` is in the
  // deps so a re-queued question comes back shuffled differently instead of
  // letting the student memorise last time's column order.
  const shuffledRights = useMemo(() => {
    if (currentQ?.type !== 'word_match' || !currentQ.pairs) return [];
    return [...currentQ.pairs.map((p) => p.right)].sort(() => Math.random() - 0.5);
  }, [currentIndex, currentQ, attempt]);

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
  async function advance() {
    if (!canAnswer() || submitting || checking) return;
    // Phase 1 — answer is in, but not yet checked: grade THIS question, show
    // ✓/✗ feedback, and wait for a second tap before moving on.
    if (!feedback) {
      setChecking(true);
      try {
        const fb = await quizzesApi.checkAnswer(id!, currentIndex, currentAnswer(), token!);
        setFeedback(fb);
        // A wrong answer costs a heart, charged by the server — this is the
        // authoritative count (an older backend simply omits it).
        if (fb.hearts) setHearts(fb.hearts);
        if (fb.correct) {
          setCorrectRun((run) => {
            const nextRun = run + 1;
            haptics.combo(nextRun);
            sound.correct();
            setRewardFlash({ id: Date.now(), run: nextRun, titleKey: praiseKey(nextRun) });
            if (rewardTimer.current) clearTimeout(rewardTimer.current);
            rewardTimer.current = setTimeout(() => setRewardFlash(null), 1250);
            return nextRun;
          });
        } else {
          setCorrectRun(0);
          setRewardFlash(null);
          haptics.error();
          sound.wrong();
          triggerShake();
          setWrongTries((w) => ({
            ...w,
            [currentIndex]: (w[currentIndex] ?? 0) + 1,
          }));
          // Keep the FIRST miss only: later tries drift towards the answer as
          // the student narrows it down, and "what I thought at the time" is
          // what makes the review worth reading. `open_response` is skipped —
          // the server never auto-grades it (always `correct: false`), so
          // filing it as a mistake would be a lie about the student's answer.
          if (currentQ?.type !== 'open_response') {
            const given = currentAnswer();
            setMistakes((m) => (
              m[currentIndex]
                ? m
                : { ...m, [currentIndex]: { given, correctAnswer: fb.correctAnswer } }
            ));
          }
        }
      } catch {
        // /check failed. Advancing silently used to look like the quiz had
        // decided the answer itself — on the last question it jumped straight
        // to the score with no feedback at all. Say what happened and let the
        // student press again; nothing is recorded, so nothing is lost.
        alertError(t('checkAnswerError'));
      } finally {
        setChecking(false);
      }
      return;
    }
    // Phase 2 — feedback already shown: record the answer and continue.
    proceed();
  }

  /** Record the current answer and move to the next question (or submit). */
  function proceed() {
    // Out of hearts → the run ends here. Gating on `proceed` rather than on the
    // /check response means the student still sees why the answer was wrong
    // before the sheet takes over.
    if (hearts && !hearts.unlimited && hearts.hearts <= 0) {
      setHeartsSheet(true);
      return;
    }
    haptics.select();
    const all = answersWithCurrent();
    setAnswers(all);

    // Done with this question (right, or wrong enough times that the answer has
    // been shown) → drop it. Otherwise it goes to the back to be asked again.
    const next = advances ? queue.slice(1) : [...queue.slice(1), currentIndex];

    setQueue(next);
    if (next.length === 0) submit(all);
    else resetQuestionInput();
  }

  /** Clear the previous answer so the next (or repeated) question starts blank. */
  function resetQuestionInput() {
    setSelected(null);
    setFillText('');
    setMatches({});
    setFeedback(null);
    setAttempt((n) => n + 1);
  }

  async function submit(all: AnswerItem[]) {
    setSubmitting(true);
    try {
      const res = await quizzesApi.submitQuiz(id!, all, token!);
      if (res.passed && id) {
        markExerciseCompleted(id); // local mirror → checkmark on the list
        markDailyTask(); // feeds the Soril daily path (Өнөөдрийн зам)
      }
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
    // Missed questions in the order they were asked (object keys are strings).
    const missed = Object.keys(mistakes)
      .map(Number)
      .sort((a, b) => a - b);
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

          {/* Where it actually went wrong. The chips above only say WHICH
              questions were missed; a student can't learn from a red ✗. Note
              this lists every question missed at least once, so a question
              retried into a ✓ still shows up — that first wrong answer is the
              one worth re-reading. */}
          <AppText variant="overline" color={c.textSecondary} style={styles.breakdownTitle}>
            {t('resultMistakesTitle')}
          </AppText>
          {missed.length === 0 ? (
            <View style={styles.noMistakes}>
              <Ionicons name="sparkles" size={18} color={c.success} />
              <AppText variant="body" color={c.success} style={{ flex: 1 }}>
                {t('resultNoMistakes')}
              </AppText>
            </View>
          ) : (
            <>
              <AppText variant="caption" color={c.textMuted}>
                {t('resultMistakesHint')}
              </AppText>
              {missed.map((qi, i) => {
                const m = mistakes[qi];
                const q = quiz?.questions[qi];
                return (
                  <Animated.View
                    key={qi}
                    entering={FadeInDown.delay(400 + i * 60)}
                    style={styles.missCard}
                  >
                    <AppText variant="overline" color={c.textMuted}>
                      {tf('resultQuestionNo', { n: qi + 1 })}
                    </AppText>
                    {q?.question ? (
                      <AppText variant="bodyStrong">{q.question}</AppText>
                    ) : null}
                    <View style={styles.missLine}>
                      <Ionicons name="close-circle" size={16} color={c.danger} />
                      <View style={styles.missLineBody}>
                        <AppText variant="caption" color={c.textMuted}>
                          {t('resultYourAnswer')}
                        </AppText>
                        <AppText variant="body" color={c.danger}>
                          {formatAnswer(q, m.given)}
                        </AppText>
                      </View>
                    </View>
                    {/* `correctAnswer` is absent only if an older backend omitted
                        it — hide the row rather than print an empty one. */}
                    {m.correctAnswer !== undefined ? (
                      <View style={styles.missLine}>
                        <Ionicons name="checkmark-circle" size={16} color={c.success} />
                        <View style={styles.missLineBody}>
                          <AppText variant="caption" color={c.textMuted}>
                            {t('resultCorrectAnswer')}
                          </AppText>
                          <AppText variant="body" color={c.success}>
                            {formatAnswer(q, m.correctAnswer)}
                          </AppText>
                        </View>
                      </View>
                    ) : null}
                  </Animated.View>
                );
              })}
            </>
          )}

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
        {/* Solved-of-total, not position-of-total: a re-queued question would
            make a position counter jump backwards. */}
        <Text style={styles.progress}>
          {solved} / {total}
        </Text>
      </View>

      {/* Progress + remaining hearts, side by side: the bar tracks how far the
          run has got, the hearts show what the next mistake costs. */}
      <View style={styles.progressRow}>
        {/* ProgressBar's own style is `width: '100%'`, so it must be sized by a
            wrapper here — giving it `flex: 1` directly leaves the two rules
            fighting and pushes the hearts off the right edge. */}
        <View style={styles.progressBarWrap}>
          <ProgressBar value={total > 0 ? solved / total : 0} height={4} />
        </View>
        <HeartsRow
          state={hearts}
          size={18}
          onRegen={loadHearts}
          onPress={() => { haptics.tap(); setHeartsSheet(true); }}
        />
      </View>

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

        {/* Answer area — wobbles on a wrong answer (from Boju's #184). */}
        <Animated.View style={shakeStyle}>
        {currentQ!.type === 'multiple_choice' && (
          <View style={styles.optionsContainer}>
            {currentQ!.options!.map((opt, i) => {
              const isSel = selected === i;
              const showFb = feedback !== null;
              // On a correct answer the picked option IS the right one. On a
              // wrong one the backend hands back the correct index, but we only
              // point at it after REVEAL_AFTER_TRIES — otherwise the retry is
              // just "tap the option with the green tick".
              const correctIdx = feedback?.correct
                ? selected
                : (revealAnswer && typeof feedback?.correctAnswer === 'number'
                    ? feedback.correctAnswer
                    : null);
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

        {/* Instant ✓/✗ feedback banner (all question types). A wrong answer
            gets a nudge, not the solution — the question is coming back. After
            REVEAL_AFTER_TRIES attempts it does spell the answer out. */}
        {feedback ? (
          <View style={[styles.fbBanner, { backgroundColor: feedback.correct ? c.successSoft : c.dangerSoft }]}>
            <Ionicons
              name={feedback.correct ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={feedback.correct ? c.success : c.danger}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" color={feedback.correct ? c.success : c.danger}>
                {feedback.correct
                  ? `${t('answerCorrect')} ${correctRun >= 2 ? tf('correctComboInline', { n: correctRun }) : ''}`
                  : t('answerWrong')}
              </AppText>
              {!feedback.correct ? (
                revealAnswer && currentQ!.type === 'fill_blank' && typeof feedback.correctAnswer === 'string' ? (
                  <AppText variant="caption" color={c.textSecondary}>
                    {tf('correctAnswerLabel', { answer: feedback.correctAnswer })}
                  </AppText>
                ) : !revealAnswer ? (
                  // Nudge instead of the answer — the question is coming back.
                  <AppText variant="caption" color={c.textSecondary}>
                    {t('tryAgainHint')}
                  </AppText>
                ) : null
              ) : null}
            </View>
          </View>
        ) : null}

        <Button
          label={
            checking ? t('checking')
              : !feedback ? t('check')
              : isLast ? (submitting ? t('submitting') : t('finish'))
              // Wrong and coming back → say so; "continue" would imply we're
              // moving past it. Once the answer has been revealed we ARE moving
              // on, so it reads as "continue" again.
              : advances ? t('continue')
              : t('retryAnswer')
          }
          onPress={advance}
          disabled={!canAnswer() || submitting || checking}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>

      {/* Hearts status. Blocking when empty (`onExit` present), otherwise just
          the tapped-for-info view. */}
      <HeartsSheet
        visible={heartsSheet}
        state={hearts}
        sparksBalance={sparks}
        onRefilled={(next) => {
          setHearts(next);
          setHeartsSheet(false);
          loadHearts(); // Sparks were just spent → refresh the balance
        }}
        onClose={() => setHeartsSheet(false)}
        onExit={() => {
          setHeartsSheet(false);
          router.back();
        }}
        onRegen={loadHearts}
      />
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
  },
  progressBarWrap: { flex: 1 },
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
  // Instant-feedback option states.
  optionCorrect: { borderColor: c.success, backgroundColor: c.successSoft },
  optionWrong: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  fbBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg,
  },
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

  // "What you missed" review cards. Left-aligned and roomy on purpose: this is
  // the one block on the result screen meant to be READ, not glanced at.
  missCard: {
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  missLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  missLineBody: { flex: 1, gap: 1 },
  noMistakes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
