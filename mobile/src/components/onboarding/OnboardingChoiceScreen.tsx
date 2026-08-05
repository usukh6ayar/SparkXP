import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStep } from './OnboardingStep';
import { OnboardingOptionCard } from './OnboardingOptionCard';
import { OnboardingFooter } from './OnboardingFooter';
import { haptics } from '../../lib/haptics';
import { track } from '../../lib/analytics';
import { spacing, type Tints } from '../../theme/theme';
import { t } from '../../i18n';

type IconName = keyof typeof Ionicons.glyphMap;

export type ChoiceOption<V extends string | number> = {
  value: V;
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Text chip shown instead of the icon — the CEFR code on the level step. */
  badge?: string;
  tint?: keyof Tints;
};

/**
 * A whole "pick one answer" onboarding step, driven by data.
 *
 * The goal / level / daily-minutes screens differ only in their copy and their
 * option list, so they share this one component instead of being three near
 * identical files. Continue stays disabled until something is selected.
 */
export function OnboardingChoiceScreen<V extends string | number>({
  step,
  total,
  onBack,
  title,
  subtitle,
  options,
  value,
  onChange,
  onContinue,
}: {
  step: number;
  total: number;
  onBack: () => void;
  title: string;
  subtitle?: string;
  options: readonly ChoiceOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  onContinue: () => void;
}) {
  function select(next: V) {
    // Selecting is the one moment of commitment on these screens — a light tap
    // confirms it landed without needing a visual re-check.
    haptics.tap();
    onChange(next);
  }

  return (
    <OnboardingStep
      step={step}
      total={total}
      onBack={onBack}
      title={title}
      subtitle={subtitle}
      footer={
        <OnboardingFooter
          label={t('continue')}
          onPress={() => {
            // One event for all three choice steps — `step` and the chosen
            // value are what turn it into a drop-off funnel.
            track('onboarding_step_completed', { step, answer: String(value) });
            onContinue();
          }}
          disabled={value === null}
        />
      }
    >
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((option) => (
          <OnboardingOptionCard
            key={String(option.value)}
            title={option.title}
            subtitle={option.subtitle}
            icon={option.icon}
            badge={option.badge}
            tint={option.tint}
            selected={value === option.value}
            onPress={() => select(option.value)}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing.md },
});
