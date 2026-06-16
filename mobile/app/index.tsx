import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';

// TEMP: auth-screen preview. Set false to restore normal behaviour.
const PREVIEW_AUTH = false;

/**
 * Entry route ("/"). Picks the first destination by auth + role so we don't
 * flash the student tabs before the gate corrects a teacher. The auth gate in
 * _layout keeps everything consistent afterwards.
 */
export default function Index() {
  const { token, user, onboarded, loading } = useAuth();

  if (PREVIEW_AUTH) return <Redirect href="/(auth)/onboarding" />;
  if (loading) return null; // _layout shows the splash spinner

  if (!token) {
    return <Redirect href={onboarded ? '/(auth)/login' : '/(auth)/onboarding'} />;
  }
  return <Redirect href={user?.role === 'teacher' ? '/(teacher)' : '/(tabs)'} />;
}
