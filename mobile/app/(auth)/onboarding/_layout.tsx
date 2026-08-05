import { Stack } from 'expo-router';
import { OnboardingAnswersProvider } from '../../../src/components/onboarding/OnboardingAnswersProvider';

/**
 * The hybrid onboarding flow: welcome → goal → level → daily minutes →
 * AI-buddy demo → personalised plan → account.
 *
 * Each step is its own route so the platform back gesture / Android back button
 * work for free, and the answers live in the provider here (the layout survives
 * the pushes; the screens do not).
 */
export default function OnboardingLayout() {
  return (
    <OnboardingAnswersProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 260,
        }}
      />
    </OnboardingAnswersProvider>
  );
}
