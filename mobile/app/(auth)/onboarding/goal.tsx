import { useRouter } from 'expo-router';
import {
  OnboardingChoiceScreen,
  type ChoiceOption,
} from '../../../src/components/onboarding/OnboardingChoiceScreen';
import { useOnboardingAnswers } from '../../../src/components/onboarding/OnboardingAnswersProvider';
import { ONBOARDING_TOTAL_STEPS, type LearningGoal } from '../../../src/lib/onboardingAnswers';
import { useT } from '../../../src/settings/SettingsContext';
import type { TranslationKey } from '../../../src/i18n';

/** Why the user is learning. Feeds the weekly plan mix on step 6. */
const GOALS: {
  value: LearningGoal;
  titleKey: TranslationKey;
  hintKey: TranslationKey;
  icon: ChoiceOption<LearningGoal>['icon'];
  tint: ChoiceOption<LearningGoal>['tint'];
}[] = [
  { value: 'daily', titleKey: 'onbGoalDaily', hintKey: 'onbGoalDailyHint', icon: 'chatbubbles', tint: 'purple' },
  { value: 'career', titleKey: 'onbGoalCareer', hintKey: 'onbGoalCareerHint', icon: 'briefcase', tint: 'blue' },
  { value: 'travel', titleKey: 'onbGoalTravel', hintKey: 'onbGoalTravelHint', icon: 'airplane', tint: 'teal' },
  { value: 'exam', titleKey: 'onbGoalExam', hintKey: 'onbGoalExamHint', icon: 'school', tint: 'amber' },
  { value: 'abroad', titleKey: 'onbGoalAbroad', hintKey: 'onbGoalAbroadHint', icon: 'earth', tint: 'green' },
];

/** Step 2 — what the user wants English for. */
export default function OnboardingGoal() {
  const router = useRouter();
  const { answers, update } = useOnboardingAnswers();
  // Reactive translator: labels are built during render (not at module load) so
  // they follow a language change — and so they aren't frozen to the default
  // before the saved language preference has been restored.
  const t = useT();

  const options: ChoiceOption<LearningGoal>[] = GOALS.map((g) => ({
    value: g.value,
    title: t(g.titleKey),
    subtitle: t(g.hintKey),
    icon: g.icon,
    tint: g.tint,
  }));

  return (
    <OnboardingChoiceScreen
      step={2}
      total={ONBOARDING_TOTAL_STEPS}
      onBack={() => router.back()}
      title={t('onbGoalTitle')}
      subtitle={t('onbGoalBody')}
      options={options}
      value={answers.goal}
      onChange={(goal) => update({ goal })}
      onContinue={() => router.push('/(auth)/onboarding/level')}
    />
  );
}
