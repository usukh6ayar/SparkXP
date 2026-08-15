import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/auth/AuthContext';
import * as quizzesApi from '../../../src/api/quizzes';
import type { AnswerItem, Quiz, QuizResult } from '../../../src/api/quizzes';
import { AppText } from '../../../src/components/Text';
import { Button } from '../../../src/components/Button';
import { Loading } from '../../../src/components/Loading';
import { EmptyState } from '../../../src/components/EmptyState';
import { Notice } from '../../../src/components/Notice';
import { ExamHeader } from '../../../src/components/ielts/ExamHeader';
import { ExamNav } from '../../../src/components/ielts/ExamNav';
import { ExamQuestion, type ExamAnswer } from '../../../src/components/ielts/ExamQuestion';
import { ExamAudioBar } from '../../../src/components/ielts/ExamAudioBar';
import { ExamResult } from '../../../src/components/ielts/ExamResult';
import {
  groupSections,
  ieltsModuleOf,
  recommendedSeconds,
  sectionText,
} from '../../../src/constants/ielts';
import { markExerciseCompleted } from '../../../src/lib/exerciseProgress';
import { markDailyTask } from '../../../src/lib/dailyTasks';
import { checkCelebrations } from '../../../src/lib/useCelebrations';
import { useAsyncAction } from '../../../src/lib/useAsyncAction';
import { showXpToast } from '../../../src/lib/xpToast';
import { sound } from '../../../src/lib/sound';
import { confirm } from '../../../src/lib/alerts';
import { t, tf } from '../../../src/i18n';
import { useColors } from '../../../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../../../src/theme/theme';
import { bounded } from '../../../src/theme/responsive';

/**
 * IELTS exam player.
 *
 * Deliberately not the ordinary quiz runner. That one asks one question at a
 * time and repeats anything you get wrong, which is the right shape for a drill
 * and the wrong shape for an exam: in a real paper every question in the part is
 * in front of you, you answer in any order, you change your mind, and nothing is
 * marked until you hand it in. Losing that is what made the IELTS section feel
 * like it had no map — no sense of which part you were in or how much was left.
 *
 * So: the whole part on one page, an answer sheet you can jump around in
 * (`ExamNav`), the source material pinned above it, and marking only on submit.
 */
export default function IeltsTestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, ExamAnswer>>({});
  const [activeSection, setActiveSection] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPassage, setShowPassage] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const scroller = useRef<ScrollView>(null);
  /** Y offset of each question card, so the answer sheet can jump to one. */
  const offsets = useRef<Record<number, number>>({});

  const load = useCallback(() => {
    if (!token || !id) return;
    setFailed(false);
    quizzesApi
      .getQuiz(id, token)
      .then(setQuiz)
      .catch(() => setFailed(true));
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  const sections = useMemo(
    () => groupSections(quiz?.questions ?? []),
    [quiz?.questions],
  );
  const module = ieltsModuleOf(quiz?.category);
  const isReading = module?.key === 'reading';
  /** Section · Passage · Task · Part — the module's own word for a part. */
  const partLabel = module?.partLabel ?? 'Section';
  const isListening = module?.key === 'listening';
  const total = quiz?.questions.length ?? 0;

  /** Blank-but-touched counts as unanswered — typing into a gap and clearing it
   *  leaves an empty string behind, and the header must not call that done. */
  const isAnswered = useCallback(
    (index: number) => answers[index] !== undefined && answers[index] !== '',
    [answers],
  );
  const answeredCount = useMemo(
    () => Object.keys(answers).filter((k) => isAnswered(Number(k))).length,
    [answers, isAnswered],
  );

  const missing = total - answeredCount;
  /** First question still blank, in paper order — where "go back" should land. */
  const firstUnanswered = useMemo(() => {
    for (let i = 0; i < total; i += 1) if (!isAnswered(i)) return i;
    return null;
  }, [total, isAnswered]);

  // A set whose parts are numbered 2 and 3 still has to open on one of them.
  useEffect(() => {
    if (sections.length && !sections.some((s) => s.number === activeSection)) {
      setActiveSection(sections[0].number);
    }
  }, [sections, activeSection]);

  const current = sections.find((s) => s.number === activeSection) ?? sections[0];

  function answer(index: number, value: ExamAnswer) {
    setAnswers((prev) => ({ ...prev, [index]: value }));
    setCurrentIndex(index);
  }

  /** Jump the page to a question, switching part first if it lives elsewhere. */
  function jumpTo(index: number) {
    setCurrentIndex(index);
    const y = offsets.current[index];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }

  /** Go to a question wherever it lives, switching part first if needed. */
  function goToQuestion(index: number) {
    const owner = sections.find((s) => s.items.some((i) => i.index === index));
    if (owner && owner.number !== activeSection) {
      setActiveSection(owner.number);
      setShowPassage(false);
      setCurrentIndex(index);
      // The card is not laid out yet, so its offset is unknown — the part opens
      // at the top and the ring marks the question.
      scroller.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    jumpTo(index);
  }

  function goToSection(sectionNumber: number) {
    setActiveSection(sectionNumber);
    setShowPassage(false);
    scroller.current?.scrollTo({ y: 0, animated: true });
  }

  function leave() {
    if (result) { router.back(); return; }
    confirm({
      title: t('ieltsExitTitle'),
      message: t('ieltsExitBody'),
      confirmLabel: t('ieltsExitTitle'),
      destructive: true,
      onConfirm: () => router.back(),
    });
  }

  /** Hand the paper in. Every answered question travels; blanks simply don't. */
  function submit(): Promise<QuizResult> {
    const items: AnswerItem[] = Object.entries(answers)
      .filter(([index]) => isAnswered(Number(index)))
      .map(([index, value]) => ({ questionIndex: Number(index), answer: value }));
    return quizzesApi.submitQuiz(id!, items, token!);
  }

  function onSubmitted(res: QuizResult) {
    setResult(res);
    if (id) {
      markExerciseCompleted(id); // checkmark on the practice-set list
      markDailyTask(); // counts toward Өнөөдрийн зам like any other exercise
    }
    if (res.xpEarned > 0) { showXpToast(res.xpEarned); sound.xp(); }
    checkCelebrations(); // trophies/streak queued behind the result
    scroller.current?.scrollTo({ y: 0, animated: false });
  }

  // The spinner/error handling lives in the shared hook; only the "are you
  // sure, N are blank" gate is local, so the button press goes through it.
  const { busy: submitting, run: runSubmit } = useAsyncAction(submit, {
    onSuccess: onSubmitted,
  });

  function confirmSubmit(run: () => void) {
    if (!missing) { run(); return; }
    confirm({
      title: t('ieltsSubmitTitle'),
      message: tf('ieltsUnansweredWarn', { n: missing }),
      confirmLabel: t('ieltsSubmitAnyway'),
      onConfirm: run,
    });
  }

  if (failed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <EmptyState
          icon="cloud-offline-outline"
          title={t('ieltsLoadFailTitle')}
          hint={t('ieltsLoadFail')}
          action={{ label: t('retry'), onPress: load }}
        />
        <View style={styles.pad}>
          <Button label={t('back')} variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!quiz || !current) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Loading />
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ExamResult
          result={result}
          questions={quiz.questions}
          answers={answers}
          onRetake={() => { setAnswers({}); setResult(null); goToSection(sections[0].number); }}
          onLeave={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ExamHeader
        title={quiz.title}
        answered={answeredCount}
        total={total}
        budgetSeconds={recommendedSeconds(module?.key ?? 'reading', total)}
        onExit={leave}
      />
      <ExamNav
        sections={sections}
        partLabel={partLabel}
        activeSection={activeSection}
        onSelectSection={goToSection}
        isAnswered={isAnswered}
        currentIndex={currentIndex}
        onJump={jumpTo}
      />

      <ScrollView
        ref={scroller}
        contentContainerStyle={[styles.body, bounded]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Source material. Listening pins the recording; Reading keeps the
            passage one tap away instead of above every question, because a
            phone cannot show both at once the way the desktop site does. */}
        {/* Зөвхөн ЭНЭ хэсгийн эх материал. Бүтэн шалгалтад 4 яриа нэг талбарт
            цугладаг тул бүтнээр нь өгвөл 2-р хэсэг дээр 4-ийнхөө хариултыг
            сонсох болно. */}
        {isListening ? (
          <ExamAudioBar
            audioUrl={quiz.audioUrl}
            script={sectionText(quiz.passageText, current.number)}
          />
        ) : null}

        {isReading && quiz.passageText ? (
          <Pressable style={styles.toggle} onPress={() => setShowPassage((v) => !v)}>
            <Ionicons
              name={showPassage ? 'list-outline' : 'document-text-outline'}
              size={18}
              color={c.primary}
            />
            <AppText variant="bodyStrong" color={c.primary}>
              {showPassage ? t('ieltsShowQuestions') : t('ieltsShowPassage')}
            </AppText>
          </Pressable>
        ) : null}

        {showPassage && quiz.passageText ? (
          <View style={styles.passage}>
            <AppText variant="body" style={styles.passageText}>
              {sectionText(quiz.passageText, current.number)}
            </AppText>
          </View>
        ) : (
          <>
            {/* Which part you are answering, restated in the page. The nav
                above scrolls away; this does not, and after a minute of
                reading questions "which section was this?" is the first thing
                that goes. */}
            {sections.length > 1 ? (
              <View style={styles.partHead}>
                <AppText variant="overline" color={c.primary}>
                  {tf('ieltsPartOf', { label: partLabel, n: current.number, total: sections.length })}
                </AppText>
                <AppText variant="caption" color={c.textMuted}>
                  {tf('ieltsQuestionsRange', { from: current.from, to: current.to })}
                </AppText>
              </View>
            ) : null}

            {current.items.map(({ question, index }) => (
              <View
                key={index}
                onLayout={(e) => { offsets.current[index] = e.nativeEvent.layout.y; }}
              >
                <ExamQuestion
                  question={question}
                  number={index + 1}
                  value={answers[index]}
                  onChange={(value) => answer(index, value)}
                />
              </View>
            ))}

            {/* Next part rather than submit, until the last one — handing in
                from part 1 of 4 is almost always a misfire. */}
            {current.number !== sections[sections.length - 1].number ? (
              <Button
                label={tf('ieltsNextPart', {
                  label: partLabel,
                  n: nextSectionNumber(sections, current.number),
                })}
                iconRight="arrow-forward"
                onPress={() => goToSection(nextSectionNumber(sections, current.number))}
              />
            ) : (
              <>
                {/* A reminder in the page, not an error dialog: unanswered
                    questions are a normal state mid-test, and the student can
                    act on this one instead of dismissing it. */}
                {missing > 0 ? (
                  <Notice
                    tone="warning"
                    icon="help-circle-outline"
                    title={tf('ieltsLeftTitle', { n: missing })}
                    text={t('ieltsLeftBody')}
                    action={
                      firstUnanswered !== null
                        ? {
                            label: t('ieltsGoUnanswered'),
                            onPress: () => goToQuestion(firstUnanswered),
                          }
                        : undefined
                    }
                  />
                ) : (
                  <Notice icon="checkmark-circle-outline" text={t('ieltsAllAnswered')} />
                )}
                <Button
                  label={t('ieltsSubmitCta')}
                  icon="checkmark-done"
                  loading={submitting}
                  onPress={() => confirmSubmit(runSubmit)}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The part after `from`, or `from` itself when it is already the last. */
function nextSectionNumber(sections: { number: number }[], from: number): number {
  const at = sections.findIndex((s) => s.number === from);
  return sections[at + 1]?.number ?? from;
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    pad: { padding: spacing.lg, gap: spacing.sm },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: c.primarySoft,
    },
    partHead: {
      gap: 1,
      paddingHorizontal: spacing.xs,
    },
    passage: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    passageText: { lineHeight: 26 },
  });
