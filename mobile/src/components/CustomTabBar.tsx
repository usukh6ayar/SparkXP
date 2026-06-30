import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, spacing, fontSize, radius } from "../theme/theme";

const buddy = require("../../assets/buddy-menu.png");

type IconName = keyof typeof Ionicons.glyphMap;

/** Dark floating tab bar palette (only used here). */
const BAR_BG = "#1B1740"; // dark navy-purple pill
const RING_BG = "#221C4D"; // center disc behind the fox
const ICON_INACTIVE = "#B8B2E0"; // soft lavender-gray
const ICON_ACTIVE = "#FFFFFF";

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
 * Custom bottom navigation matching the SparkXP design: a dark floating pill
 * with four light tabs around a glowing circular fox button (AI Найз) that
 * pops up out of the center. The active tab gets a short underline.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // The lessons tab is a dark full-screen map, so fill the bar's safe-area gap
  // dark there — otherwise the app's light background shows as a white strip
  // around the icons. Other (light-themed) tabs keep the transparent wrap.
  const darkBottom = state.routes[state.index]?.name === "lessons";

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: insets.bottom || spacing.sm },
        darkBottom && styles.wrapDark,
      ]}
    >
      <View style={styles.bar}>
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

          // Center buddy button (AI Найз / chat) — fox in a glowing ring.
          if (route.name === "chat") {
            return (
              <Pressable
                key={route.key}
                style={styles.centerWrap}
                onPress={onPress}
              >
                <View style={styles.ring}>
                  <Image
                    source={buddy}
                    style={styles.centerImg}
                    resizeMode="contain"
                  />
                </View>
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
                color={focused ? ICON_ACTIVE : ICON_INACTIVE}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>
                {meta.label}
              </Text>
              {focused && <View style={styles.underline} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent outer wrapper so the bar floats over the screen background.
  wrap: {
    paddingHorizontal: spacing.lg,
    backgroundColor: "transparent",
  },
  // Dark fill for the lessons tab so no white strip shows under the bar.
  wrapDark: { backgroundColor: "#0E0A2A" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BAR_BG,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    // soft purple glow under the floating pill
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  label: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: ICON_INACTIVE,
  },
  labelActive: { color: ICON_ACTIVE },
  // short rounded indicator under the active tab
  underline: {
    position: "absolute",
    bottom: -6,
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: ICON_ACTIVE,
  },
  centerWrap: { flex: 1, alignItems: "center" },
  // glowing circular ring that holds the fox and lifts it above the bar
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginTop: -38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: RING_BG,
    borderWidth: 2,
    borderColor: colors.primary,
    // tight purple glow that hugs the ring
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  centerImg: {
    width: 64,
    height: 64,
  },
});
