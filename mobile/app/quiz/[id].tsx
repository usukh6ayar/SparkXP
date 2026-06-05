import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as quizzesApi from '../../src/api/quizzes';
import type { Quiz, AnswerItem, QuizResult } from '../../src/api/quizzes';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, fontSize } from '../../src/theme/theme';

type Phase = 'loading' | 'quiz' | 'result' | 'error';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  const [fillText, setFillText] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    quizzesApi.getQuiz(id!, token!)
      .then((q) => { setQuiz(q); setPhase('quiz'); })
      .catch(() => setPhase('error'));
  }, [id]);

  const currentQ = quiz?.questions[currentIndex];
  const isLast = quiz ? currentIndex === quiz.questions.length - 1 : false;

  function saveAnswer() {
    const answer = currentQ?.type === 'multiple_choice' ? selected! : fillText.trim();
    setAnswers((prev) => {
      const next = prev.filter((a) => a.questionIndex !== currentIndex);
      return [...next, { questionIndex: currentIndex, answer }];
    });
  }

  function canAdvance() {
    if (currentQ?.type === 'multiple_choice') return selected !== null;
    return fillText.trim().length > 0;
  }

  function nextQuestion() {
    saveAnswer();
    setSelected(null);
    setFillText('');
    setCurrentIndex((i) => i + 1);
  }

  async function handleSubmit() {
    saveAnswer();
    const finalAnswers: AnswerItem[] = [
      ...answers.filter((a) => a.questionIndex !== currentIndex),
      {
        questionIndex: currentIndex,
        answer: currentQ?.type === 'multiple_choice' ? selected! : fillText.trim(),
      },
    ];
    setSubmitting(true);
    try {
      const res = await quizzesApi.submitQuiz(id!, finalAnswers, token!);
      setResult(res);
      setPhase('result');
    } catch {
      Alert.alert('Алдаа', 'Хариулт илгээхэд алдаа гарлаа.');
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Quiz ачаалахад алдаа гарлаа.</Text>
        <Button label="Буцах" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    );
  }

  if (phase === 'result' && result) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.resultEmoji}>{result.passed ? '🎉' : '😅'}</Text>
          <Text style={styles.resultTitle}>
            {result.passed ? 'Тэнцлээ!' : 'Дахин оролдоорой'}
          </Text>
          <Text style={styles.resultScore}>{result.percentage}%</Text>
          <Text style={styles.resultSub}>
            {result.score} / {result.total} оноо
          </Text>

          {result.xpEarned > 0 && (
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+{result.xpEarned} XP ⚡</Text>
            </View>
          )}

          <View style={styles.breakdownBox}>
            {result.breakdown.map((b) => (
              <View key={b.questionIndex} style={styles.breakdownRow}>
                <Text style={styles.breakdownNum}>{b.questionIndex + 1}</Text>
                <Text style={b.correct ? styles.correct : styles.wrong}>
                  {b.correct ? '✓' : '✗'}
                </Text>
                <Text style={styles.breakdownPts}>{b.points} оноо</Text>
              </View>
            ))}
          </View>

          <Button label="Дуусгах" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backBtn}>← Буцах</Text>
        </Pressable>
        <Text style={styles.progress}>
          {currentIndex + 1} / {quiz!.questions.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentIndex + 1) / quiz!.questions.length) * 100}%` },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.quizTitle}>{quiz!.title}</Text>
        <Text style={styles.questionText}>{currentQ!.question}</Text>

        {currentQ!.type === 'multiple_choice' && (
          <View style={styles.optionsContainer}>
            {currentQ!.options!.map((opt, i) => (
              <Pressable
                key={i}
                style={[styles.option, selected === i && styles.optionSelected]}
                onPress={() => setSelected(i)}
              >
                <Text style={[styles.optionLabel, selected === i && styles.optionLabelSelected]}>
                  {String.fromCharCode(65 + i)}
                </Text>
                <Text style={[styles.optionText, selected === i && styles.optionTextSelected]}>
                  {opt}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {currentQ!.type === 'fill_blank' && (
          <TextInput
            style={styles.fillInput}
            value={fillText}
            onChangeText={setFillText}
            placeholder="Хариултаа бичнэ үү..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
        )}

        <Button
          label={isLast ? (submitting ? 'Илгээж байна...' : 'Дүгнэх') : 'Дараагийнх →'}
          onPress={isLast ? handleSubmit : nextQuestion}
          disabled={!canAdvance() || submitting}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { color: colors.primary, fontWeight: '600', fontSize: fontSize.md },
  progress: { color: colors.textMuted, fontSize: fontSize.sm },
  progressBar: { height: 4, backgroundColor: colors.border, marginHorizontal: spacing.lg, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  container: { padding: spacing.lg, paddingTop: spacing.md },
  quizTitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm },
  questionText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: spacing.xl,
    lineHeight: 30,
  },
  optionsContainer: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionLabel: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  optionLabelSelected: { backgroundColor: colors.primary, color: colors.white },
  optionText: { flex: 1, fontSize: fontSize.md, color: colors.text },
  optionTextSelected: { color: colors.navy, fontWeight: '600' },
  fillInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  errorText: { color: colors.danger, fontSize: fontSize.md },
  // Result styles
  resultEmoji: { fontSize: 64, textAlign: 'center', marginBottom: spacing.sm },
  resultTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  resultScore: { fontSize: 56, fontWeight: '900', color: colors.primary, textAlign: 'center', marginTop: spacing.sm },
  resultSub: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  xpBadge: {
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  xpBadgeText: { color: colors.primary, fontWeight: '800', fontSize: fontSize.md },
  breakdownBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  breakdownNum: { width: 24, fontWeight: '700', color: colors.textMuted, fontSize: fontSize.sm },
  correct: { fontSize: fontSize.lg, color: colors.success },
  wrong: { fontSize: fontSize.lg, color: colors.danger },
  breakdownPts: { color: colors.textMuted, fontSize: fontSize.sm },
});
