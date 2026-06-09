import { Redirect } from 'expo-router';

/** Entry route ("/") — opens the main tab screen. */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
