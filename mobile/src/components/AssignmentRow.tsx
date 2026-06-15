import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { IconTile } from './IconTile';
import { t } from '../i18n';
import { colors, spacing, tints } from '../theme/theme';
import type { AssignmentType } from '../api/assignments';

/** A class assignment row: lesson/quiz icon, resolved title, due date, delete. */
export function AssignmentRow({
  type,
  title,
  dueAt,
  onDelete,
}: {
  type: AssignmentType;
  title: string;
  dueAt: string | null;
  onDelete: () => void;
}) {
  const isLesson = type === 'lesson';
  const due = dueAt
    ? new Date(dueAt).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' })
    : t('noDueDate');

  return (
    <View style={styles.row}>
      <IconTile
        icon={isLesson ? 'book' : 'help-circle'}
        bg={isLesson ? tints.blue.bg : tints.green.bg}
        fg={isLesson ? tints.blue.fg : tints.green.fg}
        size={42}
      />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        <View style={styles.meta}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <AppText variant="caption">{due}</AppText>
        </View>
      </View>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
