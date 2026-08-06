import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { getMyAssignments, type Assignment } from '../src/api/assignments';
import { getLessons } from '../src/api/lessons';
import { getQuizzes } from '../src/api/quizzes';
import { TopBar } from '../src/components/TopBar';
import { Card } from '../src/components/Card';
import { AssignmentRow } from '../src/components/AssignmentRow';
import { StatusBadge } from '../src/components/StatusBadge';
import { AppText } from '../src/components/Text';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { EmptyState } from '../src/components/EmptyState';
import { t } from '../src/i18n';
import { enter, useReduceMotion } from '../src/lib/motion';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

export default function AssignmentsScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduce = useReduceMotion();
  const router = useRouter();
  const [items, setItems] = useState<Assignment[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

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
      setError(false);
    } catch (e) {
      console.warn('Assignments load failed:', (e as Error)?.message ?? e);
      setError(true);
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
      <TopBar title={t('myAssignments')} back showBadges={false} />
      {loading ? (
        <SkeletonRows count={4} style={styles.skeleton} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, bounded]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        >
          {items.length === 0 ? (
            <Animated.View entering={reduce ? undefined : FadeIn.duration(320)} style={styles.emptyWrap}>
              {error ? (
                <EmptyState
                  icon="alert-circle-outline"
                  title={t('error')}
                  hint={t('errorGeneric')}
                  action={{ label: t('retry'), onPress: load }}
                />
              ) : (
                <EmptyState
                  icon="clipboard-outline"
                  title={t('noAssignmentsStudent')}
                  hint={t('noAssignmentsStudentHint')}
                />
              )}
            </Animated.View>
          ) : (
            items.map((a, i) => (
              <Animated.View key={a.id} entering={reduce ? undefined : enter(i * 55, 260)}>
                <Card variant="flat" padding="md">
                  <AssignmentRow
                    type={a.type}
                    title={titles[a.targetId] ?? '—'}
                    note={a.note}
                    dueAt={a.dueAt}
                    overdue={a.dueAt ? new Date(a.dueAt).getTime() < Date.now() : false}
                    onPress={() => open(a)}
                  />
                  {(a.status || a.scorePct != null) && (
                    <View style={styles.metaRow}>
                      {a.status ? <StatusBadge status={a.status} /> : null}
                      {a.scorePct != null ? (
                        <AppText variant="label" color={c.textSecondary}>{a.scorePct}%</AppText>
                      ) : null}
                    </View>
                  )}
                </Card>
              </Animated.View>
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
  skeleton: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  emptyWrap: { marginTop: spacing.xxl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
