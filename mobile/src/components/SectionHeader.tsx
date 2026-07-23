import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { spacing } from '../theme/theme';

/**
 * Standard section header: `h2` title on the left, optional "see all" action on
 * the right. Gives every section the same rhythm instead of each screen
 * restyling its own headers.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: object;
}) {
  const c = useColors();
  return (
    <View style={[styles.row, style]}>
      <AppText variant="h2" numberOfLines={1} style={styles.title}>{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <AppText variant="label" color={c.primary} numberOfLines={1}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  // flex lets a long title take the room and ellipsize instead of shoving the
  // "see all" action off-screen.
  title: { flex: 1 },
});
