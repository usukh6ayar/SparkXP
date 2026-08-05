import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { enter, shake } from '../../src/lib/motion';
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
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { PressableScale } from '../../src/components/PressableScale';
import { AppImage } from '../../src/components/AppImage';
import { WordMatchBoard } from '../../src/components/WordMatchBoard';
import { ProgressBar } from '../../src/components/ProgressBar';
import { ProgressRing } from '../../src/components/ProgressRing';
import { Pill } from '../../src/components/Pill';
import { AnswerReview } from '../../src/components/AnswerReview';
import { TopBar } from '../../src/components/TopBar';
import { CountUp } from '../../src/components/CountUp';
import { AppText } from '../../src/components/Text';
import { haptics } from '../../src/lib/haptics';
import { sound } from '../../src/lib/sound';
import { markExerciseCompleted } from '../../src/lib/exerciseProgress';
import { markDailyTask } from '../../src/lib/dailyTasks';
import { showXpToast } from '../../src/lib/xpToast';
import { CelebrationScreen } from '../../src/components/celebration/CelebrationScreen';
import { celebrationCopy } from '../../src/components/celebration/copy';
import { alertError } from '../../src/lib/alerts';
import { t, tf, type TranslationKey } from '../../src/i18n';
import { formatBand } from '../../src/constants/ielts';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, fontSize, type AppColors } from '../../src/theme/theme';
import { bounded } from '../../src/theme/responsive';
import { checkCelebrations } from '../../src/lib/useCelebrations';

type Phase = 'loading' | 'quiz' | 'result' | 'error';

/**
 * How long the last question's ✓ stays on screen before the run submits itself.
 *
 * The final answer used to need a second tap on "Дуусгах" — a button that told
 * the student nothing they couldn't already see from the green banner. Now the
 * run ends itself; this pause is only so the ✓ registers before the celebration
 * takes the screen.
 */
const FINISH_HOLD_MS = 700;

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

/**
 * Performance grade — "ГАЙХАЛТАЙ!" for a near-perfect score down to a plain
 * "САЙН!", so finishing feels earned rather than measured.
 *
 * It used to be a small badge on the result hero; now it IS the celebration's
 * headline, which is a better home for it — the one line the student reads
 * first should be the one that grades them.
 */
function gradeKey(percentage: number): TranslationKey {
  if (percentage >= 90) return 'gradeExcellent';
  if (percentage >= 75) return 'gradeGreat';
  if (percentage >= 50) return 'gradeGood';
  // Below half on first sight. The run was still completed, so the headline
  // says so plainly instead of praising a score that wasn't there.
  return 'gradeDone';
}

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
   * A wrong answer moves its question to the BACK and keeps coming back until
   * it is answered correctly — the run cannot end with a miss left in it.
   * The BACK matters: the right answer lights up green the instant a question
   * is missed, so asking it again immediately would only be asking the student
   * to copy it. A whole lap later, it is a recall test again.
   *
   * What gets SUBMITTED is the first answer to each question — see
   * `answersWithCurrent`, which is also why re-answering can't be farmed.
   */
  const [queue, setQueue] = useState<number[]>([]);
  /** Bumped on every question change — re-shuffles a re-queued word_match. */
  const [attempt, setAttempt] = useState(0);
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
  /** The full-screen celebration sits over the result on a pass. */
  const [celebrating, setCelebrating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** The last question is right and the run is ending itself — see `FINISH_HOLD_MS`. */
  const [finishing, setFinishing] = useState(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Instant per-question feedback (C2): after answering, we grade THIS question
  // via /check and show ✓/✗ (+ the correct answer) before letting the student
  // move on — instead of silently advancing and only revealing the score at the end.
  const [feedback, setFeedback] = useState<quizzesApi.CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  // Only the setter: the streak length is read inside the updater to escalate
  // the haptic. Nothing on screen shows a combo any more — the result screen's
  // "Цуваа" pill is recomputed from the graded breakdown at the end.
  const [, setCorrectRun] = useState(0);
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
  // The shared `shake()` (±8, five steps) rather than a local ±12 over seven:
  // a wrong answer should register, not throw the question across the screen.
  function triggerShake() {
    shakeX.value = shake();
  }
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
    if (finishTimer.current) clearTimeout(finishTimer.current);
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
    // No error haptic on a low score any more: the celebration is already
    // playing over this screen, and buzzing "wrong" underneath a trophy is a
    // contradiction. Reaching the end is the win; the score is just the detail.
    if (result.xpEarned > 0) { showXpToast(result.xpEarned); sound.xp(); }
    else haptics.success();
  }, [phase, result]);

  const total = quiz?.questions.length ?? 0;
  // Questions are asked from the head of `queue`; a wrong one goes to the back.
  const currentIndex = queue[0] ?? 0;
  const currentQ = quiz?.questions[currentIndex];
  // "Last" only if this answer is right — a wrong one re-queues, so the run
  // isn't over. Computed from the feedback we already have.
  // `finishing` counts the last question as done so the bar fills to 100% the
  // moment the ✓ lands, rather than sitting one short until the result arrives.
  const solved = total - queue.length + (finishing ? 1 : 0);
  /**
   * Does the current answer take us off this question?
   *
   * **Only a right answer does.** A miss sends the question to the BACK of the
   * queue and it keeps coming back until it is answered correctly — the run
   * cannot be finished with a wrong answer left in it (Choi, 2026-08-05: "буруу
   * бол үргэлжлүүлээд дараа нь зөв болтол хийдэг болго"). The back of the queue
   * matters: asked again immediately, it would only be a copying exercise.
   *
   * Nobody loops forever, because a wrong answer costs a heart and an empty
   * heart bar ends the run (see `proceed`).
   */
  const advances = feedback?.correct === true;
  const isLast = queue.length === 1 && advances;

  /**
   * word_match verdicts — leftIndex → was this pairing right?
   *
   * `undefined` until the answer is checked, which is also what keeps the board
   * editable: `WordMatchBoard` locks itself as soon as it is graded.
   */
  const matchGrades = useMemo(() => {
    if (currentQ?.type !== 'word_match' || !feedback) return undefined;
    const grades: Record<number, boolean> = {};
    // A correct answer means every row is right; no need to consult the key.
    if (feedback.correct) {
      (currentQ.pairs ?? []).forEach((_, i) => { grades[i] = true; });
      return grades;
    }
    const key = parsePairs(feedback.correctAnswer);
    if (key.length === 0) return undefined; // older backend → no key, no colours
    (currentQ.pairs ?? []).forEach((p, i) => {
      grades[i] = matches[i] === key.find((k) => k.left === p.left)?.right;
    });
    return grades;
  }, [currentQ, feedback, matches]);

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

  /**
   * The full answer list including the current question's choice.
   *
   * **The FIRST answer to a question wins.** Since a question now repeats until
   * it is right, the last answer is always the correct one — grading that would
   * score every single run 100% and make the result screen meaningless. What
   * the student knew on first sight is the honest measure, and it is exactly
   * what the "эхэндээ андуурсан" rows on the result screen already show.
   */
  function answersWithCurrent(): AnswerItem[] {
    if (answers.some((a) => a.questionIndex === currentIndex)) return answers;
    return [...answers, { questionIndex: currentIndex, answer: currentAnswer() }];
  }

  /**
   * Save the current answer and move on — no per-question feedback. The last
   * question submits the whole set; grading happens server-side and the score
   * only appears at the end.
   */
  async function advance() {
    if (!canAnswer() || submitting || checking || finishing) return;
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
          // Haptics + sound only. The streak length still escalates the buzz,
          // it just no longer throws a card over the top of the question.
          setCorrectRun((run) => {
            const nextRun = run + 1;
            haptics.combo(nextRun);
            sound.correct();
            return nextRun;
          });
          // Last question, answered right → the run is over, so end it here
          // instead of parking a "Дуусгах" button in front of the celebration.
          // The hearts gate in `proceed` is skipped on purpose: someone who just
          // answered the final question correctly has earned their result screen.
          if (queue.length === 1) {
            const all = answersWithCurrent();
            setAnswers(all);
            setFinishing(true);
            finishTimer.current = setTimeout(() => submit(all), FINISH_HOLD_MS);
          }
        } else {
          setCorrectRun(0);
          haptics.error();
          sound.wrong();
          triggerShake();
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

  /** Dismissing releases any trophy/streak queued behind it (never two modals). */
  const closeCelebration = useCallback(() => {
    setCelebrating(false);
    checkCelebrations();
  }, []);

  async function submit(all: AnswerItem[]) {
    setSubmitting(true);
    try {
      const res = await quizzesApi.submitQuiz(id!, all, token!);
      if (id) {
        markExerciseCompleted(id); // local mirror → checkmark on the list
        markDailyTask(); // feeds the Soril daily path (Өнөөдрийн зам)
      }
      setResult(res);
      setPhase('result');
      /**
       * **Reaching the end always celebrates.** A run cannot end with a wrong
       * answer left in it — every question repeats until it is right — so
       * getting here IS the achievement, whatever the first-sight score was.
       *
       * It used to be gated on `res.passed`, which stopped making sense the
       * moment grading moved to first answers: a student who worked through
       * every question and corrected all of them could still land on a "you
       * failed" screen with no ceremony. The score is now information on the
       * card below, not a verdict on whether the work counted.
       */
      setCelebrating(true);
    } catch {
      alertError(t('submitAnswerError'));
      // Hand the button back so a failed auto-finish can be retried by tapping.
      setFinishing(false);
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
    // Banded, not pass/fail: the run was completed either way, so the colour
    // reports how much was known on first sight rather than passing judgement.
    const accent = result.percentage >= 75 ? c.success
      : result.percentage >= 50 ? c.streak
      : c.danger;
    return (
      <SafeAreaView style={styles.safe}>
        {/* A header, because this screen is reached by DISMISSING the
            celebration — without one the student lands on a bare page that
            opens on a tiny caption, with no title and no way back but a scroll
            to the bottom. Badges off: this is a review, not a dashboard. */}
        <TopBar title={t('scoreTitle')} back showBadges={false} />

        {/* No confetti here. It belongs to the celebration that was just
            dismissed; firing it again over the review rained paper on the one
            screen the student came here to READ. */}
        <ScrollView contentContainerStyle={[styles.resultContainer, bounded]}>
          <Animated.View entering={enter()} style={styles.scoreCard}>
            <ProgressRing
              progress={result.percentage / 100}
              size={116}
              stroke={9}
              color={accent}
              track={c.surfaceAlt}
            >
              <CountUp value={result.percentage} suffix="%" variant="h1" color={accent} />
            </ProgressRing>

            <AppText variant="h2" center>{t(gradeKey(result.percentage))}</AppText>
            <AppText variant="caption" color={c.textMuted} center>
              {t('resultAccuracyNote')}
            </AppText>

            <View style={styles.pillRow}>
              <Pill
                icon="checkmark-circle"
                label={tf('scoreLine', { score: result.score, total: result.total })}
                bg={c.successSoft}
                fg={c.success}
              />
              {result.xpEarned > 0 ? (
                <Pill icon="flash" label={`+${result.xpEarned} XP`} bg={c.surfaceAlt} fg={c.xp} />
              ) : null}
              {combo >= 2 ? (
                <Pill
                  icon="flame"
                  label={`×${combo} ${t('resultComboLabel')}`}
                  bg={c.surfaceAlt}
                  fg={c.streak}
                />
              ) : null}
            </View>
          </Animated.View>

          {/* IELTS band — the one figure the celebration does NOT carry, so it
              gets its own card on both paths rather than riding in the hero. */}
          {result.band !== undefined ? (
            <Animated.View entering={enter(120)} style={styles.bandCard}>
              <AppText variant="overline" color={c.textSecondary}>{t('ieltsBandLabel')}</AppText>
              <AppText variant="display" color={c.xp}>{formatBand(result.band)}</AppText>
              <AppText variant="caption" center color={c.textMuted}>{t('ieltsBandHint')}</AppText>
            </Animated.View>
          ) : null}

          {/* Every question, in order. The grade is the FIRST answer, so a red
              row is a question the student did not know — even though the run
              could only end once they had corrected it. `mistakes` supplies
              what they actually typed or picked that first time. */}
          <AnswerReview
            items={result.breakdown.map((b) => {
              const q = quiz?.questions[b.questionIndex];
              const m = mistakes[b.questionIndex];
              return {
                index: b.questionIndex,
                question: q?.question,
                correct: b.correct,
                given: m ? formatAnswer(q, m.given) : undefined,
                correctAnswer: m?.correctAnswer !== undefined
                  ? formatAnswer(q, m.correctAnswer)
                  : undefined,
              };
            })}
          />
        </ScrollView>

        {/* Pinned, not parked at the end of the scroll: the way out shouldn't
            depend on how many questions were missed. */}
        <View style={styles.resultFooter}>
          <Button label={t('finish')} onPress={() => router.back()} />
        </View>

        {/* The shared completion celebration, over the result. Dismissing it
            reveals the breakdown underneath — the ceremony must never cost the
            student the one screen that tells them WHAT they got wrong. */}
        <CelebrationScreen
          visible={celebrating}
          {...celebrationCopy('quiz', { perfect: result.percentage === 100 })}
          // The grade replaces the generic headline on anything but a perfect
          // run, where "Төгс!" already says more than "ГАЙХАЛТАЙ!" would.
          title={result.percentage === 100
            ? t('celebrationTitlePerfect')
            : t(gradeKey(result.percentage))}
          xp={result.xpEarned}
          stats={[
            {
              icon: 'checkmark-circle',
              label: t('celebrationStatCorrect'),
              value: `${result.score}/${result.total}`,
              color: c.success,
            },
            {
              icon: 'stats-chart',
              label: t('scoreTitle'),
              value: `${result.percentage}%`,
              color: c.sparks,
            },
            ...(combo >= 2
              ? [{
                  icon: 'flame' as const,
                  label: t('celebrationStatCombo'),
                  value: `×${combo}`,
                  color: c.streak,
                }]
              : []),
          ]}
          // Finishing is the DEFAULT action: the student came to do a quiz, not
          // to be walked through a second results screen. The breakdown is one
          // tap away for anyone who wants to know what they missed.
          primary={{ label: t('finish'), onPress: () => { closeCelebration(); router.back(); } }}
          secondary={{ label: t('resultBreakdownTitle'), onPress: closeCelebration }}
        />
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
              // On a correct answer the picked option IS the right one; on a
              // wrong one the backend hands back the correct index. Either way
              // the right option lights up green immediately — the wrong pick
              // sitting in red next to it is the whole lesson.
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
          <>
            <TextInput
              style={[
                styles.fillInput,
                feedback?.correct && styles.fillInputCorrect,
                feedback && !feedback.correct && styles.fillInputWrong,
              ]}
              value={fillText}
              onChangeText={setFillText}
              placeholder={t('yourAnswer')}
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              editable={!feedback}
            />
            {/* The one place a colour cannot do the job: a red box does not say
                what the word was. Options and pairs light up green on their own,
                so this is the only written correction left in the quiz. */}
            {feedback && !feedback.correct && typeof feedback.correctAnswer === 'string' ? (
              <AppText variant="bodyStrong" color={c.success} style={styles.fillAnswer}>
                {feedback.correctAnswer}
              </AppText>
            ) : null}
          </>
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
            graded={matchGrades}
          />
        )}
        </Animated.View>

        <Button
          label={
            // `finishing` first: the last correct answer submits itself, so the
            // button is only ever a progress indicator from that point on.
            finishing ? t('submitting')
              : checking ? t('checking')
              : !feedback ? t('check')
              : isLast ? (submitting ? t('submitting') : t('finish'))
              // Always "continue" now: right or wrong, the next tap moves to the
              // next question. "Дахин оролдох" belonged to the old flow where a
              // miss put you straight back on the same question.
              : t('continue')
          }
          onPress={advance}
          disabled={!canAnswer() || submitting || checking || finishing}
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
  bandCard: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: spacing.lg,
  },
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
  fillInput: {
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: c.text,
  },
  fillInputCorrect: { borderColor: c.success, backgroundColor: c.successSoft },
  fillInputWrong: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  fillAnswer: { marginTop: spacing.sm },
  errorText: { color: c.danger, fontSize: fontSize.md },
  // Result styles
  resultContainer: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  resultFooter: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },

  /**
   * The score card — ONE card for a pass and a miss alike.
   *
   * They differ only in accent colour and headline, so giving each its own
   * layout is what left the pass path looking half-built once its hero was
   * removed. The celebration is still the ceremony; this is the receipt.
   */
  scoreCard: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
});
