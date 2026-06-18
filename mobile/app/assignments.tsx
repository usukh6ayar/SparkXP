import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { getMyAssignments, type Assignment } from '../src/api/assignments';
import { getLessons } from '../src/api/lessons';
import { getQuizzes } from '../src/api/quizzes';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { IconTile } from '../src/components/IconTile';
import { Loading } from '../src/components/Loading';
import { t } from '../src/i18n';
import { colors, spacing, radius, tints } from '../src/theme/theme';

export default function AssignmentsScreen() {
  const { token } = useAuth();
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="clipboard-outline" size={40} color={colors.primary} />
              </View>
              <AppText variant="h3" center style={{ marginTop: spacing.md }}>{t('noAssignmentsStudent')}</AppText>
              <AppText variant="body" center color={colors.textSecondary} style={{ marginTop: 2 }}>
                {t('noAssignmentsStudentHint')}
              </AppText>
            </View>
          ) : (
            items.map((a) => <AssignmentItem key={a.id} a={a} title={titles[a.targetId]} onPress={() => open(a)} />)
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AssignmentItem({ a, title, onPress }: { a: Assignment; title?: string; onPress: () => void }) {
  const isLesson = a.type === 'lesson';
  const tint = isLesson ? tints.blue : tints.green;
  const overdue = a.dueAt ? new Date(a.dueAt).getTime() < Date.now() : false;
  const due = a.dueAt
    ? new Date(a.dueAt).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })
    : t('noDueDate');

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <IconTile icon={isLesson ? 'book' : 'help-circle'} bg={tint.bg} fg={tint.fg} size={48} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>{title ?? '—'}</AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color={tint.fg}>{isLesson ? t('assignLesson') : t('assignQuiz')}</AppText>
          <AppText variant="caption" color={colors.textMuted}>·</AppText>
          <Ionicons name="calendar-outline" size={12} color={overdue ? colors.danger : colors.textMuted} />
          <AppText variant="caption" color={overdue ? colors.danger : colors.textSecondary}>
            {overdue ? t('overdue') : due}
          </AppText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xxxl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: radius.full, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
});
