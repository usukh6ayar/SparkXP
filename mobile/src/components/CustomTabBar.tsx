import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing, radius, fontSize } from '../theme/theme';

const fox = require('../../assets/logo.png');

/** Icon + label per tab route. The `chat` route is rendered as the raised
 *  center fox button instead of a normal tab. */
const TAB_META: Record<string, { icon: string; label: string }> = {
  index: { icon: '🏠', label: 'Нүүр' },
  lessons: { icon: '📖', label: 'Хичээл' },
  soril: { icon: '🏆', label: 'Сорил' },
  profile: { icon: '👤', label: 'Профайл' },
};

/**
 * Custom bottom navigation matching the SparkXP design: four tabs around a
 * floating circular fox button (AI Найз) in the middle.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: (insets.bottom || spacing.sm) + 4 }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Center fox button (AI Найз / chat)
        if (route.name === 'chat') {
          return (
            <Pressable key={route.key} style={styles.centerWrap} onPress={onPress}>
              <View style={styles.centerBtn}>
                <Image source={fox} style={styles.fox} resizeMode="contain" />
              </View>
            </Pressable>
          );
        }

        const meta = TAB_META[route.name];
        if (!meta) return null; // hidden routes

        return (
          <Pressable key={route.key} style={styles.tab} onPress={onPress}>
            <Text style={[styles.icon, { opacity: focused ? 1 : 0.45 }]}>{meta.icon}</Text>
            <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 22 },
  label: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted },
  labelActive: { color: colors.primary },
  centerWrap: { flex: 1, alignItems: 'center' },
  centerBtn: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28, // lift above the bar
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fox: { width: 46, height: 46 },
});
