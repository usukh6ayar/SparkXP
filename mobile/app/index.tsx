import { Redirect } from 'expo-router';

// TEMP: auth-screen preview. Set false to restore normal behaviour.
const PREVIEW_AUTH = false;

/**
 * Entry route ("/"). Aims for the app; the auth gate in _layout bounces to
 * login if there's no valid session.
 */
export default function Index() {
  if (PREVIEW_AUTH) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
