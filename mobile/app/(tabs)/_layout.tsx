import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../src/components/CustomTabBar';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Main tabs with the custom SparkXP bottom bar.
 * Order = tab order: Нүүр · Хичээл · [AI fox center] · Сорил · Профайл.
 */
export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      // sceneStyle = active theme bg so no default background peeks behind the
      // rounded top corners of the custom tab bar.
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="lessons" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="soril" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
