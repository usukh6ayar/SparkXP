import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../Text';
import { Button } from '../Button';
import { useColors } from '../../settings/SettingsContext';
import { useOncePress } from '../../lib/useOncePress';
import { spacing } from '../../theme/theme';

/**
 * The pinned action area at the bottom of an onboarding step: exactly ONE
 * primary button, with an optional plain-text secondary below it.
 *
 * Every press goes through `useOncePress`, so a double tap on a slow device
 * cannot push the next route twice — the flow is all navigation, so that is the
 * failure mode users actually hit.
 */
export function OnboardingFooter({
  label,
  onPress,
  disabled,
  loading,
  secondaryLabel,
  onSecondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Low-emphasis escape hatch (e.g. "Алгасах"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const c = useColors();
  const primary = useOncePress(onPress);
  const secondary = useOncePress(onSecondary ?? (() => {}));

  return (
    <View style={styles.wrap}>
      <Button label={label} onPress={primary} disabled={disabled} loading={loading} />

      {secondaryLabel && onSecondary ? (
        <Pressable
          onPress={secondary}
          hitSlop={12}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <AppText variant="bodyStrong" color={c.textMuted}>
            {secondaryLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingTop: spacing.lg },
  // 44pt tall so the tap target clears the accessibility minimum even though
  // the label itself is only ~22pt.
  secondary: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.6 },
});
