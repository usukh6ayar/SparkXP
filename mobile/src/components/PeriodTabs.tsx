import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { AppText } from './Text';
import type { TranslationKey } from '../i18n';
import { useT } from '../settings/SettingsContext';
import { colors, spacing, radius } from '../theme/theme';

/** Segmented control used for the leaderboard period switch (weekly/monthly/all-time). */
export function PeriodTabs<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: readonly { key: T; labelKey: TranslationKey }[];
  onChange: (key: T) => void;
  style?: ViewStyle;
}) {
  const t = useT();
  return (
    <View style={[styles.tabs, style]}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(o.key)}
          >
            <AppText variant="label" color={active ? colors.white : colors.textSecondary}>{t(o.labelKey)}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
});
