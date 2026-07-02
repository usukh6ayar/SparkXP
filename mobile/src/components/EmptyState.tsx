import { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Button } from './Button';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';

export function EmptyState({
  icon,
  title,
  hint,
  action,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  /** Optional retry/action button rendered below the hint (e.g. "Дахин оролдох"). */
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={40} color={c.primary} />
      </View>
      <AppText variant="h3" center style={{ marginTop: spacing.md }}>{title}</AppText>
      <AppText variant="body" center color={c.textSecondary} style={{ marginTop: 2 }}>
        {hint}
      </AppText>
      {action ? (
        <Button
          label={action.label}
          icon="refresh"
          variant="secondary"
          fullWidth={false}
          onPress={action.onPress}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xxxl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: radius.full, backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
});
