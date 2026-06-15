import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../src/auth/AuthContext';
import * as assignmentsApi from '../../../../src/api/assignments';
import type { AssignmentType } from '../../../../src/api/assignments';
import { getLessons } from '../../../../src/api/lessons';
import { getQuizzes } from '../../../../src/api/quizzes';
import { ApiError } from '../../../../src/api/client';
import { t } from '../../../../src/i18n';
import { AppText } from '../../../../src/components/Text';
import { SelectField } from '../../../../src/components/SelectField';
import { Button } from '../../../../src/components/Button';
import { colors, spacing, radius } from '../../../../src/theme/theme';

// Due-date presets (no native date-picker dependency for the MVP).
const DUE_PRESETS: { label: string; days: number | null }[] = [
  { label: 'Хугацаагүй', days: null },
  { label: '1 хоног', days: 1 },
  { label: '3 хоног', days: 3 },
  { label: '7 хоног', days: 7 },
];

export default function AssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [type, setType] = useState<AssignmentType>('lesson');
  const [items, setItems] = useState<Record<AssignmentType, { id: string; title: string }[]>>({
    lesson: [],
    quiz: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedTitle, setSelectedTitle] = useState<string | undefined>();
  const [duePreset, setDuePreset] = useState<string>(DUE_PRESETS[0].label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [lessons, quizzes] = await Promise.all([getLessons(token), getQuizzes(token)]);
        setItems({
          lesson: lessons.items.map((l) => ({ id: l.id, title: l.title })),
          quiz: quizzes.items.map((q) => ({ id: q.id, title: q.title })),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const list = items[type];
  const selected = list.find((i) => i.title === selectedTitle);

  function pickType(next: AssignmentType) {
    setType(next);
    setSelectedTitle(undefined); // reset selection when switching type
  }

  function computeDueAt(): string | undefined {
    const preset = DUE_PRESETS.find((p) => p.label === duePreset);
    if (!preset?.days) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + preset.days);
    return d.toISOString();
  }

  async function onAssign() {
    if (!token || !id || !selected) return;
    setError(null);
    setBusy(true);
    try {
      await assignmentsApi.createAssignment(
        { classId: id, type, targetId: selected.id, dueAt: computeDueAt() },
        token,
      );
      router.back(); // class detail refetches on focus
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="h3" style={styles.topTitle}>{t('assignHomework')}</AppText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.body}>
        {/* Type toggle */}
        <AppText variant="label" style={styles.label}>{t('assignType')}</AppText>
        <View style={styles.toggle}>
          {(['lesson', 'quiz'] as AssignmentType[]).map((tp) => {
            const active = type === tp;
            return (
              <Pressable
                key={tp}
                style={[styles.toggleBtn, active && styles.toggleOn]}
                onPress={() => pickType(tp)}
              >
                <AppText variant="bodyStrong" color={active ? colors.white : colors.textSecondary}>
                  {tp === 'lesson' ? t('assignLesson') : t('assignQuiz')}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <SelectField
              label={t('selectContent')}
              placeholder={t('selectContent')}
              value={selectedTitle}
              options={list.map((i) => i.title)}
              onSelect={setSelectedTitle}
            />
            <SelectField
              label={t('dueDate')}
              placeholder={t('noDueDate')}
              value={duePreset}
              options={DUE_PRESETS.map((p) => p.label)}
              onSelect={setDuePreset}
            />
            {error ? (
              <AppText variant="caption" color={colors.danger} style={{ marginBottom: spacing.sm }}>
                {error}
              </AppText>
            ) : null}
            <Button
              label={t('assign')}
              iconRight="arrow-forward"
              onPress={onAssign}
              loading={busy}
              disabled={!selected}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  label: { marginBottom: spacing.xs },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  toggleOn: { backgroundColor: colors.primary },
});
