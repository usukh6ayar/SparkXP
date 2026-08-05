import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { Confetti } from '../../src/components/Confetti';
import { ProgressBar } from '../../src/components/ProgressBar';
import { PressableScale } from '../../src/components/PressableScale';
import { Loading } from '../../src/components/Loading';
import { getSampleQuestions, type SampleQuestion } from '../../src/api/words';
import { markTasteCompleted, ONBOARDING_BONUS_XP } from '../../src/lib/tasteTask';
import { haptics } from '../../src/lib/haptics';
import { t, tf } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, fontSize, progressGradients, type AppColors } from '../../src/theme/theme';

const COUNT = 3;
/** Server-fixed onboarding bonus, shown as a promise. Shared with the
 *  onboarding AI-buddy demo so the two screens can never quote different XP. */
const TASTE_XP = ONBOARDING_BONUS_XP;

/**
 * Pre-signup taste-task (C4): a guest answers a few vocab questions BEFORE
 * creating an account, so the app proves its value first. Questions come from
 * the public `/words/sample` endpoint and are graded on the device — the real
 * +XP is granted by the backend once the account's email is verified.
 */
export default function TasteScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [questions, setQuestions] = useState<SampleQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  // Sign-up must never depend on this bonus screen: if the sample can't load,
  // send the guest straight to registration instead of showing an error.
  const goRegister = useCallback(() => router.replace('/(auth)/register'), [router]);

  useEffect(() => {
    getSampleQuestions(COUNT)
      .then((items) => (items.length ? setQuestions(items) : goRegister()))
      .catch(goRegister);
  }, [goRegister]);

  if (!questions) {
    return (
      <Screen centered>
        <Loading />
      </Screen>
    );
  }

  const question = questions[index];
  const answered = picked !== null;

  function choose(option: string) {
    if (answered) return;
    const isRight = option === question.answer;
    setPicked(option);
    if (isRight) {
      setCorrect((n) => n + 1);
      haptics.success();
    } else {
      haptics.error();
    }
  }

  async function next() {
    if (index + 1 < questions!.length) {
      setIndex(index + 1);
      setPicked(null);
      return;
    }
    // Finished: remember it so registration can claim the one-time bonus.
    await markTasteCompleted();
    haptics.success();
    setDone(true);
  }

  if (done) {
    return (
      <Screen centered>
        <Confetti />
        <View style={styles.doneBox}>
          <AppText variant="h1" style={styles.center}>{t('tasteDoneTitle')}</AppText>
          <AppText variant="body" color={c.textSecondary} style={styles.center}>
            {tf('tasteDoneBody', { correct, total: questions.length, xp: TASTE_XP })}
          </AppText>
          <View style={styles.xpBadge}>
            <AppText variant="bodyStrong" color={c.xp}>
              {tf('tasteXpBadge', { xp: TASTE_XP })}
            </AppText>
          </View>
          <Button label={t('tasteRegisterCta')} onPress={goRegister} />
          <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
            <AppText variant="bodyStrong" color={c.primary}>{t('login')}</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.head}>
        <AppText variant="h2">{t('tasteTitle')}</AppText>
        <AppText variant="body" color={c.textSecondary}>{t('tasteSubtitle')}</AppText>
        <ProgressBar value={(index + (answered ? 1 : 0)) / questions.length} gradient={progressGradients.primary} />
        <AppText variant="caption" color={c.textMuted}>
          {tf('tasteProgress', { n: index + 1, total: questions.length })}
        </AppText>
      </View>

      <View style={styles.wordCard}>
        <AppText variant="h1" color={c.white}>{question.english}</AppText>
      </View>
      <AppText variant="bodyStrong" style={styles.prompt}>{t('tasteQuestion')}</AppText>

      <View style={styles.options}>
        {question.options.map((option) => {
          // After an answer: the right one turns green, a wrong pick turns red.
          const isAnswer = option === question.answer;
          const state = !answered ? 'idle' : isAnswer ? 'correct' : option === picked ? 'wrong' : 'idle';
          return (
            <PressableScale
              key={option}
              haptic={false}
              onPress={() => choose(option)}
              style={[
                styles.option,
                state === 'correct' && styles.optionCorrect,
                state === 'wrong' && styles.optionWrong,
              ]}
            >
              <AppText variant="body" style={styles.optionText}>{option}</AppText>
            </PressableScale>
          );
        })}
      </View>

      {answered ? (
        <View style={styles.footer}>
          <AppText
            variant="bodyStrong"
            color={picked === question.answer ? c.success : c.danger}
            style={styles.center}
          >
            {picked === question.answer ? t('tasteCorrect') : t('tasteWrong')}
          </AppText>
          <Button label={t('continue')} onPress={next} />
        </View>
      ) : (
        // Escape hatch — a guest can always go straight to sign-up.
        <Pressable onPress={goRegister} hitSlop={8} style={styles.skip}>
          <AppText variant="bodyStrong" color={c.textMuted}>{t('skip')}</AppText>
        </Pressable>
      )}
    </Screen>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    center: { textAlign: 'center' },
    head: { gap: spacing.sm, marginBottom: spacing.lg },
    wordCard: {
      backgroundColor: c.primary,
      borderRadius: radius.xl,
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    prompt: { marginTop: spacing.lg, marginBottom: spacing.md },
    options: { gap: spacing.sm },
    option: {
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    optionCorrect: { borderColor: c.success, backgroundColor: c.successSoft },
    optionWrong: { borderColor: c.danger, backgroundColor: c.dangerSoft },
    optionText: { fontSize: fontSize.md, color: c.text },
    footer: { marginTop: spacing.lg, gap: spacing.md },
    skip: { marginTop: spacing.lg, alignSelf: 'center' },
    doneBox: { gap: spacing.lg, alignItems: 'center' },
    xpBadge: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
    },
  });
