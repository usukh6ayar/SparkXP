import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/theme';
import { t } from '../../src/i18n';

/**
 * Main app tabs. For now only Home; Learn / Leaderboard / Profile get added as
 * those screens are built (see MOBILE_ROADMAP.md). Headers are hidden so each
 * screen can render its own branded header.
 */
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
      <Tabs.Screen name="index" options={{ title: t('home') }} />
    </Tabs>
  );
}
