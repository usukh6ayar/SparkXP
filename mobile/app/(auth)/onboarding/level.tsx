import { useRouter } from 'expo-router';
import {
  OnboardingChoiceScreen,
  type ChoiceOption,
} from '../../../src/components/onboarding/OnboardingChoiceScreen';
import { useOnboardingAnswers } from '../../../src/components/onboarding/OnboardingAnswersProvider';
import { ONBOARDING_TOTAL_STEPS, type OnboardingLevel } from '../../../src/lib/onboardingAnswers';
import { CEFR_LEVELS } from '../../../src/constants/levels';
import { useT } from '../../../src/settings/SettingsContext';

/**
 * The four self-assessable levels. C1 is left out deliberately: someone at C1
 * does not need to be asked, and a five-way CEFR quiz on the third screen of a
 * first run is a wall. Registration's placement step still offers the full set.
 */
const LEVELS = CEFR_LEVELS.filter((lv) => lv.value !== 'c1');

/** Step 3 — self-assessed CEFR level, or "I don't know". */
export default function OnboardingLevelScreen() {
  const router = useRouter();
  const { answers, update } = useOnboardingAnswers();
  const t = useT();

  const options: ChoiceOption<OnboardingLevel>[] = [
    ...LEVELS.map((lv) => ({
      value: lv.value as OnboardingLevel,
      badge: lv.code,
      title: `${lv.code} — ${t(lv.labelKey)}`,
      subtitle: t(lv.descKey),
      tint: 'purple' as const,
    })),
    {
      // Stored as 'unknown', never as a CEFR value — registration must still
      // ask for a real level (see `levelForRegister`).
      value: 'unknown',
      badge: '?',
      title: t('onbLevelUnknown'),
      subtitle: t('onbLevelUnknownHint'),
      tint: 'orange',
    },
  ];

  return (
    <OnboardingChoiceScreen
      step={3}
      total={ONBOARDING_TOTAL_STEPS}
      onBack={() => router.back()}
      title={t('onbLevelTitle')}
      subtitle={t('onbLevelBody')}
      options={options}
      value={answers.level}
      onChange={(level) => update({ level })}
      onContinue={() => router.push('/(auth)/onboarding/minutes')}
    />
  );
}
