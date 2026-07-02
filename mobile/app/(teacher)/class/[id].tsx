import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/auth/AuthContext';
import * as classesApi from '../../../src/api/classes';
import * as assignmentsApi from '../../../src/api/assignments';
import { getLessons } from '../../../src/api/lessons';
import { getQuizzes } from '../../../src/api/quizzes';
import type { ClassDetail, ClassStudent } from '../../../src/api/classes';
import type { Assignment } from '../../../src/api/assignments';
import { t } from '../../../src/i18n';
import { AppText } from '../../../src/components/Text';
import { Avatar } from '../../../src/components/Avatar';
import { JoinCodeCard } from '../../../src/components/JoinCodeCard';
import { StudentRow } from '../../../src/components/StudentRow';
import { RequestRow } from '../../../src/components/RequestRow';
import { AssignmentRow } from '../../../src/components/AssignmentRow';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { spacing, radius, type AppColors } from '../../../src/theme/theme';
import { useColors } from '../../../src/settings/SettingsContext';

/** Section title with an optional count badge. */
function SectionTitle({ title, count, tint }: { title: string; count?: number; tint?: string }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.sectionHead}>
      <AppText variant="h2">{title}</AppText>
      {count != null ? (
        <View style={[styles.countBadge, tint ? { backgroundColor: tint } : null]}>
          <AppText variant="label" color={tint ? colors.white : colors.textSecondary}>{count}</AppText>
        </View>
      ) : null}
    </View>
  );
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [requests, setRequests] = useState<ClassStudent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<ClassStudent | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [d, reqs, a, lessons, quizzes] = await Promise.all([
        classesApi.getClass(id, token),
        classesApi.getJoinRequests(id, token),
        assignmentsApi.getClassAssignments(id, token),
        getLessons(token),
        getQuizzes(token),
      ]);
      setDetail(d);
      setRequests(reqs);
      setAssignments(a);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  async function onApprove(studentId: string) {
    if (!token || !id) return;
    setActingId(studentId);
    try {
      await classesApi.approveRequest(id, studentId, token);
      await load();
    } finally {
      setActingId(null);
    }
  }

  function onReject(studentId: string) {
    Alert.alert(t('rejectRequestConfirm'), '', [
      { text: t('back'), style: 'cancel' },
      {
        text: t('reject'),
        style: 'destructive',
        onPress: async () => {
          if (!token || !id) return;
          setActingId(studentId);
          try {
            await classesApi.rejectRequest(id, studentId, token);
            await load();
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  }

  function confirmDelete(assignmentId: string) {
    Alert.alert(t('deleteAssignment'), '', [
      { text: t('back'), style: 'cancel' },
      {
        text: t('delete'),
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

  // Roster ranked by XP for a leaderboard-like feel.
  const ranked = [...detail.students].sort((a, b) => b.xp - a.xp);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="h3" numberOfLines={1} style={styles.topTitle}>{detail.name}</AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <JoinCodeCard code={detail.joinCode} className={detail.name} />

        {/* Pending join requests (highlighted) */}
        {requests.length > 0 ? (
          <>
            <SectionTitle title={t('joinRequests')} count={requests.length} tint={colors.streak} />
            <Card variant="raised" padding="md" style={styles.requestCard}>
              {requests.map((r) => (
                <RequestRow
                  key={r.id}
                  name={r.fullName}
                  username={r.username}
                  avatarUrl={r.avatarUrl}
                  busy={actingId === r.id}
                  onApprove={() => onApprove(r.id)}
                  onReject={() => onReject(r.id)}
                />
              ))}
            </Card>
          </>
        ) : null}

        {/* Students */}
        <SectionTitle title={t('students')} count={detail.students.length} />
        {ranked.length === 0 ? (
          <Card variant="filled">
            <AppText variant="bodyStrong" center>{t('noStudents')}</AppText>
            <AppText variant="caption" center style={{ marginTop: 4 }}>{t('noStudentsHint')}</AppText>
          </Card>
        ) : (
          <Card variant="raised" padding="md">
            {ranked.map((s, i) => (
              <StudentRow
                key={s.id}
                rank={i + 1}
                name={s.fullName}
                username={s.username}
                avatarUrl={s.avatarUrl}
                xp={s.xp}
                onPress={() => setSelectedStudent(s)}
              />
            ))}
          </Card>
        )}

        {/* Assignments */}
        <SectionTitle title={t('assignments')} count={assignments.length || undefined} />
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

      {/* Student detail bottom sheet (read-only summary from the roster data). */}
      <Modal
        visible={selectedStudent != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedStudent(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectedStudent(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            {selectedStudent ? (
              <>
                <View style={styles.sheetHead}>
                  <Avatar
                    avatarUrl={selectedStudent.avatarUrl}
                    name={selectedStudent.fullName}
                    size={56}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" numberOfLines={1}>{selectedStudent.fullName}</AppText>
                    {selectedStudent.username ? (
                      <AppText variant="caption" color={colors.textSecondary}>
                        @{selectedStudent.username}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statBox}>
                    <Ionicons name="flash" size={18} color={colors.xp} />
                    <AppText variant="h3">{selectedStudent.xp}</AppText>
                    <AppText variant="caption" color={colors.textSecondary}>{t('xp')}</AppText>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="diamond" size={18} color={colors.sparks} />
                    <AppText variant="h3">{selectedStudent.sparks}</AppText>
                    <AppText variant="caption" color={colors.textSecondary}>{t('sparks')}</AppText>
                  </View>
                </View>
                <Button
                  label={t('close')}
                  variant="secondary"
                  onPress={() => setSelectedStudent(null)}
                  style={{ marginTop: spacing.lg }}
                />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xs },
  countBadge: {
    minWidth: 22, paddingHorizontal: 7, height: 22, borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  requestCard: { borderWidth: 1, borderColor: colors.streak },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,10,40,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statBox: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: spacing.md,
  },
});
