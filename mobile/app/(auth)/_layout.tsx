import { Stack } from 'expo-router';

/** Auth screens (welcome, signin, register…) — no header, smooth slide between. */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 260,
      }}
    />
  );
}
