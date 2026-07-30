import { View, Pressable, Image, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, spacing } from "../theme/theme";
import { useSettings } from "../settings/SettingsContext";
import { appIcons } from "../constants/appIcons";
import { haptics } from "../lib/haptics";
import { SPRING, useReduceMotion } from "../lib/motion";
import { BuddyTabButton } from "./BuddyTabButton";

const buddy = require("../../assets/buddy-menu.webp");

const PURPLE = colors.primary; // #6C3BFF SparkXP accent

type IconName = keyof typeof Ionicons.glyphMap;

type TabMeta =
  | { icon: IconName; iconOutline: IconName; label: string; image?: undefined; png?: undefined }
  | { image: number; label: string; icon?: undefined; iconOutline?: undefined; png?: undefined }
  | { png: number; label: string; icon?: undefined; iconOutline?: undefined; image?: undefined };

/** Icon + label per tab route. Most tabs use a brand 3D PNG icon (appIcons);
 *  `chat` shows the fox AI-buddy image. */
function tabMeta(t: (key: import("../i18n").TranslationKey) => string): Record<string, TabMeta> {
  return {
    index: { png: appIcons.home, label: t("home") },
    lessons: { png: appIcons.reading, label: t("tabLessons") },
    chat: { image: buddy, label: t("aiBuddyShort") },
    soril: { png: appIcons.trophy, label: t("quiz") },
    profile: { png: appIcons.profile, label: t("profile") },
  };
}

/**
 * Liquid-Glass bottom navigation (inspired by Apple's design, not a copy):
 * a floating frosted-glass capsule with a strong background blur, a translucent
 * white glass overlay, a soft top light-reflection sheen, a thin glass border
 * and a soft drop shadow. The active tab sits in a purple glass chip and its
 * icon is slightly magnified. Adapts to light/dark theme.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme, colors: c, t } = useSettings();
  const isDark = theme === "dark";
  const TAB_META = tabMeta(t);

  const inactive = isDark ? "rgba(233,229,255,0.62)" : "rgba(60,54,90,0.55)";

  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      {/* Solid bar — same background as the screen, with a top border. */}
      <View
        style={[styles.bar, { backgroundColor: c.background, paddingBottom: insets.bottom || spacing.sm, borderTopColor: c.border }]}
      >
          {state.routes.map((route, index) => {
            const meta = TAB_META[route.name];
            if (!meta) return null; // hidden routes

            const focused = state.index === index;
            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                haptics.select(); // tactile tick when switching tabs
                navigation.navigate(route.name);
              }
            };

            return (
              <TabButton
                key={route.key}
                meta={meta}
                focused={focused}
                onPress={onPress}
                tint={focused ? PURPLE : inactive}
              />
            );
          })}
      </View>
    </View>
  );
}

/**
 * One tab (icon-only — no labels). Split into its own component so each tab can
 * own reanimated hooks (rules-of-hooks forbid calling them inside the `.map`).
 * When focused the chip pops, then settles slightly magnified and lifted, and
 * lights up as a soft purple glowing pill. `meta.label` is kept only for the
 * screen-reader accessibility label since there's no visible text.
 */
function TabButton({
  meta,
  focused,
  onPress,
  tint,
}: {
  meta: TabMeta;
  focused: boolean;
  onPress: () => void;
  tint: string;
}) {
  const scale = useSharedValue(1);
  const reduce = useReduceMotion();

  // No size change on selection — only a small press-down shrink for feedback.
  const onPressIn = () => { if (!reduce) scale.value = withSpring(0.9, SPRING); };
  const onPressOut = () => { scale.value = withSpring(1, SPRING); };

  const chipStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const a11y = {
    accessibilityRole: "button" as const,
    accessibilityLabel: meta.label,
    accessibilityState: { selected: focused },
  };

  // Center AI buddy = the galaxy button (own component: it owns its orbit,
  // nebula and burst animations, which nothing else in the bar needs).
  if (meta.image) {
    return <BuddyTabButton image={meta.image} label={meta.label} focused={focused} onPress={onPress} />;
  }

  // Brand 3D PNG icon (home/lessons/soril/profile). PNGs are full-colour so they
  // aren't tinted; the active glowing pill + magnify + lift signal focus.
  if (meta.png) {
    return (
      <Pressable style={styles.tab} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} {...a11y}>
        <Animated.View style={[styles.chip, focused && styles.chipActive, chipStyle]}>
          <Image
            source={meta.png}
            style={[styles.pngIcon, !focused && styles.pngIconInactive]}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.tab} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} {...a11y}>
      <Animated.View style={[styles.chip, focused && styles.chipActive, chipStyle]}>
        <Ionicons name={focused ? meta.icon! : meta.iconOutline!} size={28} color={tint} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full-width flat bar (Duolingo-style) — no side margins, no float, no radius.
  wrap: { backgroundColor: "transparent" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    // NOT clipped: the buddy galaxy's ring, halo and stars deliberately spill
    // past the bar's top edge. `hidden` here (left over from the old floating
    // capsule) would slice them off flat.
    borderTopWidth: StyleSheet.hairlineWidth, // thin divider above the bar
    paddingTop: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  // Brand 3D PNG tab icon — a touch larger than the vector glyphs since the 3D
  // art carries transparent padding, so it reads smaller at the same box size.
  pngIcon: { width: 40, height: 40 },
  pngIconInactive: { opacity: 0.6 },
  // Icon holder — a rounded-square box (Duolingo-style). The 2px transparent
  // border is reserved so the active border doesn't shift the layout.
  chip: {
    height: 48,
    minWidth: 54,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  // Active tab — Duolingo's selected box: a purple outline + light purple fill.
  chipActive: {
    backgroundColor: "rgba(108,59,255,0.14)",
    borderColor: PURPLE,
  },
});
