import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingProgress } from './OnboardingProgress';
import { useColors } from '../../settings/SettingsContext';
import { useOncePress } from '../../lib/useOncePress';
import { spacing, radius } from '../../theme/theme';
import { t } from '../../i18n';

/**
 * Top row of every onboarding step: back button + step progress.
 *
 * Both are optional so the first screen (welcome) can use the same shell with
 * neither — that keeps a single layout for the whole flow instead of one
 * bespoke welcome screen and six "real" ones.
 */
export function OnboardingHeader({
  step,
  total,
  onBack,
}: {
  step?: number;
  total?: number;
  onBack?: () => void;
}) {
  const c = useColors();
  const back = useOncePress(onBack ?? (() => {}));
  const showProgress = step !== undefined && total !== undefined;

  if (!onBack && !showProgress) return null;

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={back}
          // 44×44 minimum touch target with a smaller visible circle.
          hitSlop={10}
          style={({ pressed }) => [
            styles.back,
            { backgroundColor: c.surfaceAlt },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
      ) : null}

      {showProgress ? <OnboardingProgress step={step} total={total} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 44 },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
