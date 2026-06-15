import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/auth/AuthContext';
import * as classesApi from '../../../src/api/classes';
import * as assignmentsApi from '../../../src/api/assignments';
import { getLessons } from '../../../src/api/lessons';
import { getQuizzes } from '../../../src/api/quizzes';
import type { ClassDetail } from '../../../src/api/classes';
import type { Assignment } from '../../../src/api/assignments';
import { t } from '../../../src/i18n';
import { AppText } from '../../../src/components/Text';
import { JoinCodeCard } from '../../../src/components/JoinCodeCard';
import { StudentRow } from '../../../src/components/StudentRow';
import { AssignmentRow } from '../../../src/components/AssignmentRow';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { colors, spacing } from '../../../src/theme/theme';

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [d, a, lessons, quizzes] = await Promise.all([
        classesApi.getClass(id, token),
        assignmentsApi.getClassAssignments(id, token),
        getLessons(token),
        getQuizzes(token),
      ]);
      setDetail(d);
      setAssignments(a);
      // Map lesson/quiz id → title so assignment rows can show a readable name.
      const map: Record<string, string> = {};
      lessons.items.forEach((l) => (map[l.id] = l.title));
      quizzes.items.forEach((q) => (map[q.id] = q.title));
      setTitles(map);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(assignmentId: string) {
    Alert.alert(t('deleteAssignment'), '', [
      { text: t('back'), style: 'cancel' },
      {
        text: t('deleteAssignment'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          await assignmentsApi.deleteAssignment(assignmentId, token);
          load();
        },
      },
    ]);
  }

  if (loading || !detail) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="h3" numberOfLines={1} style={styles.topTitle}>
          {detail.name}
        </AppText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <JoinCodeCard code={detail.joinCode} className={detail.name} />

        {/* Students */}
        <View style={styles.sectionHead}>
          <AppText variant="h2">{t('students')}</AppText>
          <AppText variant="caption">
            {detail.students.length} {t('studentCount')}
          </AppText>
        </View>
        {detail.students.length === 0 ? (
          <Card variant="filled">
            <AppText variant="bodyStrong" center>{t('noStudents')}</AppText>
            <AppText variant="caption" center style={{ marginTop: 4 }}>{t('noStudentsHint')}</AppText>
          </Card>
        ) : (
          <Card variant="raised" padding="md">
            {detail.students.map((s) => (
              <StudentRow key={s.id} name={s.fullName} xp={s.xp} />
            ))}
          </Card>
        )}

        {/* Assignments */}
        <View style={styles.sectionHead}>
          <AppText variant="h2">{t('assignments')}</AppText>
        </View>
        {assignments.length === 0 ? (
          <Card variant="filled">
            <AppText variant="bodyStrong" center>{t('noAssignments')}</AppText>
          </Card>
        ) : (
          <Card variant="raised" padding="md">
            {assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                type={a.type}
                title={titles[a.targetId] ?? '—'}
                dueAt={a.dueAt}
                onDelete={() => confirmDelete(a.id)}
              />
            ))}
          </Card>
        )}

        <Button
          label={t('assignHomework')}
          icon="add"
          onPress={() => router.push(`/(teacher)/class/${id}/assign`)}
          style={{ marginTop: spacing.lg }}
        />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
});
