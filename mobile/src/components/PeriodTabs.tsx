import { View, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { AppText } from './Text';
import type { TranslationKey } from '../i18n';
import { useT, useColors } from '../settings/SettingsContext';
import { colors, spacing, radius } from '../theme/theme';

/** Count pill inside the ACTIVE segment — a tint of the purple pill it sits on,
 *  so it stays readable in both themes without its own palette entry. */
const ACTIVE_COUNT_BG = 'rgba(255,255,255,0.22)';

/**
 * Segmented control — the leaderboard period switch (weekly/monthly/all-time)
 * and the saved-words section switch (lesson words / dictionary words).
 *
 * `count` is optional: pass it when the segments hold lists of different sizes
 * and the user should see how many rows sit behind each one before tapping.
 */
export function PeriodTabs<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: readonly { key: T; labelKey: TranslationKey; count?: number }[];
  onChange: (key: T) => void;
  style?: ViewStyle;
}) {
  const t = useT();
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
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <AppText variant="label" color={active ? colors.white : c.textSecondary} numberOfLines={1}>
              {t(o.labelKey)}
            </AppText>
            {o.count !== undefined ? (
              <View style={[styles.count, { backgroundColor: active ? ACTIVE_COUNT_BG : c.surface }]}>
                <AppText variant="caption" color={active ? colors.white : c.textSecondary}>
                  {o.count}
                </AppText>
              </View>
            ) : null}
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
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: { backgroundColor: colors.primary },
  count: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    alignItems: 'center',
  },
});
