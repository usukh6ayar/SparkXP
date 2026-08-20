import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { IconTile } from './IconTile';
import { t, tf } from '../i18n';
import { dueState } from '../lib/dueDate';
import { useColors } from '../settings/SettingsContext';
import { spacing, tints } from '../theme/theme';
import type { AssignmentType } from '../api/assignments';

/** A class assignment row: lesson/quiz icon, resolved title, type + due date, delete or navigate. */
export function AssignmentRow({
  type,
  title,
  topic,
  questionCount,
  note,
  dueAt,
  onDelete,
  onPress,
  progress,
  expanded,
}: {
  type: AssignmentType;
  title: string;
  /**
   * Сорилын **сэдэв**. Багш нэг дор «Present Simple» ба «Modal verbs» хоёрын
   * даалгавар өгч болох тул энэ нь сурагч (мөн багш) хоёр мөрийг ялгах гол
   * тэмдэг — гарчиг нь ижил төстэй байж болно.
   */
  topic?: string | null;
  /** Хийх асуултын тоо — багш нэг тестээс хэсгийг нь өгсөн байж болно. */
  questionCount?: number | null;
  /** Optional teacher note shown under the title. */
  note?: string | null;
  dueAt: string | null;
  onDelete?: () => void;
  onPress?: () => void;
  /**
   * Teacher view: how many of the targeted students have handed it in. Shown as
   * a "8/12" pill so the teacher sees at a glance which task is lagging without
   * opening anything.
   */
  progress?: { done: number; total: number };
  /** Teacher view: whether the submissions list below this row is open. */
  expanded?: boolean;
}) {
  const c = useColors();
  const isLesson = type === 'lesson';
  const tint = isLesson ? tints.blue : tints.green;
  // "3 өдөр үлдлээ" beats "8-р сарын 22": the student no longer has to work out
  // how urgent it is, which is the moment homework gets forgotten.
  const due = dueState(dueAt);
  const dueColor = due.overdue ? c.danger : due.urgent ? c.warning : undefined;
  // Everyone handed it in — the one state worth colouring green, so a teacher
  // scanning the list can skip it.
  const allDone = !!progress && progress.total > 0 && progress.done >= progress.total;

  const Row = onPress ? Pressable : View;
  return (
    <Row style={styles.row} onPress={onPress}>
      <IconTile
        icon={isLesson ? 'book' : 'help-circle'}
        bg={tint.bg}
        fg={tint.fg}
        size={42}
      />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {note ? (
          <AppText variant="caption" color={c.textSecondary} numberOfLines={2}>
            {note}
          </AppText>
        ) : null}
        <View style={styles.meta}>
          <AppText variant="caption" color={tint.fg}>{isLesson ? t('assignLesson') : t('assignQuiz')}</AppText>
          {topic ? (
            <>
              <AppText variant="caption" color={c.textMuted}>·</AppText>
              <AppText variant="caption" color={c.primary}>{topic}</AppText>
            </>
          ) : null}
          {!isLesson && questionCount ? (
            <>
              <AppText variant="caption" color={c.textMuted}>·</AppText>
              <AppText variant="caption" color={c.textSecondary}>
                {tf('questionCount', { n: questionCount })}
              </AppText>
            </>
          ) : null}
          <AppText variant="caption" color={c.textMuted}>·</AppText>
          <Ionicons name="calendar-outline" size={12} color={dueColor ?? c.textMuted} />
          <AppText variant="caption" color={dueColor}>
            {due.label}
          </AppText>
          {progress ? (
            <>
              <AppText variant="caption" color={c.textMuted}>·</AppText>
              <Ionicons
                name="people-outline"
                size={12}
                color={allDone ? c.success : c.textMuted}
              />
              <AppText variant="caption" color={allDone ? c.success : undefined}>
                {progress.done}/{progress.total}
              </AppText>
            </>
          ) : null}
        </View>
      </View>
      {/* The teacher row carries both: a chevron for expanding the submissions
          list, and delete. The student row has neither and just navigates. */}
      {onPress && expanded !== undefined ? (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={c.borderStrong}
        />
      ) : null}
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={c.danger} />
        </Pressable>
      ) : onPress && expanded === undefined ? (
        <Ionicons name="chevron-forward" size={18} color={c.borderStrong} />
      ) : null}
    </Row>
  );
}

// No themed values in here, so these are plain constants — no per-render rebuild.
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
});
