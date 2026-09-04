import { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../src/auth/AuthContext';
import * as assignmentsApi from '../../../../src/api/assignments';
import type { Assignment, AssignmentType } from '../../../../src/api/assignments';
import * as classesApi from '../../../../src/api/classes';
import type { ClassStudent, ClassSummary } from '../../../../src/api/classes';
import { getLessons } from '../../../../src/api/lessons';
import { getAssignmentBank, type Quiz } from '../../../../src/api/quizzes';
import { t, tf, type TranslationKey } from '../../../../src/i18n';
import { AppText } from '../../../../src/components/Text';
import { SelectField } from '../../../../src/components/SelectField';
import { TextField } from '../../../../src/components/TextField';
import { FilterChips } from '../../../../src/components/FilterChips';
import { ActionButton } from '../../../../src/components/ActionButton';
import { SelectMark } from '../../../../src/components/SelectMark';
import { EmptyState } from '../../../../src/components/EmptyState';
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

/**
 * Нэг хүсэлтэд авах мөрийн тоо. Багшийн жагсаалтад бүх контент багтах ёстой
 * (серверийн анхдагч нь ердөө 20), гэхдээ **100-аас хэтэрч болохгүй**:
 * `QueryLessonsDto.limit` дээр `@Max(100)` байгаа тул 200 гэж бичихэд сервер
 * 400 «limit must not be greater than 100» буцаадаг байв. Тэр алдаа нь
 * `Promise.all`-ийн дотор баригдалгүй унаж, дэлгэц нээмэгц «Uncaught (in
 * promise) API Error: limit …» болж гарч ирдэг байсан.
 */
const PAGE_LIMIT = 100;

/** Хамгийн ихдээ татах хуудас (500 мөр). Түүнээс цааш багш хайлтаа ашиглана. */
const MAX_PAGES = 5;

/**
 * Хуудаслаж бүгдийг татна — сервер нэг удаад `PAGE_LIMIT`-ээс илүүг өгдөггүй
 * тул «бүх контент» гэдэг нь хэд хэдэн хүсэлт гэсэн үг.
 */
async function fetchAll<T>(
  fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, total } = await fetchPage(page, PAGE_LIMIT);
    out.push(...items);
    if (items.length < PAGE_LIMIT || out.length >= total) break;
  }
  return out;
}

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
  // Багшийн ангиуд + аль нь сонгогдсон. Анхдагч нь дэлгэцийг нээсэн анги.
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classIds, setClassIds] = useState<string[]>(id ? [id] : []);
  const [targetMode, setTargetMode] = useState<'all' | 'select'>('all');
  /** `classId` → тухайн ангийн нэрс. Сонгосон анги бүрд нэг. */
  const [rosters, setRosters] = useState<Record<string, ClassStudent[]>>({});
  /**
   * «Хэнд оноох» эгнээнд аль товч идэвхтэй байна вэ.
   *
   * `targetMode`-оос **тусдаа**: «Аль ангид» руу орсон ч даалгавар бүх
   * сурагчид уу, сонгосон хэдэд үү гэдэг нь өмнөх сонголтоороо хэвээр
   * үлдэнэ (анги солих нь хэнд өгөхийг өөрчлөх ёсгүй).
   */
  const [panel, setPanel] = useState<'classes' | 'all' | 'select'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      /*
       * ⚠️ Сорил нь **зөвхөн даалгаврын сангаас** (`?assignOnly=true`) ирнэ.
       * Сурагчид нээлттэй дасгалуудыг ЗОРИУД татахаа больсон: даалгавар гэдэг
       * нь сурагч өөрөө хийж чадахгүй, зөвхөн багшаар дамжин нээгддэг зүйл
       * байх ёстой. Нээлттэй дасгалыг оноох нь тэр гэрээг эвдэнэ — сурагч
       * Дасгал табаасаа тэр дасгалыг ямар ч даалгаваргүйгээр хийчихнэ.
       *
       * Сангийн мөрүүдийг сурагчийн token-оор дуудвал сервер хоосон буцаадаг
       * (`canSeeBank`), тиймээс энэ жагсаалт багшийн эрхээр л дүүрнэ.
       */
      const [lessonItems, bankItems, mine] = await Promise.all([
        fetchAll((page, limit) => getLessons(token, { page, limit })),
        fetchAll((page, limit) => getAssignmentBank(token, { page, limit })),
        classesApi.getMyClasses(token),
      ]);
      setLessons(
        lessonItems.map((l) => ({
          id: l.id,
          title: l.title,
          group: l.level || UNGROUPED,
        })),
      );
      setQuizzes(bankItems);
      setClasses(mine.teaching);
    } catch (e) {
      /*
       * Аль нэг хүсэлт унавал өмнө нь `catch` огт байхгүй тул промис
       * баригдалгүй унаж, Expo улаан дэлгэц гаргадаг байв. Одоо дэлгэц
       * дахин оролдох боломжтой алдааны төлөвт орно.
       */
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Route-ийн анги хожуу ирвэл (эхний render дээр `id` хоосон) нөхнө. */
  useEffect(() => {
    if (id) setClassIds((prev) => (prev.length ? prev : [id]));
  }, [id]);

  /**
   * Сонгосон анги бүрийн нэрсийг татна — «Сурагч сонгох» нь олон ангид ч
   * ажиллах ёстой (сурагч бүр өөрийн ангидаа хамаарна, тиймээс нэрс нь
   * ангиараа бүлэглэгдэнэ). Аль хэдийн татсан ангийг дахин татахгүй.
   */
  useEffect(() => {
    if (!token) return;
    const missing = classIds.filter((cid) => !rosters[cid]);
    if (!missing.length) return;
    let alive = true;
    void Promise.all(
      missing.map(async (cid) => {
        try {
          return [cid, await classesApi.getClassStudents(cid, token)] as const;
        } catch {
          // Нэрс татагдахгүй бол тэр анги «Бүх сурагч» замаар л явна.
          return [cid, [] as ClassStudent[]] as const;
        }
      }),
    ).then((pairs) => {
      if (alive) setRosters((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    return () => {
      alive = false;
    };
  }, [token, classIds, rosters]);

  function toggleClass(cid: string) {
    const off = classIds.includes(cid);
    setClassIds(off ? classIds.filter((x) => x !== cid) : [...classIds, cid]);
    if (off) {
      // Ангиа хаявал түүний сурагчид сонголтод үлдэж болохгүй.
      const gone = new Set((rosters[cid] ?? []).map((st) => st.id));
      setSelectedIds((prev) => prev.filter((sid) => !gone.has(sid)));
    }
  }

  function toggleStudent(sid: string) {
    setSelectedIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid],
    );
  }

  /** Тухайн ангиас сонгогдсон сурагчид (нэрс нь ангиараа тусдаа). */
  function pickedInClass(cid: string): string[] {
    const ids = new Set(selectedIds);
    return (rosters[cid] ?? []).filter((st) => ids.has(st.id)).map((st) => st.id);
  }

  /** Ангийн толгой дээрх чагт — тэр ангийг бүхэлд нь сонгоно/цуцална. */
  function toggleClassStudents(cid: string) {
    const roster = rosters[cid] ?? [];
    const all = roster.length > 0 && pickedInClass(cid).length === roster.length;
    const ids = roster.map((st) => st.id);
    setSelectedIds((prev) =>
      all
        ? prev.filter((sid) => !ids.includes(sid))
        : [...new Set([...prev, ...ids])],
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

  /**
   * Сонгосон **анги бүрд** нэг даалгавар үүсгэнэ.
   *
   * Сервер нэг хүсэлтэд нэг л `classId` авдаг тул давталт хийж байна. Мөрүүд
   * ангиудад тусдаа үүсэх нь зөв: анги бүр өөрийн гүйцэтгэлээ хардаг ба
   * мэдэгдэл зөвхөн тухайн ангийн сурагчид руу очно.
   */
  async function onAssign() {
    setError(null);
    const base = {
      type,
      dueAt: computeDueAt(),
      note: note.trim() || undefined,
    };
    const created: Assignment[] = [];
    let doneClasses = 0;
    for (const classId of classIds) {
      /*
       * Сонгосон нэрсээс **энэ ангийнхыг** нь л явуулна — сервер
       * `studentIds`-ыг тухайн ангийн бүрэлдэхүүнтэй тулгаж шалгадаг тул
       * хөрш ангийн сурагчийн id орвол 400 болно. Энэ ангиас нэг ч сурагч
       * сонгоогүй бол тэр ангид даалгавар үүсгэх шаардлагагүй.
       */
      const studentIds =
        targetMode === 'select' ? pickedInClass(classId) : undefined;
      if (targetMode === 'select' && !studentIds?.length) continue;
      try {
        const rows = await assignmentsApi.createAssignment(
          type === 'lesson'
            ? { ...base, classId, studentIds, targetId: selectedLesson!.id }
            : {
                ...base,
                classId,
                studentIds,
                // Тест бүр = нэг даалгавар, өөрийн сонгосон асуултуудтай.
                targets: Object.entries(picked).map(([targetId, questionIndexes]) => ({
                  targetId,
                  questionIndexes,
                })),
              },
          token!,
        );
        created.push(...rows);
        doneClasses++;
      } catch (e) {
        /*
         * Хэсэгчилсэн амжилт: өмнөх ангиудад үүссэн даалгаврыг буцаах
         * боломжгүй тул хаана зогссоныг нэрээр нь хэлнэ — багш үлдсэн
         * ангиудаа дахин сонгоод явуулна.
         */
        const name = classes.find((c) => c.id === classId)?.name ?? '';
        if (doneClasses > 0) {
          throw new Error(tf('assignPartialFail', { name, n: doneClasses }));
        }
        throw e;
      }
    }
    return created;
  }

  /** «Бүх анги» мөрийн төлөв. */
  const allClassesOn =
    classes.length > 0 && classIds.length === classes.length;

  /** Эгнээний товчнууд. Ганц ангитай багшид «Аль ангид» гарахгүй. */
  const segments = (
    classes.length > 1 ? ['classes', 'all', 'select'] : ['all', 'select']
  ) as ('classes' | 'all' | 'select')[];

  function segmentLabel(seg: 'classes' | 'all' | 'select'): string {
    if (seg === 'classes') return t('assignClasses');
    return seg === 'all' ? t('allStudents') : t('selectStudents');
  }

  /** «Аль ангид» самбарын тайлбар — «Бүх анги» эсвэл сонгосон ангиудын нэр. */
  const classSummary = allClassesOn
    ? t('selectAllClasses')
    : classes
        .filter((c) => classIds.includes(c.id))
        .map((c) => c.name)
        .join(', ') || t('assignNoneChosen');

  const canAssign =
    !!token &&
    classIds.length > 0 &&
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
        ) : error && lessons.length === 0 && quizzes.length === 0 ? (
          /* Татаж чадаагүй — сонгох юу ч алга. Хоосон талбарууд харуулахын
             оронд шалтгааныг хэлээд дахин оролдох товч өгнө. */
          <EmptyState
            icon="alert-circle-outline"
            title={t('error')}
            hint={error}
            action={{ label: t('retry'), onPress: () => void load() }}
          />
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
                    {/*
                      Түвшний шүүлт. `QuestionPicker`-тэй адилаар **үргэлж**
                      харагдана (ганц түвшинтэй байсан ч): багш хичээл ба
                      сорилын аль ч табад ижил байрлалд, ижил нэртэй шүүлт
                      олох ёстой.
                    */}
                    <AppText
                      variant="label"
                      color={colors.textSecondary}
                      style={styles.label}
                    >
                      {t('levelLabel')}
                    </AppText>
                    <FilterChips
                      value={group}
                      options={groupChips}
                      onChange={(g) => narrow({ group: g })}
                      style={{ marginBottom: spacing.sm }}
                    />
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

            {/*
              Хэнд оноох вэ: сонгосон ангиудын **бүх сурагч**, эсвэл нэр
              заасан хэсэг нь. Олон анги сонгосон үед ч сурагчаа сонгож
              болно — нэрс нь ангиараа бүлэглэгдэн харагдана.
            */}
            <AppText variant="label" style={styles.label}>{t('assignTo')}</AppText>

            {/*
              Нэг эгнээнд 3 товч: аль ангид · бүх сурагч · сурагч сонгох.
              Дарсан товчны самбар нь доор задарна. «Аль ангид» нь ганцхан
              анги заадаг багшид нэмүү зүйл өгөхгүй тул харагдахгүй.
            */}
            <View style={styles.toggle}>
              {segments.map((seg) => {
                const active = panel === seg;
                return (
                  <Pressable
                    key={seg}
                    style={[styles.toggleBtn, active && styles.toggleOn]}
                    onPress={() => {
                      setPanel(seg);
                      // «Аль ангид» нь хэнд өгөхийг өөрчлөхгүй — зөвхөн самбар.
                      if (seg !== 'classes') setTargetMode(seg);
                    }}
                  >
                    <AppText
                      variant="bodyStrong"
                      color={active ? colors.white : colors.textSecondary}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {segmentLabel(seg)}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {panel === 'classes' ? (
              <>
                {/* Эвхээстэй үед ч аль анги сонгогдсоныг нэрээр нь хэлнэ. */}
                <AppText variant="caption" color={colors.textSecondary} style={styles.note}>
                  {classSummary}
                </AppText>
                <View style={styles.roster}>
                    {/*
                      «Бүх анги» нь жагсаалтын **эхний мөр** — булан дахь жижиг
                      текст холбоос байхад багш нар олдоггүй байв. Бусад мөртэй
                      ижил чагттай тул «дарж болно» гэдэг нь өөрөө харагдана.
                    */}
                    <Pressable
                      style={[
                        styles.rosterRow,
                        allClassesOn && { backgroundColor: colors.primarySoft },
                      ]}
                      onPress={() =>
                        setClassIds(allClassesOn ? [] : classes.map((c) => c.id))
                      }
                    >
                      <SelectMark
                        state={
                          classIds.length === 0
                            ? 'off'
                            : allClassesOn
                              ? 'on'
                              : 'some'
                        }
                        size={22}
                        emphasis
                      />
                      <AppText variant="bodyStrong">{t('selectAllClasses')}</AppText>
                      <AppText variant="caption" color={colors.textMuted}>
                        {tf('assignChosenCount', {
                          n: classIds.length,
                          total: classes.length,
                        })}
                      </AppText>
                    </Pressable>
                    {classes.map((c) => {
                      const on = classIds.includes(c.id);
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.rosterRow, on && { backgroundColor: colors.primarySoft }]}
                          onPress={() => toggleClass(c.id)}
                        >
                          <SelectMark state={on ? 'on' : 'off'} size={22} />
                          <AppText variant={on ? 'bodyStrong' : 'body'}>{c.name}</AppText>
                        </Pressable>
                      );
                  })}
                </View>
              </>
            ) : null}

            {classIds.length === 0 ? (
              <AppText variant="caption" color={colors.textSecondary} style={styles.note}>
                {t('assignPickClass')}
              </AppText>
            ) : panel === 'select' ? (
              <View style={styles.roster}>
                {classIds.map((cid) => {
                  const roster = rosters[cid] ?? [];
                  const klass = classes.find((c) => c.id === cid);
                  const chosen = pickedInClass(cid).length;
                  return (
                    <View key={cid}>
                      {/* Ангийн толгой — нэг дор 2 анги нээлттэй байхад
                          «энэ Болд аль ангийнх вэ» гэдгийг хэлнэ. Бүлгийн
                          чагт нь тухайн ангийг бүхэлд нь сонгоно. */}
                      {classes.length > 1 ? (
                        <Pressable
                          style={styles.groupRow}
                          onPress={() => toggleClassStudents(cid)}
                        >
                          <SelectMark
                            state={
                              chosen === 0
                                ? 'off'
                                : chosen === roster.length
                                  ? 'on'
                                  : 'some'
                            }
                            size={22}
                            emphasis
                          />
                          <AppText variant="bodyStrong">{klass?.name ?? ''}</AppText>
                          <AppText variant="caption" color={colors.textMuted}>
                            {tf('assignChosenCount', { n: chosen, total: roster.length })}
                          </AppText>
                        </Pressable>
                      ) : null}
                      {roster.map((s) => {
                        const on = selectedIds.includes(s.id);
                        return (
                          <Pressable
                            key={s.id}
                            style={[styles.rosterRow, on && { backgroundColor: colors.primarySoft }]}
                            onPress={() => toggleStudent(s.id)}
                          >
                            <SelectMark state={on ? 'on' : 'off'} size={22} />
                            <AppText variant={on ? 'bodyStrong' : 'body'}>{s.fullName}</AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/*
              «Аль ангид» самбар нээлттэй үед сурагчийн сонголт нүднээс далд
              байдаг тул товч яагаад унтарсныг эндээс хэлнэ — эс бөгөөс багш
              шалтгаангүй унтарсан товч руу ширтэнэ.
            */}
            {targetMode === 'select' && classIds.length > 0 && selectedIds.length === 0 ? (
              <AppText variant="caption" color={colors.textSecondary} style={styles.note}>
                {t('assignPickStudent')}
              </AppText>
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
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  roster: { marginBottom: spacing.lg, gap: spacing.xs },
  rosterRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 7, paddingHorizontal: spacing.sm, borderRadius: radius.md,
  },
});
