import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { getDue, submitReview } from '../src/api/reviews';
import { getWords } from '../src/api/words';
import { ApiError } from '../src/api/client';
import { t } from '../src/i18n';
import { colors, spacing, radius, fontSize } from '../src/theme/theme';
import { Loading } from '../src/components/Loading';
import { Button } from '../src/components/Button';

/** One study card (works for both due reviews and brand-new words). */
interface Card {
  wordId: string;
  english: string;
  mongolian: string;
  exampleSentence: string | null;
}

/** SM-2 quality per button. */
const GRADES = [
  { key: 'again', quality: 2, color: colors.danger },
  { key: 'hard', quality: 3, color: colors.primary },
  { key: 'good', quality: 4, color: colors.success },
  { key: 'easy', quality: 5, color: colors.navy },
] as const;

export default function ReviewScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const due = await getDue(token);
      let next: Card[];
      if (due.length > 0) {
        next = due.map((d) => ({ wordId: d.wordId, ...d.word }));
      } else {
        // Nothing due yet → introduce new words from the vocabulary bank.
        const res = await getWords(token, { limit: 20 });
        next = res.items.map((w) => ({ wordId: w.id, ...w }));
      }
      setCards(next);
      setIndex(0);
      setFlipped(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function grade(quality: number) {
    if (!token || submitting) return;
    const card = cards[index];
    setSubmitting(true);
    try {
      await submitReview(token, card.wordId, quality);
      setFlipped(false);
      setIndex((i) => i + 1); // advance (may reach the "done" state)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading />;

  const current = cards[index];
  const done = !current;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ {t('back')}</Text>
        </Pressable>
        {!done && cards.length > 0 ? (
          <Text style={styles.progress}>
            {index + 1} / {cards.length}
          </Text>
        ) : (
          <View />
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Empty / done states */}
      {cards.length === 0 ? (
        <Empty
          title={t('noReviews')}
          hint={t('noReviewsHint')}
          onHome={() => router.back()}
        />
      ) : done ? (
        <Empty
          title={t('reviewDone')}
          hint={t('reviewDoneHint')}
          onHome={() => router.back()}
        />
      ) : (
        <View style={styles.body}>
          {/* Flashcard */}
          <Pressable
            style={styles.card}
            onPress={() => setFlipped((f) => !f)}
          >
            <Text style={styles.cardWord}>{current.english}</Text>
            {flipped ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.cardAnswer}>{current.mongolian}</Text>
                {current.exampleSentence ? (
                  <Text style={styles.cardExample}>
                    {t('example')}: {current.exampleSentence}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.hint}>{t('tapToFlip')}</Text>
            )}
          </Pressable>

          {/* Grade buttons (only after flip) */}
          {flipped ? (
            <View style={styles.grades}>
              {GRADES.map((g) => (
                <Pressable
                  key={g.key}
                  style={[styles.grade, { backgroundColor: g.color }]}
                  onPress={() => grade(g.quality)}
                  disabled={submitting}
                >
                  <Text style={styles.gradeText}>{t(g.key)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.flipPrompt}>{t('tapToFlip')}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

/** Empty / completed state with a "back home" button. */
function Empty({
  title,
  hint,
  onHome,
}: {
  title: string;
  hint: string;
  onHome: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyHint}>{hint}</Text>
      <Button label={t('backHome')} onPress={onHome} style={styles.emptyBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  progress: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '700' },
  error: {
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  body: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.xl,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWord: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.navy },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    alignSelf: 'stretch',
    marginVertical: spacing.lg,
  },
  cardAnswer: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
  cardExample: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  hint: { marginTop: spacing.lg, color: colors.textMuted, fontSize: fontSize.sm },
  flipPrompt: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
    fontSize: fontSize.sm,
  },
  grades: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  grade: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  gradeText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyBtn: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
