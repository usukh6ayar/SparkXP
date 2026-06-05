import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Нүүр',    tabBarIcon: () => null }} />
      <Tabs.Screen name="chat"    options={{ title: 'AI Найз', tabBarIcon: () => null }} />
      <Tabs.Screen name="profile" options={{ title: 'Профайл', tabBarIcon: () => null }} />
    </Tabs>
  );
}
