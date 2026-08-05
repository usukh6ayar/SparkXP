import { View, StyleSheet } from 'react-native';
import { AppText } from '../Text';
import { ProgressBar } from '../ProgressBar';
import { useColors } from '../../settings/SettingsContext';
import { spacing, progressGradients } from '../../theme/theme';
import { tf } from '../../i18n';

/**
 * "3 / 7" step indicator for the onboarding flow — the shared `<ProgressBar>`
 * plus the count in words.
 *
 * A track (not dots) on purpose: seven dots on a 320pt screen are smaller than
 * the eye can count, whereas a bar answers "how much is left" at a glance,
 * which is the only question a first-run user has. The glow cap is off — it
 * belongs on an earned reward bar, not on a wizard's position marker.
 */
export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  const c = useColors();

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step }}
    >
      {/* ProgressBar is width:100%, so the flex sizing goes on this wrapper. */}
      <View style={styles.bar}>
        <ProgressBar
          value={step / total}
          height={6}
          gradient={progressGradients.primary}
          track={c.surfaceAlt}
          glow={false}
        />
      </View>
      <AppText variant="caption">{tf('onbStepOf', { n: step, total })}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bar: { flex: 1 },
});
