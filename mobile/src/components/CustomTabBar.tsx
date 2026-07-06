import { useEffect } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, spacing, type AppColors } from "../theme/theme";
import { useSettings } from "../settings/SettingsContext";
import { haptics } from "../lib/haptics";
import { SPRING, useReduceMotion } from "../lib/motion";

const buddy = require("../../assets/buddy-menu.webp");

const GLASS_RADIUS = 32; // 28–34px rounded corners
const PURPLE = colors.primary; // #6C3BFF SparkXP accent

type IconName = keyof typeof Ionicons.glyphMap;

type TabMeta =
  | { icon: IconName; iconOutline: IconName; label: string; image?: undefined }
  | { image: number; label: string; icon?: undefined; iconOutline?: undefined };

/** Icon (filled + outline) + label per tab route. The `chat` route shows the
 *  fox AI-buddy image instead of a vector glyph. */
function tabMeta(t: (key: import("../i18n").TranslationKey) => string): Record<string, TabMeta> {
  return {
    index: { icon: "home", iconOutline: "home-outline", label: t("home") },
    lessons: { icon: "book", iconOutline: "book-outline", label: t("tabLessons") },
    chat: { image: buddy, label: t("aiBuddyShort") },
    soril: { icon: "trophy", iconOutline: "trophy-outline", label: t("quiz") },
    profile: { icon: "person", iconOutline: "person-outline", label: t("profile") },
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

  // Glass material per theme — kept white-leaning for the "liquid glass" feel.
  const glassFill = isDark ? "rgba(30,26,58,0.45)" : "rgba(255,255,255,0.42)";
  const glassBorder = isDark ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.65)";
  const sheen = isDark
    ? (["rgba(255,255,255,0.22)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0)"] as const)
    : (["rgba(255,255,255,0.75)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0)"] as const);
  const inactive = isDark ? "rgba(233,229,255,0.62)" : "rgba(60,54,90,0.55)";

  return (
    <View style={[styles.wrap, { backgroundColor: c.background, paddingBottom: insets.bottom ? insets.bottom - 4 : spacing.md }]}>
      <View style={styles.shadow}>
        <BlurView intensity={isDark ? 55 : 75} tint={isDark ? "dark" : "light"} style={styles.bar}>
          {/* Frosted white glass fill + thin glass border */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: glassFill, borderColor: glassBorder }]} />
          {/* Top light-reflection sheen (refraction highlight) */}
          <LinearGradient
            pointerEvents="none"
            colors={sheen}
            locations={[0, 0.5, 1]}
            style={[StyleSheet.absoluteFill, styles.fill]}
          />

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
                c={c}
                tint={focused ? PURPLE : inactive}
              />
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

/**
 * One tab. Split into its own component so each tab can own reanimated hooks
 * (rules-of-hooks forbid calling them inside the `.map`). The active chip
 * springs with a small "pop" the moment it becomes focused.
 */
function TabButton({
  meta,
  focused,
  onPress,
  c,
  tint,
}: {
  meta: TabMeta;
  focused: boolean;
  onPress: () => void;
  c: AppColors;
  tint: string;
}) {
  const scale = useSharedValue(1);
  const reduce = useReduceMotion();

  // Pop the chip/avatar when this tab becomes the active one.
  useEffect(() => {
    if (focused && !reduce) {
      scale.value = withSequence(withSpring(1.14, SPRING), withSpring(1, SPRING));
    }
  }, [focused, reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Center AI buddy = big fox avatar disc (raised, purple ring).
  if (meta.image) {
    return (
      <Pressable style={styles.tab} onPress={onPress}>
        <Animated.View
          style={[
            styles.foxBig,
            animatedStyle,
            { backgroundColor: c.surface, borderColor: focused ? colors.primary : "rgba(108,59,255,0.55)" },
          ]}
        >
          <Image source={meta.image} style={styles.foxBigImg} resizeMode="cover" />
        </Animated.View>
        <Text style={[styles.label, { color: tint }, focused && styles.labelActive]} numberOfLines={1}>
          {meta.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.tab} onPress={onPress}>
      {/* Active = purple glass chip; icon slightly magnified */}
      <Animated.View style={[styles.chip, focused && styles.chipActive, animatedStyle]}>
        <Ionicons name={focused ? meta.icon! : meta.iconOutline!} size={focused ? 26 : 23} color={tint} />
      </Animated.View>
      <Text style={[styles.label, { color: tint }, focused && styles.labelActive]} numberOfLines={1}>
        {meta.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Transparent outer wrapper — side margins so the capsule floats.
  wrap: { paddingHorizontal: spacing.lg, backgroundColor: "transparent" },
  // Soft drop shadow underneath (BlurView clips its own with overflow: hidden).
  shadow: {
    borderRadius: GLASS_RADIUS,
    shadowColor: "#1A1030",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: GLASS_RADIUS,
    overflow: "hidden",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  fill: { borderRadius: GLASS_RADIUS, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 2 },
  // Icon holder — grows into a purple glass chip when active.
  chip: {
    height: 34,
    minWidth: 34,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  chipActive: {
    backgroundColor: "rgba(108,59,255,0.16)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(108,59,255,0.35)",
    paddingHorizontal: 16,
  },
  label: { fontSize: 10, fontWeight: "600" },
  labelActive: { fontWeight: "700" },
  // AI buddy fox — big raised avatar disc with a purple ring + soft glow.
  foxBig: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    marginTop: -6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: PURPLE,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  foxBigImg: { width: 46, height: 46 },
});
