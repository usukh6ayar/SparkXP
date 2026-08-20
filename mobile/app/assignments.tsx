import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { getMyAssignments, type Assignment } from '../src/api/assignments';
import { TopBar } from '../src/components/TopBar';
import { Card } from '../src/components/Card';
import { AssignmentRow } from '../src/components/AssignmentRow';
import { StatusBadge } from '../src/components/StatusBadge';
import { AppText } from '../src/components/Text';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { EmptyState } from '../src/components/EmptyState';
import { t } from '../src/i18n';
import { timeAgo, isRecent } from '../src/lib/timeAgo';
import {
  markAssignmentsSeen,
  getAssignmentsLastSeen,
} from '../src/lib/useAssignmentBadge';
import { enter, useReduceMotion } from '../src/lib/motion';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/** Has the student handed this one in? `assigned` is the only pending state. */
function isDone(a: Assignment): boolean {
  return (a.status ?? 'assigned') !== 'assigned';
}

/**
 * Not-yet-done first, newest arrival at the top of each group.
 *
 * The previous order was by due date, which buried homework that arrived today
 * under everything already finished — the student had no way to tell what was
 * new. Urgency is not lost: every row carries its own "3 өдөр үлдлээ" countdown.
 */
function sortAssignments(list: Assignment[]): Assignment[] {
  return [...list].sort((a, b) => {
    if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
    // ISO strings compare correctly, newest first.
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Should this row be flagged as new?
 *
 * On the very first visit there is no mark to compare against — flagging the
 * whole list then would shout "ШИНЭ" at homework finished weeks ago, so fall
 * back to "arrived in the last 24h", which is what the student actually means.
 */
function isNew(a: Assignment, lastSeen: string | null): boolean {
  return lastSeen ? a.createdAt > lastSeen : isRecent(a.createdAt);
}

/**
 * What this assignment is worth, stated BEFORE the student opens it — the whole
 * point of the change: "хэдэн оноотой вэ" should never be a mystery.
 *
 * Quizzes are graded 0–100 (`scorePct`). Lessons are not graded at all: the
 * server records completion with a null score, so claiming a number there would
 * be an invented one.
 */
function scoreLabel(a: Assignment): string {
  if (a.type === 'lesson') return t('assignmentLessonNoScore');
  if (a.scorePct == null) return t('assignmentMaxScore');
  return `${t('assignmentScore')} ${a.scorePct} / 100`;
}

export default function AssignmentsScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduce = useReduceMotion();
  const router = useRouter();
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // When the student last opened this list — anything newer gets a "ШИНЭ" pill.
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      /*
       * Гарчиг нь **даалгаврын мөрөн дээрээ** ирнэ (`targetTitle`).
       *
       * Урьд нь бүх хичээл + бүх сорилыг татаад id-гаар нь тааруулдаг байв.
       * Даалгаврын сангийн тест сурагчийн жагсаалтад ОГТ харагдахгүй болсон
       * тул тэр арга «—» гэж гаргана — мөн 2 илүү хүсэлт байсан.
       */
      const assignments = await getMyAssignments(token);
      setItems(sortAssignments(assignments));
      setError(false);

      // Read the previous mark BEFORE moving it, so "ШИНЭ" stays visible for
      // the whole visit instead of clearing itself the instant the list paints.
      if (assignments.length > 0) {
        const previous = await getAssignmentsLastSeen();
        setLastSeen(previous);
        const newest = assignments.reduce(
          (max, a) => (a.createdAt > max ? a.createdAt : max),
          assignments[0].createdAt,
        );
        await markAssignmentsSeen(newest);
      }
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

  /**
   * Даалгавраа нээх.
   *
   * ⚠️ Сорилд `assignmentId` **заавал** дамжина: сервер түүгээр л багшийн
   * сонгосон асуултуудыг шүүж өгдөг (мөн даалгаврын сангийн дасгалыг нээх
   * цорын ганц түлхүүр нь энэ) бөгөөд гүйцэтгэлийг багшийн самбарт
   * бүртгэдэг.
   */
  function open(a: Assignment) {
    router.push(
      a.type === 'lesson'
        ? `/lesson/${a.targetId}`
        : `/quiz/${a.targetId}?assignmentId=${a.id}`,
    );
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
                    title={a.targetTitle ?? '—'}
                    topic={a.targetTopic}
                    questionCount={a.questionCount}
                    note={a.note}
                    dueAt={a.dueAt}
                    onPress={() => open(a)}
                  />
                  <View style={styles.metaRow}>
                    {/* Arrived since the last visit — answers "which one is
                        today's?", which a list of finished tasks otherwise hides. */}
                    {isNew(a, lastSeen) ? (
                      <View style={[styles.newPill, { backgroundColor: c.danger }]}>
                        <AppText variant="caption" color={c.white}>{t('newLabel')}</AppText>
                      </View>
                    ) : null}
                    {a.status ? <StatusBadge status={a.status} /> : null}
                    <AppText variant="label" color={c.textSecondary}>
                      {scoreLabel(a)}
                    </AppText>
                    <View style={styles.spacer} />
                    <AppText variant="caption" color={c.textMuted}>
                      {timeAgo(a.createdAt)}
                    </AppText>
                  </View>
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
  spacer: { flex: 1 },
  newPill: { paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full },
});
