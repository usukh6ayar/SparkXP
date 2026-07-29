import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/auth/AuthContext';
import { getExercises, type Quiz, type QuizQuestion } from '../../../src/api/quizzes';
import { TopBar } from '../../../src/components/TopBar';
import { AppText } from '../../../src/components/Text';
import { AppImage } from '../../../src/components/AppImage';
import { Card } from '../../../src/components/Card';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { SkeletonRows } from '../../../src/components/SkeletonRows';
import { PressableScale } from '../../../src/components/PressableScale';
import { IELTS_MODULES } from '../../../src/constants/ielts';
import { t, tf } from '../../../src/i18n';
import { useColors } from '../../../src/settings/SettingsContext';
import { spacing, radius, fontSize, skillGradients, type AppColors } from '../../../src/theme/theme';
import { bounded } from '../../../src/theme/responsive';

/**
 * IELTS Writing/Speaking practice (Plan 3b) — self-study, no auto-score.
 *
 * A practice set is a normal Quiz (`category = ielts_writing | ielts_speaking`)
 * whose questions are `open_response` (a `prompt` + a hidden-until-revealed
 * `modelAnswer`/`bandNote`). Listening/Reading are auto-scored and go through the
 * quiz runner instead; these two get their own screen because there is nothing
 * to grade — the learner writes/speaks, then compares against the model answer.
 *
 * Two levels in one screen (mirrors `skill/[key]`): pick a set → practise it.
 */
export default function IeltsPracticeScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const module = IELTS_MODULES.find((m) => m.category === category);
  const isSpeaking = module?.key === 'speaking';
  const grad = module?.grad ?? skillGradients.writing;

  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [sets, setSets] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Quiz | null>(null);

  const load = useCallback(async () => {
    if (!token || !category) return;
    setLoading(true);
    try {
      const r = await getExercises(token, category);
      // Keep only sets that actually have self-study prompts.
      setSets(r.items.filter((q) => q.questions.some((qq) => qq.type === 'open_response')));
      setError(false);
    } catch (e) {
      console.warn('IELTS practice load failed:', (e as Error)?.message ?? e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token, category]);

  useEffect(() => {
    load();
  }, [load]);

  const title = module ? t(module.labelKey) : t('ieltsTitle');

  // ── Practice view (a set is selected) ─────────────────────────────────────
  if (selected) {
    const prompts = selected.questions.filter((q) => q.type === 'open_response');
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={selected.title} back onBack={() => setSelected(null)} showBadges={false} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.container, bounded]}
            keyboardShouldPersistTaps="handled"
          >
            <AppText variant="caption" color={c.textSecondary}>
              {t(isSpeaking ? 'ieltsSpeakTip' : 'ieltsWriteTip')}
            </AppText>
            {prompts.map((q, i) => (
              <PracticeCard key={i} q={q} index={i} isSpeaking={isSpeaking} c={c} styles={styles} />
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Set list ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={title} back showBadges={false} />
      <ScrollView contentContainerStyle={[styles.container, bounded]}>
        {loading ? (
          <SkeletonRows count={4} />
        ) : error ? (
          <EmptyState
            icon="cloud-offline"
            title={t('error')}
            hint={t('errorGeneric')}
            action={{ label: t('retry'), onPress: load }}
          />
        ) : sets.length === 0 ? (
          <EmptyState icon={module?.icon ?? 'create'} title={title} hint={t('ieltsNoSets')} />
        ) : (
          sets.map((s) => {
            const n = s.questions.filter((q) => q.type === 'open_response').length;
            return (
              <PressableScale key={s.id} onPress={() => setSelected(s)} style={styles.setTile}>
                <LinearGradient
                  colors={grad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.setIcon}
                >
                  <Ionicons name={module?.icon ?? 'create'} size={24} color={c.white} />
                </LinearGradient>
                <View style={styles.setBody}>
                  <AppText variant="bodyStrong" numberOfLines={2}>{s.title}</AppText>
                  <AppText variant="caption" color={c.textSecondary}>
                    {tf('ieltsSetCount', { n })}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
              </PressableScale>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** One open_response prompt: task text (+ optional chart) → own answer → reveal. */
function PracticeCard({
  q,
  index,
  isSpeaking,
  c,
  styles,
}: {
  q: QuizQuestion;
  index: number;
  isSpeaking: boolean;
  c: AppColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const taskText = q.prompt ?? q.question ?? '';

  return (
    <Card variant="flat" style={styles.practiceCard}>
      <AppText variant="caption" color={c.primary} style={styles.taskLabel}>
        {t('ieltsTask')} {index + 1}
      </AppText>
      {taskText ? <AppText variant="body">{taskText}</AppText> : null}
      {q.imageUrl ? (
        <AppImage source={q.imageUrl} width={640} style={styles.chart} contentFit="cover" />
      ) : null}

      <TextInput
        style={styles.input}
        value={answer}
        onChangeText={setAnswer}
        placeholder={t(isSpeaking ? 'ieltsSpeakNotes' : 'ieltsWritePlaceholder')}
        placeholderTextColor={c.textMuted}
        multiline
        textAlignVertical="top"
        accessibilityLabel={t(isSpeaking ? 'ieltsSpeakNotes' : 'ieltsWritePlaceholder')}
      />

      {q.modelAnswer ? (
        <>
          <Button
            label={t(revealed ? 'ieltsHideModel' : 'ieltsRevealModel')}
            variant="secondary"
            size="md"
            icon={revealed ? 'eye-off-outline' : 'bulb-outline'}
            onPress={() => setRevealed((r) => !r)}
          />
          {revealed ? (
            <View style={styles.model}>
              <AppText variant="caption" color={c.textSecondary} style={styles.taskLabel}>
                {t('ieltsModelAnswer')}
              </AppText>
              <AppText variant="body">{q.modelAnswer}</AppText>
              {q.bandNote ? (
                <AppText variant="caption" color={c.textSecondary} style={{ marginTop: spacing.xs }}>
                  {q.bandNote}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    flex: { flex: 1 },
    container: { padding: spacing.lg, gap: spacing.md },
    setTile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    setIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setBody: { flex: 1, gap: 2 },
    practiceCard: { gap: spacing.sm },
    taskLabel: { textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
    chart: { width: '100%', height: 180, borderRadius: radius.md },
    input: {
      minHeight: 120,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.md,
      backgroundColor: c.surfaceAlt,
      padding: spacing.md,
      fontSize: fontSize.md,
      color: c.text,
    },
    model: {
      backgroundColor: c.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: 2,
    },
  });
