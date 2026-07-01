import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, spacing } from "../theme/theme";
import { useSettings } from "../settings/SettingsContext";

const buddy = require("../../assets/buddy-menu.png");

const GLASS_RADIUS = 32; // 28–34px rounded corners
const PURPLE = colors.primary; // #6C3BFF SparkXP accent

type IconName = keyof typeof Ionicons.glyphMap;

type TabMeta =
  | { icon: IconName; iconOutline: IconName; label: string; image?: undefined }
  | { image: number; label: string; icon?: undefined; iconOutline?: undefined };

/** Icon (filled + outline) + label per tab route. The `chat` route shows the
 *  fox AI-buddy image instead of a vector glyph. */
const TAB_META: Record<string, TabMeta> = {
  index: { icon: "home", iconOutline: "home-outline", label: "Нүүр" },
  lessons: { icon: "book", iconOutline: "book-outline", label: "Хичээл" },
  chat: { image: buddy, label: "AI Найз" },
  soril: { icon: "trophy", iconOutline: "trophy-outline", label: "Сорил" },
  profile: { icon: "person", iconOutline: "person-outline", label: "Профайл" },
};

/**
 * Liquid-Glass bottom navigation (inspired by Apple's design, not a copy):
 * a floating frosted-glass capsule with a strong background blur, a translucent
 * white glass overlay, a soft top light-reflection sheen, a thin glass border
 * and a soft drop shadow. The active tab sits in a purple glass chip and its
 * icon is slightly magnified. Adapts to light/dark theme.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme, colors: c } = useSettings();
  const isDark = theme === "dark";

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
            const tint = focused ? PURPLE : inactive;
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

            // Center AI buddy = big fox avatar disc (raised, purple ring).
            if (meta.image) {
              return (
                <Pressable key={route.key} style={styles.tab} onPress={onPress}>
                  <View
                    style={[
                      styles.foxBig,
                      { backgroundColor: c.surface, borderColor: focused ? PURPLE : "rgba(108,59,255,0.55)" },
                    ]}
                  >
                    <Image source={meta.image} style={styles.foxBigImg} resizeMode="cover" />
                  </View>
                  <Text style={[styles.label, { color: tint }, focused && styles.labelActive]} numberOfLines={1}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            }

            return (
              <Pressable key={route.key} style={styles.tab} onPress={onPress}>
                {/* Active = purple glass chip; icon slightly magnified */}
                <View style={[styles.chip, focused && styles.chipActive]}>
                  <Ionicons name={focused ? meta.icon! : meta.iconOutline!} size={focused ? 26 : 23} color={tint} />
                </View>
                <Text style={[styles.label, { color: tint }, focused && styles.labelActive]} numberOfLines={1}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </BlurView>
      </View>
    </View>
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
