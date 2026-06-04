import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/theme';
import { t } from '../../src/i18n';

/**
 * Main app tabs. For M0 only Home exists; Learn / Leaderboard / Profile tabs
 * get added as those screens are built (see MOBILE_ROADMAP.md).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home') }} />
    </Tabs>
  );
}
