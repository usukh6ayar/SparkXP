import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomTabBar } from '../../src/components/CustomTabBar';
import { tabBarHeight } from '../../src/components/tabbar/geometry';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Main tabs with the custom SparkXP bottom bar.
 * Order = tab order: Нүүр · Хичээл · [AI fox center] · Сорил · Профайл.
 */
export default function TabsLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          // Active theme bg, so nothing peeks behind the card's rounded
          // shoulders or the swell above them.
          backgroundColor: c.background,
          // The bar is an overlay and takes no layout space of its own, so the
          // screens reserve their own room for it — the SOLID card only. The
          // transparent band the buddy floats in is deliberately NOT counted:
          // padding for it would squash every screen for empty air.
          paddingBottom: tabBarHeight(insets.bottom),
        },
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
