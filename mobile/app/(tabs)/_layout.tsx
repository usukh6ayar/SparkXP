import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../src/components/CustomTabBar';
import { colors } from '../../src/theme/theme';

/**
 * Main tabs with the custom SparkXP bottom bar.
 * Order = tab order: Нүүр · Хичээл · [AI fox center] · Сорил · Профайл.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      // sceneStyle dark = no white default background peeking behind the
      // rounded top corners of the custom tab bar.
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
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
