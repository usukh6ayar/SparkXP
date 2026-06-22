import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { getMe } from '../src/api/auth';
import { getQuiz, submitQuiz, type QuizQuestion, type QuizResult } from '../src/api/quiz';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { Loading } from '../src/components/Loading';
import { Button } from '../src/components/Button';
import { ProgressBar } from '../src/components/ProgressBar';
import { colors, spacing, radius, elevation } from '../src/theme/theme';

const QUESTION_COUNT = 10;

/**
 * "Үг ангууч" — vocabulary quiz. Shows an English word + 4 Mongolian options;
 * the user picks one per question. Grading + XP/Sparks happen server-side
 * (POST /words/quiz/submit) so the answer is never exposed to the client.
 */
export default function VocabQuizScreen() {
  const { token, updateUser } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    if (!token) return;
    getQuiz(token, QUESTION_COUNT)
      .then(setQuestions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  async function finish(allChoices: Record<string, string>) {
    if (!token) return;
    setSubmitting(true);
    const answers = Object.entries(allChoices).map(([wordId, choice]) => ({ wordId, choice }));
    try {
      const res = await submitQuiz(token, answers);
      setResult(res);
      // Pull the updated XP/Sparks into the cached user (header counters).
      getMe(token).then(updateUser).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  function pick(option: string) {
    const q = questions[index];
    if (!q || picked) return;
    setPicked(option);
    const nextChoices = { ...choices, [q.wordId]: option };
    setChoices(nextChoices);
    // brief pause so the selection registers visually, then advance
    setTimeout(() => {
      if (index + 1 < questions.length) {
        setIndex((i) => i + 1);
        setPicked(null);
      } else {
        finish(nextChoices);
      }
    }, 220);
  }

  if (loading) return <Loading />;

  if (error || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar title="Үг ангууч" back />
        <View style={styles.center}>
          <AppText style={styles.emoji}>😕</AppText>
          <AppText variant="body" color={colors.textSecondary} center>
            Сорил ачаалж чадсангүй. Дараа дахин оролдоно уу.
          </AppText>
          <Button label="Буцах" icon="arrow-back" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────
  if (result) {
    const perfect = result.correct === result.total;
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar title="Дүн" back />
        <View style={styles.center}>
          <AppText style={styles.emoji}>{perfect ? '🏆' : '🎉'}</AppText>
          <AppText variant="h1" center>
            {result.correct} / {result.total} зөв
          </AppText>
          <View style={styles.rewards}>
            <View style={[styles.rewardPill, { backgroundColor: colors.cream }]}>
              <Ionicons name="flash" size={16} color={colors.xp} />
              <AppText variant="label" color={colors.xp}>+{result.xpAwarded} XP</AppText>
            </View>
            <View style={[styles.rewardPill, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="diamond" size={16} color={colors.primary} />
              <AppText variant="label" color={colors.primary}>+{result.sparksAwarded}</AppText>
            </View>
          </View>
          <Button
            label="Дахин тоглох"
            icon="refresh"
            onPress={() => {
              setResult(null); setIndex(0); setChoices({}); setPicked(null);
              setLoading(true); setError(false);
              if (token) getQuiz(token, QUESTION_COUNT).then(setQuestions).catch(() => setError(true)).finally(() => setLoading(false));
            }}
            style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}
          />
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <AppText variant="label" color={colors.textSecondary}>Сорил руу буцах</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Question screen ──────────────────────────────────────────────────────
  const q = questions[index];
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar title="Үг ангууч" back />

      <View style={styles.progressWrap}>
        <ProgressBar value={(index + (picked ? 1 : 0)) / questions.length} color={colors.primary} />
        <AppText variant="caption" style={styles.progressText}>
          {index + 1} / {questions.length}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.prompt}>
          <AppText variant="caption" color={colors.textMuted}>Энэ үгийн утга?</AppText>
          <AppText style={styles.word}>{q.english}</AppText>
          {q.phonetic ? (
            <AppText variant="body" color={colors.textMuted}>{q.phonetic}</AppText>
          ) : null}
        </View>

        <View style={styles.options}>
          {q.options.map((opt) => {
            const selected = picked === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => pick(opt)}
                disabled={!!picked}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <AppText variant="h3" color={selected ? colors.primary : colors.text}>{opt}</AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {submitting ? (
        <View style={styles.submitting}>
          <AppText variant="label" color={colors.textSecondary}>Дүн бодож байна…</AppText>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  progressWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  progressText: { textAlign: 'right', marginTop: spacing.xs },
  body: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  prompt: { alignItems: 'center', marginBottom: spacing.xxl },
  word: { fontSize: 36, lineHeight: 42, fontWeight: '800', color: colors.navy, marginTop: spacing.xs, textAlign: 'center' },
  options: { gap: spacing.md },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    ...(elevation.sm as object),
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rewards: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  rewardPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
  },
  backLink: { marginTop: spacing.lg, padding: spacing.sm },
  submitting: { padding: spacing.lg, alignItems: 'center' },
});
