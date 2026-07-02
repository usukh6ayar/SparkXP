import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Teacher tab navigator — a plain bottom bar (no AI-buddy center like the
 * student tabs). Class detail / assign screens live under this group but are
 * hidden from the tab bar (pushed on top).
 */
export default function TeacherLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('teacherClasses'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Чансаа',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden from the tab bar — navigated to from the class list. */}
      <Tabs.Screen name="class/new" options={{ href: null }} />
      <Tabs.Screen name="class/[id]" options={{ href: null }} />
      <Tabs.Screen name="class/[id]/assign" options={{ href: null }} />
    </Tabs>
  );
}
