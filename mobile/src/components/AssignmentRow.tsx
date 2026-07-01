import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { IconTile } from './IconTile';
import { t } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing, tints, type AppColors } from '../theme/theme';
import type { AssignmentType } from '../api/assignments';

/** A class assignment row: lesson/quiz icon, resolved title, type + due date, delete or navigate. */
export function AssignmentRow({
  type,
  title,
  dueAt,
  onDelete,
  onPress,
  overdue = false,
}: {
  type: AssignmentType;
  title: string;
  dueAt: string | null;
  onDelete?: () => void;
  onPress?: () => void;
  overdue?: boolean;
}) {
  const c = useColors();
  const styles = makeStyles(c);
  const isLesson = type === 'lesson';
  const tint = isLesson ? tints.blue : tints.green;
  const due = dueAt
    ? new Date(dueAt).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })
    : t('noDueDate');

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
        <View style={styles.meta}>
          <AppText variant="caption" color={tint.fg}>{isLesson ? t('assignLesson') : t('assignQuiz')}</AppText>
          <AppText variant="caption" color={c.textMuted}>·</AppText>
          <Ionicons name="calendar-outline" size={12} color={overdue ? c.danger : c.textMuted} />
          <AppText variant="caption" color={overdue ? c.danger : undefined}>
            {overdue ? t('overdue') : due}
          </AppText>
        </View>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={c.danger} />
        </Pressable>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={c.borderStrong} />
      ) : null}
    </Row>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
