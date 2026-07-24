import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../../src/i18n';
import { useColors } from '../../../src/settings/SettingsContext';
import { AppIcon } from '../../../src/components/AppIcon';
import type { AppIconName } from '../../../src/constants/appIcons';
import { colors as theme } from '../../../src/theme/theme';

/**
 * Teacher bottom tabs — classes / rankings / profile. A plain bar (no AI-buddy
 * center like the student tabs). The class → student drill-down screens are NOT
 * here: they live in the parent (teacher) Stack and are pushed on top, so "back"
 * pops one screen at a time (leaderboard→student→back returns to leaderboard,
 * class→student→back returns to the class) instead of jumping to home.
 *
 * Uses the same brand 3D PNG icons (appIcons) as the student tab bar so the two
 * roles look consistent. The active tab sits in the same purple "chip" as
 * CustomTabBar, and inactive icons dim to 0.6 opacity.
 */
function BrandTabIcon({ name, focused }: { name: AppIconName; focused: boolean }) {
  return (
    <View style={[styles.chip, focused && styles.chipActive]}>
      {/* Fixed 40px to exactly match the student CustomTabBar's pngIcon size, so
          the low-res 3D PNGs render identically (and stay as crisp as they do in
          the student tab bar). */}
      <AppIcon name={name} size={40} style={!focused ? styles.iconInactive : undefined} />
    </View>
  );
}

export default function TeacherTabsLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      // Retrace visit history so switching tabs then pressing Android back steps
      // up one tab at a time instead of jumping straight to the first tab.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Icon-only, like the student CustomTabBar (no text labels).
        tabBarShowLabel: false,
        // Taller bar so the 48px active chip fits fully (default height clips its
        // rounded purple frame). Safe-area bottom kept as padding.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom || 8,
        },
        tabBarIconStyle: { flex: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('teacherClasses'),
          tabBarIcon: ({ focused }) => (
            <BrandTabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('rankingsTab'),
          tabBarIcon: ({ focused }) => (
            <BrandTabIcon name="trophy" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ focused }) => (
            <BrandTabIcon name="profile" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

// Active-tab chip — copied from the student CustomTabBar so both roles match:
// a rounded-square box with a light-purple fill + purple border when focused.
// The 2px transparent border is reserved so the active border doesn't shift the
// icon.
const styles = StyleSheet.create({
  chip: {
    height: 48,
    minWidth: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  chipActive: {
    backgroundColor: 'rgba(108,59,255,0.14)',
    borderColor: theme.primary,
  },
  iconInactive: { opacity: 0.6 },
});
