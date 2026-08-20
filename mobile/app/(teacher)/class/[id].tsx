import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/auth/AuthContext';
import * as classesApi from '../../../src/api/classes';
import * as assignmentsApi from '../../../src/api/assignments';
import { useSWR } from '../../../src/api/useSWR';
import type { ClassDetail, ClassStudent } from '../../../src/api/classes';
import type { Assignment } from '../../../src/api/assignments';
import {
  groupAssignments,
  groupTitle,
  type AssignmentGroup,
} from '../../../src/lib/assignmentGroups';
import { getClassOverview, type ClassOverview } from '../../../src/api/teacher';
import { t, tf } from '../../../src/i18n';
import { AppText } from '../../../src/components/Text';
import { SkillBars } from '../../../src/components/SkillBars';
import { JoinCodeCard } from '../../../src/components/JoinCodeCard';
import { StudentRow } from '../../../src/components/StudentRow';
import { RequestRow } from '../../../src/components/RequestRow';
import { AssignmentRow } from '../../../src/components/AssignmentRow';
import { SubmissionList } from '../../../src/components/SubmissionList';
import { EditAssignmentStudents } from '../../../src/components/EditAssignmentStudents';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { EmptyState } from '../../../src/components/EmptyState';
import { SkeletonRows } from '../../../src/components/SkeletonRows';
import { haptics } from '../../../src/lib/haptics';
import { alertError } from '../../../src/lib/alerts';
import { spacing, radius, type AppColors } from '../../../src/theme/theme';
import { useColors } from '../../../src/settings/SettingsContext';
import { bounded } from '../../../src/theme/responsive';

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
  const enabled = !!token && !!id;

  // Each per-class paint resource is stale-while-revalidate: on return the
  // cached value paints instantly (no skeleton/empty-state flash) then
  // revalidates in the background. `client.ts` dedups + clears on mutation.
  const { data: detail, loading, refetch: refetchDetail } = useSWR<ClassDetail>(
    `/classes/${id}`,
    () => classesApi.getClass(id!, token!),
    { enabled },
  );
  const { data: requests = [], refetch: refetchRequests } = useSWR<ClassStudent[]>(
    `/classes/${id}/requests`,
    () => classesApi.getJoinRequests(id!, token!),
    { enabled },
  );
  const { data: assignments = [], refetch: refetchAssignments } = useSWR<Assignment[]>(
    `/assignments?classId=${id}`,
    () => assignmentsApi.getClassAssignments(id!, token!),
    { enabled },
  );
  /*
   * Гарчиг/сэдэв нь даалгаврын мөрөн дээрээ серверээс ирнэ (`targetTitle`,
   * `targetTopic`). Урьд нь бүх хичээл + бүх сорилыг татаж id-гаар нь
   * тааруулдаг байсныг больсон: даалгаврын сангийн тест тэр жагсаалтад
   * байхгүй тул «—» болно (мөн 2 илүү хүсэлт).
   */

  // Analytics overview is fire-and-forget behind the `overview &&` guard, so its
  // failure never blanks the roster/assignments.
  const [overview, setOverview] = useState<ClassOverview | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (token && id) getClassOverview(id, token).then(setOverview).catch(() => {});
    }, [token, id]),
  );

  /*
   * Аль даалгаврын нэрсийн жагсаалт нээлттэй байна вэ. Нэг нь л — багш нэг
   * ажлын араас хөөцөлдөж байгаа бөгөөд задарсан жагсаалтууд доорх ангийн
   * жагсаалтыг булчихна.
   */
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  /** Аль даалгаврын бүрэлдэхүүнийг засаж байна вэ (багцуудынх нь id). */
  const [editing, setEditing] = useState<AssignmentGroup | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDetail(), refetchRequests(), refetchAssignments()]);
    setRefreshing(false);
  }, [refetchDetail, refetchRequests, refetchAssignments]);

  async function onApprove(studentId: string) {
    if (!token || !id) return;
    setActingId(studentId);
    try {
      await classesApi.approveRequest(id, studentId, token);
      haptics.success();
      // Roster gains a student, requests loses one.
      await Promise.all([refetchDetail(), refetchRequests()]);
    } catch {
      alertError(t('errorGeneric'));
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
            await refetchRequests();
          } catch {
            alertError(t('errorGeneric'));
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  }

  /**
   * Даалгавар устгах. Олон багцтай бол **бүх багцыг** устгана — багш нэг
   * даалгавар өгсөн, түүнийгээ буцааж авч байгаа болохоос «5-аас 1-ийг нь»
   * гэж бодохгүй.
   */
  function confirmDelete(group: AssignmentGroup) {
    Alert.alert(
      t('deleteAssignment'),
      group.parts.length > 1
        ? tf('deleteAssignmentParts', { n: group.parts.length })
        : '',
      [
        { text: t('back'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await Promise.all(
                group.parts.map((p) => assignmentsApi.deleteAssignment(p.id, token)),
              );
              refetchAssignments();
            } catch {
              alertError(t('errorGeneric'));
            }
          },
        },
      ],
    );
  }

  // First load — skeleton. Only while we have nothing to show yet.
  if (loading && !detail) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SkeletonRows count={6} style={{ padding: spacing.lg }} />
      </SafeAreaView>
    );
  }

  // Load failed and we have no cached detail → recoverable error, not a dead spinner.
  if (!detail) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: () => { refetchDetail(); refetchRequests(); refetchAssignments(); } }}
        />
      </SafeAreaView>
    );
  }

  // Roster ranked by XP for a leaderboard-like feel.
  const ranked = [...detail.students].sort((a, b) => b.xp - a.xp);
  /*
   * Нэг илгээлт = нэг мөр. Багш 5 сэдвээс асуулт сонгоод нэг даалгавар өгөхөд
   * сервер 5 мөр үүсгэдэг — багш өөрөө нэг л даалгавар өгсөн гэж боддог тул
   * жагсаалт нь мөн тэгж харагдана (`src/lib/assignmentGroups.ts`).
   */
  const groups = groupAssignments(assignments);

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
        contentContainerStyle={[styles.content, bounded]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <JoinCodeCard code={detail.joinCode} className={detail.name} />

        {/* Class skill breakdown (from real quiz attempts) */}
        {overview && (
          <>
            <SectionTitle title={t('avgProgress')} />
            <Card variant="raised" padding="md" style={{ gap: spacing.sm }}>
              <SkillBars
                rows={(['listening', 'reading', 'writing', 'fill'] as const).map((k) => ({
                  key: k,
                  value: overview.skills[k],
                }))}
              />
              {overview.weakestSkill ? (
                <View style={styles.weakChip}>
                  <Ionicons name="trending-down" size={14} color={colors.streak} />
                  <AppText variant="label" color={colors.streak}>
                    {t('weakestSkill')}: {t(`skill_${overview.weakestSkill}` as 'skill_listening')}
                  </AppText>
                </View>
              ) : null}
            </Card>
          </>
        )}

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
                onPress={() => router.push(`/(teacher)/class/${id}/student/${s.id}`)}
              />
            ))}
          </Card>
        )}

        {/* Assignments */}
        <SectionTitle title={t('assignments')} count={groups.length || undefined} />
        {groups.length === 0 ? (
          <Card variant="filled">
            <AppText variant="bodyStrong" center>{t('noAssignments')}</AppText>
          </Card>
        ) : (
          <Card variant="raised" padding="md">
            {groups.map((g) => {
              const a = g.head;
              const students = a.studentIds?.length ?? detail?.students.length ?? 0;
              const bundle = g.parts.length > 1;
              const open = openGroupKey === g.key;
              const handedIn = g.parts.reduce((sum, p) => sum + (p.completedCount ?? 0), 0);
              const expected = students * g.parts.length;
              return (
                <View key={g.key}>
                  <AssignmentRow
                    type={a.type}
                    title={bundle ? groupTitle(g) : a.targetTitle ?? '—'}
                    topic={bundle ? null : a.targetTopic}
                    partCount={g.parts.length}
                    questionCount={g.questionCount}
                    note={a.note}
                    dueAt={a.dueAt}
                    progress={{ done: handedIn, total: expected }}
                    progressLabel={
                      /*
                       * Олон багцтай даалгаварт «8/12 хийсэн» гэж бичих
                       * боломжгүй: хэдэн сурагч БҮГДИЙГ нь дуусгасныг мэдэхийн
                       * тулд багц бүрийн нэрсийг татах хэрэгтэй (задлахад л
                       * татагдана). Тиймээс энд нэгжгүй хувь — «нийт хэдэн
                       * хувь нь гүйцэтгэгдсэн бэ». Сурагч тус бүрийн явц
                       * доорх жагсаалтад гарна.
                       */
                      bundle
                        ? tf('submissionsProgressPct', {
                            n: expected ? Math.round((handedIn / expected) * 100) : 0,
                          })
                        : undefined
                    }
                    expanded={open}
                    onPress={() => setOpenGroupKey((cur) => (cur === g.key ? null : g.key))}
                    onDelete={() => confirmDelete(g)}
                  />

                  {open ? (
                    <>
                      {/*
                        Багцууд нь **мэдээлэл** — юу өгсний жагсаалт. Урьд нь
                        эдгээрийг дарж багц тус бүрийн нэрсийг задалдаг байсан
                        нь буруу байв: тэнд бүх сурагчийн нэр гарч, «энэ багцад
                        эдгээр сурагч байна» гэж уншигдаж, хэн юу хийснийг
                        хэлдэггүй байлаа. Сурагч даалгаврыг багц багцаар нь
                        гүйцэтгэдэг тул хариулт нь доорх ганц жагсаалтад:
                        нэр бүрийн ард «3/5 багц».
                      */}
                      {bundle ? (
                        <View style={styles.parts}>
                          {g.parts.map((part, i) => (
                            <View key={part.id} style={styles.partRow}>
                              <View style={styles.partNo}>
                                <AppText variant="label" color={colors.textSecondary}>
                                  {i + 1}
                                </AppText>
                              </View>
                              <View style={styles.partBody}>
                                <AppText variant="body" numberOfLines={1}>
                                  {part.targetTopic || part.targetTitle || '—'}
                                </AppText>
                              </View>
                              {part.questionCount ? (
                                <AppText variant="caption" color={colors.textMuted}>
                                  {tf('questionCount', { n: part.questionCount })}
                                </AppText>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {/* Бүрэлдэхүүн засах — шинэ сурагч нэмэх / буруу
                          сонголтыг залруулах. Даалгаврыг устгаад дахин өгөх
                          нь хийсэн хүмүүсийн дүнг арчина. */}
                      <Pressable style={styles.editRow} onPress={() => setEditing(g)}>
                        <Ionicons name="people-outline" size={16} color={colors.primary} />
                        <AppText variant="label" color={colors.primary}>
                          {t('editStudents')}
                        </AppText>
                        <AppText variant="caption" color={colors.textMuted}>
                          {a.studentIds?.length
                            ? tf('assignedToCount', { n: a.studentIds.length })
                            : t('editStudentsAll')}
                        </AppText>
                      </Pressable>
                      <SubmissionList
                        packs={g.parts.map((p) => ({
                          id: p.id,
                          label: p.targetTopic || p.targetTitle || '—',
                        }))}
                      />
                    </>
                  ) : null}
                </View>
              );
            })}
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

      {editing ? (
        <EditAssignmentStudents
          visible
          onClose={() => setEditing(null)}
          onSaved={refetchAssignments}
          assignmentIds={editing.parts.map((p) => p.id)}
          roster={detail.students}
          current={editing.head.studentIds ?? null}
        />
      ) : null}
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
  // Задарсан багцууд — толгой мөрөөс догол мөрөөр ялгарна.
  parts: {
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginBottom: spacing.sm,
  },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  partNo: {
    width: 24, height: 24, borderRadius: radius.full, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  partBody: { flex: 1 },
  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  weakChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
