import { useRouter } from 'expo-router';
import {
  OnboardingChoiceScreen,
  type ChoiceOption,
} from '../../../src/components/onboarding/OnboardingChoiceScreen';
import { useOnboardingAnswers } from '../../../src/components/onboarding/OnboardingAnswersProvider';
import { ONBOARDING_TOTAL_STEPS, type DailyMinutes } from '../../../src/lib/onboardingAnswers';
import { useT } from '../../../src/settings/SettingsContext';
import type { TranslationKey } from '../../../src/i18n';

/**
 * Daily commitment. 10 minutes arrives pre-selected (`DEFAULT_ANSWERS`) — it is
 * the choice we recommend, and it means Continue is never dead on arrival.
 */
const CHOICES: {
  value: DailyMinutes;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  icon: ChoiceOption<DailyMinutes>['icon'];
  tint: ChoiceOption<DailyMinutes>['tint'];
}[] = [
  { value: 5, labelKey: 'onbMin5', hintKey: 'onbMin5Hint', icon: 'leaf', tint: 'green' },
  { value: 10, labelKey: 'onbMin10', hintKey: 'onbMin10Hint', icon: 'walk', tint: 'blue' },
  { value: 15, labelKey: 'onbMin15', hintKey: 'onbMin15Hint', icon: 'flame', tint: 'orange' },
  { value: 20, labelKey: 'onbMin20', hintKey: 'onbMin20Hint', icon: 'rocket', tint: 'purple' },
];

/** Step 4 — how many minutes a day. */
export default function OnboardingMinutes() {
  const router = useRouter();
  const { answers, update } = useOnboardingAnswers();
  const t = useT();

  const options: ChoiceOption<DailyMinutes>[] = CHOICES.map((choice) => ({
    value: choice.value,
    title: `${choice.value} ${t('onbMinutesUnit')} — ${t(choice.labelKey)}`,
    subtitle: t(choice.hintKey),
    icon: choice.icon,
    tint: choice.tint,
  }));

  return (
    <OnboardingChoiceScreen
      step={4}
      total={ONBOARDING_TOTAL_STEPS}
      onBack={() => router.back()}
      title={t('onbMinutesTitle')}
      subtitle={t('onbMinutesBody')}
      options={options}
      value={answers.dailyMinutes}
      onChange={(dailyMinutes) => update({ dailyMinutes })}
      onContinue={() => router.push('/(auth)/onboarding/buddy')}
    />
  );
}
