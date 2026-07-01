import { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';

export function EmptyState({
  icon,
  title,
  hint,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
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
