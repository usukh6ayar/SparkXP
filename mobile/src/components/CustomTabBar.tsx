import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, spacing, fontSize } from "../theme/theme";

const buddy = require("../../assets/buddy-menu.png");

type IconName = keyof typeof Ionicons.glyphMap;

/** Icon (filled + outline) + label per tab route. The `chat` route is rendered
 *  as the raised center fox button instead of a normal tab. */
const TAB_META: Record<
  string,
  { icon: IconName; iconOutline: IconName; label: string }
> = {
  index: { icon: "home", iconOutline: "home-outline", label: "Нүүр" },
  lessons: { icon: "book", iconOutline: "book-outline", label: "Хичээл" },
  soril: { icon: "trophy", iconOutline: "trophy-outline", label: "Сорил" },
  profile: { icon: "person", iconOutline: "person-outline", label: "Профайл" },
};

/**
 * Custom bottom navigation matching the SparkXP design: four tabs around a
 * floating circular fox button (AI Найз) in the middle.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bar, { paddingBottom: (insets.bottom || spacing.sm) + 4 }]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Center buddy button (AI Найз / chat) — image with glow + label, no bg
        if (route.name === "chat") {
          return (
            <Pressable
              key={route.key}
              style={styles.centerWrap}
              onPress={onPress}
            >
              <Image
                source={buddy}
                style={styles.centerImg}
                resizeMode="contain"
              />
              <Text style={[styles.label, focused && styles.labelActive]}>
                AI Найз
              </Text>
            </Pressable>
          );
        }

        const meta = TAB_META[route.name];
        if (!meta) return null; // hidden routes

        return (
          <Pressable key={route.key} style={styles.tab} onPress={onPress}>
            <Ionicons
              name={focused ? meta.icon : meta.iconOutline}
              size={24}
              color={focused ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  icon: { fontSize: 22 },
  label: { fontSize: fontSize.xs, fontWeight: "700", color: colors.textMuted },
  labelActive: { color: colors.primary },
  centerWrap: { flex: 1, alignItems: "center" },
  centerImg: {
    width: 72,
    height: 72,
    marginTop: -30, // lift above the bar
    marginBottom: 0,
    // tight purple glow that hugs the circle (follows alpha on iOS)
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
