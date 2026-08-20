import { useEffect, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../src/auth/AuthContext';
import * as assignmentsApi from '../../../../src/api/assignments';
import type { AssignmentType } from '../../../../src/api/assignments';
import * as classesApi from '../../../../src/api/classes';
import type { ClassStudent } from '../../../../src/api/classes';
import { getLessons } from '../../../../src/api/lessons';
import { getQuizzes, getAssignmentBank, type Quiz } from '../../../../src/api/quizzes';
import { t, tf, type TranslationKey } from '../../../../src/i18n';
import { AppText } from '../../../../src/components/Text';
import { SelectField } from '../../../../src/components/SelectField';
import { TextField } from '../../../../src/components/TextField';
import { FilterChips } from '../../../../src/components/FilterChips';
import { ActionButton } from '../../../../src/components/ActionButton';
import {
  QuestionPicker,
  countPicked,
  type PickedQuestions,
} from '../../../../src/components/QuestionPicker';
import { spacing, radius, type AppColors } from '../../../../src/theme/theme';
import { bounded } from '../../../../src/theme/responsive';
import { useColors } from '../../../../src/settings/SettingsContext';

// Due-date presets (no native date-picker dependency for the MVP). Labels are
// i18n keys, resolved with t() at render so they follow the app language.
const DUE_PRESETS: { labelKey: TranslationKey; days: number | null }[] = [
  { labelKey: 'noDueDate', days: null },
  { labelKey: 'due1Day', days: 1 },
  { labelKey: 'due3Days', days: 3 },
  { labelKey: 'due7Days', days: 7 },
];

/** Багшийн жагсаалтад бүх контент багтах ёстой (серверийн анхдагч нь 20). */
const CONTENT_LIMIT = 200;

/**
 * Оноож болох нэг хичээл. `group` дээр чипс шүүнэ — CEFR түвшин.
 */
type Pickable = { id: string; title: string; group: string };

/** Түвшингүй хичээл ч ямар нэг чипсэд харагдах ёстой. */
const UNGROUPED = '—';

/**
 * The dropdown label. The group is appended because two lessons can share a
 * title (e.g. "Present Simple" at A1 and B1) and the picker matches on the
 * label — without it the teacher could assign the wrong one.
 */
function labelOf(item: Pickable): string {
  return item.group === UNGROUPED
    ? item.title
    : `${item.title} · ${item.group.toUpperCase()}`;
}

/**
 * Даалгавар оноох дэлгэц.
 *
 * **Хичээл** нь бүхлээрээ оногддог тул нэгийг нь сонгоно. **Сорил** нь
 * асуултын түвшинд оногддог (`QuestionPicker`): багш «Present Simple»-ээс 3,
 * «Modal verbs»-ээс 2 асуулт сонгоод нэг дор явуулж чадна — сэдэв бүр өөрийн
 * даалгаврын мөр болно, харин сурагч руу мэдэгдэл нэг л очно.
 */
export default function AssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [type, setType] = useState<AssignmentType>('lesson');
  const [lessons, setLessons] = useState<Pickable[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  // Хичээлийн сонголт (нэг зүйл).
  const [selectedTitle, setSelectedTitle] = useState<string | undefined>();
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  // Сорилын сонголт (олон тест, тест бүрээс олон асуулт).
  const [picked, setPicked] = useState<PickedQuestions>({});
  const [dueIdx, setDueIdx] = useState(0);
  const dueLabels = DUE_PRESETS.map((p) => t(p.labelKey));
  const [note, setNote] = useState('');
  const [targetMode, setTargetMode] = useState<'all' | 'select'>('all');
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    (async () => {
      try {
        /*
         * Даалгаврын сан нь тусдаа хүсэлт: сурагчид нээлттэй контентоос
         * ЯЛГААТАЙ нөхцөлөөр татагддаг (`?assignOnly=true`), мөн багшийн
         * эрхгүй хүн дуудвал хоосон ирдэг. Хоёуланг нь нийлүүлж, сангийн
         * мөрүүд нь өөрийн шошготойгоор нэг жагсаалтад гарна.
         */
        const [lessonPage, quizPage, bankPage, roster] = await Promise.all([
          getLessons(token, { limit: CONTENT_LIMIT }),
          getQuizzes(token, { limit: CONTENT_LIMIT }),
          getAssignmentBank(token).catch(() => ({ items: [] as Quiz[] })),
          classesApi.getClassStudents(id, token),
        ]);
        setLessons(
          lessonPage.items.map((l) => ({
            id: l.id,
            title: l.title,
            group: l.level || UNGROUPED,
          })),
        );
        // Сервер санг нээлттэй жагсаалтад оруулдаггүй ч давхардлаас хамгаална.
        const bankIds = new Set(bankPage.items.map((q) => q.id));
        setQuizzes([
          ...bankPage.items,
          ...quizPage.items.filter((q) => !bankIds.has(q.id)),
        ]);
        setStudents(roster);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, id]);

  function toggleStudent(sid: string) {
    setSelectedIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  }

  // Chips are built from what actually exists, not a hardcoded level list — a
  // school that only has A1/A2 content should not see four dead chips.
  const groupChips = useMemo(() => {
    const seen = [...new Set(lessons.map((i) => i.group))].sort();
    return [
      { key: 'all', label: t('filterAll') },
      ...seen.map((g) => ({ key: g, label: g.toUpperCase() })),
    ];
  }, [lessons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons.filter(
      (i) =>
        (group === 'all' || i.group === group) &&
        (!q || i.title.toLowerCase().includes(q)),
    );
  }, [lessons, group, query]);

  // Label → item, so the picker resolves back to an id rather than a title.
  const byLabel = useMemo(
    () => new Map(filtered.map((i) => [labelOf(i), i])),
    [filtered],
  );
  const selectedLesson = selectedTitle ? byLabel.get(selectedTitle) : undefined;
  const summary = useMemo(() => countPicked(picked, quizzes), [picked, quizzes]);

  /**
   * Narrowing the list can hide whatever was already picked. Clearing the
   * selection alongside keeps the field honest — otherwise it keeps showing a
   * lesson that is no longer selectable while the Assign button sits disabled
   * with no visible reason.
   */
  function narrow(next: { group?: string; query?: string }) {
    if (next.group !== undefined) setGroup(next.group);
    if (next.query !== undefined) setQuery(next.query);
    setSelectedTitle(undefined);
  }

  function computeDueAt(): string | undefined {
    const days = DUE_PRESETS[dueIdx]?.days;
    if (!days) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  function onAssign() {
    setError(null);
    const common = {
      classId: id!,
      type,
      dueAt: computeDueAt(),
      note: note.trim() || undefined,
      studentIds: targetMode === 'select' ? selectedIds : undefined,
    };
    return assignmentsApi.createAssignment(
      type === 'lesson'
        ? { ...common, targetId: selectedLesson!.id }
        : {
            ...common,
            // Тест бүр = нэг даалгавар, өөрийн сонгосон асуултуудтай.
            targets: Object.entries(picked).map(([targetId, questionIndexes]) => ({
              targetId,
              questionIndexes,
            })),
          },
      token!,
    );
  }

  const canAssign =
    !!token &&
    !!id &&
    (type === 'lesson' ? !!selectedLesson : summary.questions > 0) &&
    (targetMode !== 'select' || selectedIds.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="h3" style={styles.topTitle}>{t('assignHomework')}</AppText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, bounded]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Type toggle */}
        <AppText variant="label" style={styles.label}>{t('assignType')}</AppText>
        <View style={styles.toggle}>
          {(['lesson', 'quiz'] as AssignmentType[]).map((tp) => {
            const active = type === tp;
            return (
              <Pressable
                key={tp}
                style={[styles.toggleBtn, active && styles.toggleOn]}
                onPress={() => setType(tp)}
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
            {type === 'lesson' ? (
              <>
                {lessons.length === 0 ? (
                  <AppText variant="caption" color={colors.textSecondary} style={styles.note}>
                    {t('noContentToAssign')}
                  </AppText>
                ) : (
                  <>
                    <TextField
                      label={t('assignSearch')}
                      placeholder={t('assignSearch')}
                      value={query}
                      onChangeText={(v) => narrow({ query: v })}
                      autoCorrect={false}
                    />
                    {/* Only worth a chip row when there is more than one group. */}
                    {groupChips.length > 2 ? (
                      <FilterChips
                        value={group}
                        options={groupChips}
                        onChange={(g) => narrow({ group: g })}
                        style={{ marginBottom: spacing.sm }}
                      />
                    ) : null}
                  </>
                )}

                {lessons.length > 0 && filtered.length === 0 ? (
                  <AppText variant="caption" color={colors.textSecondary} style={styles.note}>
                    {t('assignNoMatch')}
                  </AppText>
                ) : null}

                <SelectField
                  label={t('selectContent')}
                  placeholder={t('selectContent')}
                  value={selectedTitle}
                  options={[...byLabel.keys()]}
                  onSelect={setSelectedTitle}
                />
                {filtered.length > 0 ? (
                  <AppText
                    variant="caption"
                    color={colors.textMuted}
                    style={styles.foundCount}
                  >
                    {tf('assignFoundCount', { n: filtered.length })}
                  </AppText>
                ) : null}
              </>
            ) : (
              <>
                <AppText variant="caption" color={colors.textSecondary} style={styles.note}>
                  {t('assignPickHint')}
                </AppText>
                <QuestionPicker
                  quizzes={quizzes}
                  picked={picked}
                  onChange={setPicked}
                />
                {summary.questions > 0 ? (
                  <View style={styles.summary}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    <AppText variant="bodyStrong" color={colors.primary}>
                      {tf('assignPickedSummary', {
                        q: summary.questions,
                        t: summary.topics,
                      })}
                    </AppText>
                  </View>
                ) : null}
              </>
            )}

            <SelectField
              label={t('dueDate')}
              placeholder={t('noDueDate')}
              value={dueLabels[dueIdx]}
              options={dueLabels}
              onSelect={(label) => setDueIdx(Math.max(0, dueLabels.indexOf(label)))}
            />

            <TextField
              label={t('taskNote')}
              placeholder={t('taskNote')}
              value={note}
              onChangeText={setNote}
              multiline
            />

            {/* Assign to: whole class or a chosen subset */}
            <AppText variant="label" style={styles.label}>{t('assignTo')}</AppText>
            <View style={styles.toggle}>
              {(['all', 'select'] as const).map((m) => {
                const active = targetMode === m;
                return (
                  <Pressable
                    key={m}
                    style={[styles.toggleBtn, active && styles.toggleOn]}
                    onPress={() => setTargetMode(m)}
                  >
                    <AppText variant="bodyStrong" color={active ? colors.white : colors.textSecondary}>
                      {m === 'all' ? t('wholeClass') : t('selectStudents')}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {targetMode === 'select' ? (
              <View style={styles.roster}>
                {students.map((s) => {
                  const on = selectedIds.includes(s.id);
                  return (
                    <Pressable key={s.id} style={styles.rosterRow} onPress={() => toggleStudent(s.id)}>
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={on ? colors.primary : colors.textMuted}
                      />
                      <AppText variant="body">{s.fullName}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {error ? (
              <AppText variant="caption" color={colors.danger} style={styles.note}>
                {error}
              </AppText>
            ) : null}
            <ActionButton
              label={t('assign')}
              iconRight="arrow-forward"
              action={onAssign}
              onSuccess={() => router.back()} // class detail refetches on focus
              onError={setError}
              disabled={!canAssign}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topTitle: { flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  label: { marginBottom: spacing.xs },
  note: { marginBottom: spacing.sm },
  foundCount: { marginTop: -spacing.sm, marginBottom: spacing.sm },
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roster: { marginBottom: spacing.lg, gap: spacing.xs },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
});
