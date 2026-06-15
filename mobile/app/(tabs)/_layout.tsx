import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../src/components/CustomTabBar';

/**
 * Main tabs with the custom SparkXP bottom bar.
 * Order = tab order: Нүүр · Хичээл · [AI fox center] · Сорил · Профайл.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="lessons" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="soril" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
