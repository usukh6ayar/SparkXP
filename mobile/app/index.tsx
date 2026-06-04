import { Redirect } from 'expo-router';

/**
 * Entry route ("/"). Aims for the app; the auth gate in _layout bounces to
 * login if there's no valid session.
 */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
