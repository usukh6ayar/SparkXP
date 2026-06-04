import { Stack } from 'expo-router';

/** Auth screens (login, register) — no header. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
