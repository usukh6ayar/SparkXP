import { ScrollView, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { colors, spacing, radius } from '../theme/theme';

/**
 * A horizontally scrolling single-select chip row.
 *
 * `PeriodTabs` covers the same idea but gives every segment `flex: 1`, so it
 * only works for 2–4 fixed options. This one scrolls, which is what a filter
 * with an open-ended option count (CEFR levels, content categories) needs.
 *
 * Labels are passed already resolved — callers mix i18n keys with values that
 * come from the database, so translating in here would only work for half of
 * them.
 */
export function FilterChips<T extends string>({
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.chip,
              { backgroundColor: active ? colors.primary : c.surfaceAlt },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <AppText
              variant="label"
              color={active ? colors.white : c.textSecondary}
              numberOfLines={1}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
});
