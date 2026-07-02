import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { AppText } from './Text';
import { colors, spacing, radius } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/** Segmented control used for the leaderboard period switch (weekly/monthly/all-time). */
export function PeriodTabs<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: readonly { key: T; label: string }[];
  onChange: (key: T) => void;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <View style={[styles.tabs, { backgroundColor: c.surfaceAlt }, style]}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(o.key)}
          >
            <AppText variant="label" color={active ? colors.white : c.textSecondary}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderRadius: radius.full,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
});
