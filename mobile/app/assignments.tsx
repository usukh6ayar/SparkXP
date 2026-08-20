import { useCallback, useState, useMemo } from 'react';
import { View, Pressable, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { getMyAssignments, type Assignment } from '../src/api/assignments';
import {
  groupAssignments,
  groupTitle,
  type AssignmentGroup,
} from '../src/lib/assignmentGroups';
import { TopBar } from '../src/components/TopBar';
import { Card } from '../src/components/Card';
import { AssignmentRow } from '../src/components/AssignmentRow';
import { PeriodTabs } from '../src/components/PeriodTabs';
import { AppText } from '../src/components/Text';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { EmptyState } from '../src/components/EmptyState';
import { t, tf, type TranslationKey } from '../src/i18n';
import { isRecent } from '../src/lib/timeAgo';
import {
  bucketOf, BUCKET_ORDER, BUCKET_LABEL, type TimeBucket,
} from '../src/lib/notificationCenter';
import {
  markAssignmentsSeen,
  getAssignmentsLastSeen,
} from '../src/lib/useAssignmentBadge';
import { enter, useReduceMotion } from '../src/lib/motion';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/** The three views of the list — one tap each, no scrolling to find them. */
type FilterKey = 'all' | 'todo' | 'done';

const FILTERS: { key: FilterKey; labelKey: TranslationKey }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'todo', labelKey: 'assignmentFilterTodo' },
  { key: 'done', labelKey: 'assignmentFilterDone' },
];

/** Inside one day-group: still-unfinished first, then newest arrival. */
function byPriority(a: AssignmentGroup, b: AssignmentGroup): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  // ISO strings compare correctly.
  return b.head.createdAt.localeCompare(a.head.createdAt);
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
 * Нэг багцын мөр — задарсан даалгаврын дотор.
 *
 * Багц бүр өөрийн `assignmentId`-тай тул нээхэд сервер яг тэр багцын
 * асуултуудыг л өгнө. Дугаар нь дараалал ЗААХГҮЙ (дурын дарааллаар хийнэ),
 * зөвхөн «хэд дэх нь вэ» гэдгийг хэлнэ.
 */
function PartRow({
  part,
  index,
  c,
  onPress,
}: {
  part: Assignment;
  index: number;
  c: AppColors;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.partRow} onPress={onPress}>
      <View style={[styles.partNo, { backgroundColor: c.surfaceAlt }]}>
        <AppText variant="label" color={c.textSecondary}>{index + 1}</AppText>
      </View>
      <View style={styles.partBody}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {part.targetTopic || part.targetTitle || '—'}
        </AppText>
        {part.questionCount ? (
          <AppText variant="caption" color={c.textMuted}>
            {tf('questionCount', { n: part.questionCount })}
          </AppText>
        ) : null}
      </View>
      <ActionChip a={part} c={c} />
    </Pressable>
  );
}

/**
 * The row's one right-hand chip.
 *
 * The old meta row stacked three competing labels — a grey "Хийгээгүй" pill,
 * "100 оноотой" / "Үзэхэд хангалттай", and the timestamp — none of which the
 * student could act on. A pending row now says what tapping it does; a handed-in
 * row shows the score, which is the only number that actually exists (lessons
 * are recorded with a null score, so there is nothing to invent there).
 */
function ActionChip({ a, c }: { a: Assignment; c: AppColors }) {
  const status = a.status ?? 'assigned';

  if (status === 'assigned') {
    return (
      <View style={[styles.chip, { backgroundColor: c.primarySoft }]}>
        <AppText variant="label" color={c.primary}>
          {t(a.type === 'lesson' ? 'assignmentOpenLesson' : 'assignmentOpenQuiz')}
        </AppText>
        <Ionicons name="arrow-forward" size={13} color={c.primary} />
      </View>
    );
  }

  const late = status === 'late';
  const fg = late ? c.warning : c.success;
  return (
    <View style={[styles.chip, { backgroundColor: late ? c.warningSoft : c.successSoft }]}>
      <Ionicons name={late ? 'time' : 'checkmark-circle'} size={14} color={fg} />
      <AppText variant="label" color={fg}>
        {a.scorePct == null
          ? t(`submissionStatus_${status}`)
          : tf('assignmentScoreOf', { n: a.scorePct })}
      </AppText>
    </View>
  );
}

export default function AssignmentsScreen() {
  const { token } = useAuth();
  const c = useColors();
  const themed = useMemo(() => makeStyles(c), [c]);
  const reduce = useReduceMotion();
  const router = useRouter();
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // When the student last opened this list — anything newer gets a "ШИНЭ" pill.
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  // Аль олон багцтай даалгавар задарсан бэ. Нэг нь л задарна — сурагч нэг
  // даалгавраа хийж байгаа, задарсан жагсаалтууд дараагийнхаа нурааж булна.
  const [openKey, setOpenKey] = useState<string | null>(null);

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
      setItems(assignments);
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
   * Segment counts: "how many are still waiting" is the number the student
   * opens this screen for, so it sits on the tab itself rather than being
   * something they have to count down the list.
   */
  /**
   * Нэг илгээлт = нэг мөр. Багш 5 сэдвээс асуулт сонгож нэг даалгавар өгөхөд
   * сервер 5 мөр үүсгэдэг — сурагч дээр тэр нь **ганц** даалгавар байх ёстой
   * (`src/lib/assignmentGroups.ts`).
   */
  const groups = useMemo(() => groupAssignments(items), [items]);

  const tabs = useMemo(() => {
    const done = groups.filter((g) => g.done).length;
    const count: Record<FilterKey, number> = {
      all: groups.length,
      todo: groups.length - done,
      done,
    };
    return FILTERS.map((f) => ({ ...f, count: count[f.key] }));
  }, [groups]);

  const visible = useMemo(() => {
    if (filter === 'all') return groups;
    return groups.filter((g) => (filter === 'done' ? g.done : !g.done));
  }, [groups, filter]);

  /**
   * Grouped by the day it arrived — the same Өнөөдөр / Өчигдөр / Сүүлийн 7
   * хоног / Өмнөх sections the notification centre uses.
   *
   * A per-row "23 цагийн өмнө ирсэн" caption made the student do date
   * arithmetic on every single row for something the header can state once.
   */
  const sections = useMemo(() => {
    const byBucket = new Map<TimeBucket, AssignmentGroup[]>();
    for (const g of visible) {
      const bucket = bucketOf(g.head.createdAt);
      const list = byBucket.get(bucket);
      if (list) list.push(g);
      else byBucket.set(bucket, [g]);
    }
    return BUCKET_ORDER.flatMap((bucket) => {
      const rows = byBucket.get(bucket);
      return rows ? [{ key: bucket, label: t(BUCKET_LABEL[bucket]), rows: rows.sort(byPriority) }] : [];
    });
  }, [visible]);

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

  // Runs across every day-group so the entry animation stays one cascade.
  let row = 0;

  return (
    <SafeAreaView style={themed.safe} edges={['top']}>
      <TopBar title={t('myAssignments')} back showBadges={false} />
      {loading ? (
        <SkeletonRows count={4} style={themed.skeleton} />
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
            <>
              <PeriodTabs
                value={filter}
                options={tabs}
                onChange={setFilter}
                style={styles.tabs}
              />
              {/* The filter emptied the list — say which of the two good
                  things happened, not a bare "no results". */}
              {sections.length === 0 ? (
                <EmptyState
                  icon={filter === 'done' ? 'time-outline' : 'checkmark-done-outline'}
                  title={t(filter === 'done' ? 'assignmentNoneDone' : 'assignmentAllDone')}
                  hint={t(filter === 'done' ? 'assignmentNoneDoneHint' : 'assignmentAllDoneHint')}
                />
              ) : null}
              {sections.map((section) => (
                <View key={section.key} style={styles.section}>
                  <AppText variant="overline" color={c.textMuted} style={styles.sectionHeader}>
                    {section.label}
                  </AppText>
                  {section.rows.map((g) => {
                    const a = g.head;
                    const fresh = isNew(a, lastSeen);
                    // Олон багцтай даалгавар нээгддэггүй — задардаг. Багц бүр
                    // өөрийн сорилтой тул нээх үйлдэл нь багцын мөрөнд байна.
                    const bundle = g.parts.length > 1;
                    const isOpen = openKey === g.key;
                    return (
                      <Animated.View
                        key={g.key}
                        entering={reduce ? undefined : enter(row++ * 55, 260)}
                      >
                        <Card
                          padding="md"
                          onPress={() =>
                            bundle ? setOpenKey(isOpen ? null : g.key) : open(a)
                          }
                          style={fresh ? themed.cardNew : undefined}
                        >
                          <AssignmentRow
                            type={a.type}
                            title={bundle ? groupTitle(g) : a.targetTitle ?? '—'}
                            topic={bundle ? null : a.targetTopic}
                            partCount={g.parts.length}
                            questionCount={g.questionCount}
                            note={a.note}
                            dueAt={a.dueAt}
                            progress={
                              bundle
                                ? { done: g.doneParts, total: g.parts.length }
                                : undefined
                            }
                            progressLabel={
                              bundle
                                ? g.done
                                  ? t('assignmentPacksAllDone')
                                  : tf('assignmentPacksDone', {
                                      done: g.doneParts,
                                      total: g.parts.length,
                                    })
                                : undefined
                            }
                          />

                          {bundle && isOpen ? (
                            <View style={themed.parts}>
                              <AppText variant="caption" color={c.textMuted}>
                                {t('assignmentPacksHint')}
                              </AppText>
                              {g.parts.map((part, i) => (
                                <PartRow
                                  key={part.id}
                                  part={part}
                                  index={i}
                                  c={c}
                                  onPress={() => open(part)}
                                />
                              ))}
                            </View>
                          ) : null}

                          {/* Ганц багцтай даалгаварт үйлдлийн чип хэрэгтэй;
                              олон багцтайд нь чип нь багц бүр дээрээ байна. */}
                          {fresh || !bundle ? (
                            <>
                              <View style={themed.divider} />
                              <View style={styles.metaRow}>
                                {/* Arrived since the last visit — the day header says
                                    "Өнөөдөр", this says "and you haven't seen it yet". */}
                                {fresh ? (
                                  <View style={[styles.newPill, { backgroundColor: c.primary }]}>
                                    <AppText variant="label" color={c.white}>{t('newLabel')}</AppText>
                                  </View>
                                ) : null}
                                <View style={styles.spacer} />
                                {bundle ? (
                                  <View style={[styles.chip, { backgroundColor: c.primarySoft }]}>
                                    <AppText variant="label" color={c.primary}>
                                      {t(isOpen ? 'close' : 'assignmentOpenPacks')}
                                    </AppText>
                                    <Ionicons
                                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                                      size={13}
                                      color={c.primary}
                                    />
                                  </View>
                                ) : (
                                  <ActionChip a={a} c={c} />
                                )}
                              </View>
                            </>
                          ) : null}
                        </Card>
                      </Animated.View>
                    );
                  })}
                  </View>
                ))}
            </>
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Theme-free layout lives outside the component so it is built once.
const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  section: { gap: spacing.sm },
  sectionHeader: { marginTop: spacing.md, marginBottom: 2, textTransform: 'uppercase' },
  tabs: { marginTop: spacing.xs },
  emptyWrap: { marginTop: spacing.xxl },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  partNo: {
    width: 24, height: 24, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  partBody: { flex: 1 },
  spacer: { flex: 1 },
  newPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
});

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  skeleton: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  // Same "unread" language as the notification centre: a tinted card, not a
  // red alarm pill — new homework is an invitation, not an error.
  cardNew: { backgroundColor: c.primarySoft, borderColor: c.primary },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  // Задарсан багцууд — картын дотор, нимгэн зураасаар тусгаарлагдсан.
  parts: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: 2,
  },
});
