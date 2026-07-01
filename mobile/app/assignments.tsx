import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { getMyAssignments, type Assignment } from '../src/api/assignments';
import { getLessons } from '../src/api/lessons';
import { getQuizzes } from '../src/api/quizzes';
import { TopBar } from '../src/components/TopBar';
import { Card } from '../src/components/Card';
import { AssignmentRow } from '../src/components/AssignmentRow';
import { Loading } from '../src/components/Loading';
import { EmptyState } from '../src/components/EmptyState';
import { t } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, type AppColors } from '../src/theme/theme';

export default function AssignmentsScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const [items, setItems] = useState<Assignment[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [assignments, lessons, quizzes] = await Promise.all([
        getMyAssignments(token),
        getLessons(token),
        getQuizzes(token),
      ]);
      // Soonest due first; undated last.
      assignments.sort((a, b) => {
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
      setItems(assignments);
      const map: Record<string, string> = {};
      lessons.items.forEach((l) => (map[l.id] = l.title));
      quizzes.items.forEach((q) => (map[q.id] = q.title));
      setTitles(map);
    } catch {
      // keep last
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function open(a: Assignment) {
    router.push(a.type === 'lesson' ? `/lesson/${a.targetId}` : `/quiz/${a.targetId}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('myAssignments')} back />
      {loading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        >
          {items.length === 0 ? (
            <EmptyState
              icon="clipboard-outline"
              title={t('noAssignmentsStudent')}
              hint={t('noAssignmentsStudentHint')}
            />
          ) : (
            items.map((a) => (
              <Card key={a.id} variant="flat" padding="md">
                <AssignmentRow
                  type={a.type}
                  title={titles[a.targetId] ?? '—'}
                  dueAt={a.dueAt}
                  overdue={a.dueAt ? new Date(a.dueAt).getTime() < Date.now() : false}
                  onPress={() => open(a)}
                />
              </Card>
            ))
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
});
