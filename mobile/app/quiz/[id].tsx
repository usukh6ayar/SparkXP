import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as quizzesApi from '../../src/api/quizzes';
import type { Quiz, AnswerItem, QuizResult } from '../../src/api/quizzes';
import { Button } from '../../src/components/Button';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { alertError } from '../../src/lib/alerts';
import { t } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, fontSize, type AppColors } from '../../src/theme/theme';

type Phase = 'loading' | 'quiz' | 'result' | 'error';

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
  // word_match: leftIndex → chosen right value, plus the currently-picked left.
  const [matches, setMatches] = useState<Record<number, string>>({});
  const [selLeft, setSelLeft] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setPhase('loading');
    return quizzesApi.getQuiz(id!, token!)
      .then((q) => { setQuiz(q); setPhase('quiz'); })
      .catch(() => setPhase('error'));
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

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
    setSelLeft(null);
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
      setResult(res);
      setPhase('result');
    } catch {
      alertError('Хариулт илгээхэд алдаа гарлаа.');
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
          <Text style={styles.backBtn}>← {t('back')}</Text>
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
        <Text style={styles.questionText}>
          {currentQ!.question ?? (currentQ!.type === 'word_match' ? 'Зөв хосыг нь холбоно уу' : '')}
        </Text>

        {currentQ!.type === 'multiple_choice' && currentQ!.imageUrl ? (
          <Image source={{ uri: currentQ!.imageUrl }} style={styles.questionImage} resizeMode="cover" />
        ) : null}

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
            placeholder={t('yourAnswer')}
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
          />
        )}

        {currentQ!.type === 'word_match' && (
          <View style={styles.wmRow}>
            {/* Left column — tap to pick, shows the chosen match */}
            <View style={styles.wmCol}>
              {(currentQ!.pairs ?? []).map((p, i) => (
                <Pressable
                  key={i}
                  style={[styles.wmItem, selLeft === i && styles.wmItemSel, matches[i] && styles.wmItemDone]}
                  onPress={() => setSelLeft(i)}
                >
                  <Text style={styles.wmText}>{p.left}</Text>
                  {matches[i] ? <Text style={styles.wmMatch}>→ {matches[i]}</Text> : null}
                </Pressable>
              ))}
            </View>
            {/* Right column — tap to assign to the picked left */}
            <View style={styles.wmCol}>
              {shuffledRights.map((r, i) => {
                const used = Object.values(matches).includes(r);
                return (
                  <Pressable
                    key={i}
                    disabled={used}
                    style={[styles.wmItem, used && styles.wmItemUsed]}
                    onPress={() => {
                      if (selLeft === null) return;
                      setMatches((m) => ({ ...m, [selLeft]: r }));
                      setSelLeft(null);
                    }}
                  >
                    <Text style={[styles.wmText, used && styles.wmTextUsed]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Button
          label={isLast ? (submitting ? 'Илгээж байна...' : t('submit')) : t('next')}
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
  progressBar: { height: 4, backgroundColor: c.border, marginHorizontal: spacing.lg, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: c.primary, borderRadius: 2 },
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
  // word_match
  wmRow: { flexDirection: 'row', gap: spacing.md },
  wmCol: { flex: 1, gap: spacing.sm },
  wmItem: {
    borderWidth: 2, borderColor: c.border, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md, minHeight: 48, justifyContent: 'center',
  },
  wmItemSel: { borderColor: c.primary, backgroundColor: c.primarySoft },
  wmItemDone: { borderColor: c.success, backgroundColor: c.successSoft },
  wmItemUsed: { opacity: 0.35 },
  wmText: { fontSize: fontSize.md, color: c.text, fontWeight: '600' },
  wmTextUsed: { color: c.textMuted },
  wmMatch: { fontSize: fontSize.sm, color: c.primary, marginTop: 2 },
  errorText: { color: c.danger, fontSize: fontSize.md },
  // Result styles
  resultEmoji: { fontSize: 64, textAlign: 'center', marginBottom: spacing.sm },
  resultTitle: { fontSize: fontSize.xl, fontWeight: '800', color: c.navy, textAlign: 'center' },
  resultScore: { fontSize: 56, fontWeight: '900', color: c.primary, textAlign: 'center', marginTop: spacing.sm },
  resultSub: { color: c.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  xpBadge: {
    alignSelf: 'center',
    backgroundColor: c.primarySoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  xpBadgeText: { color: c.primary, fontWeight: '800', fontSize: fontSize.md },
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
