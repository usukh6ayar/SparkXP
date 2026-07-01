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
      <AppText variant="h2">{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <AppText variant="label" color={c.primary}>{actionLabel}</AppText>
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
    marginBottom: spacing.md,
  },
});
