import { Stack } from 'expo-router';

/**
 * Teacher area as a STACK: the bottom tabs are the first screen, and every
 * drill-down (new class, class detail, assign, student progress) is PUSHED on
 * top. That is what makes "back" pop one screen at a time —
 * leaderboard → student → back returns to the leaderboard, and
 * class → student → back returns to the class — instead of the old hidden-tab
 * setup where back always jumped straight to the home tab.
 *
 * Route groups in parentheses ((tabs)) are transparent to URLs, so existing
 * links keep working: `/(teacher)` still opens the tabs, and
 * `/(teacher)/class/[id]/...` still resolves to these stack screens.
 */
export default function TeacherLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="class/new" />
      <Stack.Screen name="class/[id]" />
      <Stack.Screen name="class/[id]/assign" />
      <Stack.Screen name="class/[id]/student/[studentId]" />
    </Stack>
  );
}
