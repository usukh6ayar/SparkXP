import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/AuthContext";
import { getStats } from "../../src/api/users";
import { getGamification, type Gamification } from "../../src/api/gamification";
import { getDue } from "../../src/api/reviews";
import { getLessons } from "../../src/api/lessons";
import { getLastLesson, type LastLesson } from "../../src/lib/lastLesson";
import { useDictionary } from "../../src/components/DictionaryProvider";
import { AppText } from "../../src/components/Text";
import { ProgressBar } from "../../src/components/ProgressBar";
import {
  colors,
  spacing,
  radius,
  tints,
  elevation,
} from "../../src/theme/theme";

type IconName = keyof typeof Ionicons.glyphMap;

// Hero = two layers only: an on-brand purple night-sky background, and the fox
// pre-composited onto the island as ONE image. Baking the fox + island together
// means the fox is ALWAYS standing on the grass on every device — no per-screen
// alignment math to drift. Both layers scale to the screen width ("flexible").
const skyImg = require("../../assets/hero-sky.png");
const sceneImg = require("../../assets/fox-island.png");

const SCENE_RATIO = 1081 / 963; // h / w of fox-island.png
const GRASS = 0.6; // grass surface ≈ 60% down the composite (where feet rest)

const { width: SCREEN_W } = Dimensions.get("window");

// Space reserved at the top for the greeting + badges, so the fox is parked
// BELOW the header and never covers the user's name. (Tune for header height.)
const HEADER_RESERVE = 106;

// The fox+island scene spans the full width and sits just under the header.
const SCENE_W = SCREEN_W;
const SCENE_H = Math.round(SCENE_W * SCENE_RATIO);
const SCENE_TOP = HEADER_RESERVE;
const GRASS_Y = Math.round(SCENE_TOP + GRASS * SCENE_H);

// Band ends below the grass; the island's dangling base is tucked behind the
// body content, which is pulled up via BODY_OVERLAP so the first card sits just
// under the island — the "island behind the cards" depth look.
const HERO_H = Math.round(GRASS_Y + SCENE_H * 0.12);
const BODY_OVERLAP = Math.round(SCENE_H * 0.08);

// Translucent dark pill used for the hero overlay badges.
const HERO_PILL = "rgba(18,10,40,0.45)";

// "Өнөөдрийн даалгавар" tiles. Tapping stays inside Home (no navigation yet);
// the `completed`/`total` counts are placeholders — real per-task data comes later.
const TASKS: {
  key: string;
  label: string;
  icon: IconName;
  tint: { bg: string; fg: string };
  completed: number;
  total: number;
}[] = [
  { key: "fill", label: "Нөхөх", icon: "create", tint: tints.green, completed: 1, total: 1 },
  { key: "reading", label: "Унших", icon: "reader", tint: tints.blue, completed: 1, total: 1 },
  { key: "listening", label: "Сонсох", icon: "headset", tint: tints.purple, completed: 1, total: 1 },
  { key: "speaking", label: "Ярих", icon: "mic", tint: tints.coral, completed: 0, total: 1 },
];

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { openSearch } = useDictionary();
  const firstName =
    user?.englishName?.trim() || (user?.fullName?.split(" ")[0] ?? "");

  const [xp, setXp] = useState(user?.xp ?? 0);
  const [sparks, setSparks] = useState(user?.sparks ?? 0);
  const [due, setDue] = useState(0);
  const [cont, setCont] = useState<{ lesson: LastLesson; resume: boolean } | null>(null);
  const [gam, setGam] = useState<Gamification | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [stats, dueList, gamification] = await Promise.all([
        getStats(token),
        getDue(token),
        getGamification(token).catch(() => null),
      ]);
      setXp(stats.xp);
      setSparks(stats.sparks);
      setDue(dueList.length);
      if (gamification) setGam(gamification);
    } catch {
      // keep last values
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // "Continue learning": the last opened lesson, else the first lesson.
  const loadContinue = useCallback(async () => {
    if (!token) return;
    const last = await getLastLesson();
    if (last) {
      setCont({ lesson: last, resume: true });
      return;
    }
    try {
      const r = await getLessons(token);
      const f = r.items[0];
      setCont(
        f
          ? { lesson: { id: f.id, title: f.title, thumbnailUrl: f.thumbnailUrl, type: f.type, level: f.level }, resume: false }
          : null,
      );
    } catch {
      // ignore
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadContinue();
    }, [loadContinue]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const streak = gam?.currentStreak ?? 0;
  // TODO(data): real per-lesson progress — visual placeholder for now.
  const continueProgress = 0.75;
  const doneCount = TASKS.filter((t) => t.completed >= t.total).length;

  return (
    <View style={styles.root}>
      {/* Solid page background (#191040). The hero below dissolves into this
          exact color, so there is no seam between the fox scene and the page. */}
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Top: fox scene as a full-bleed background — greeting + streak/gem/XP
            overlaid, fading into the page background (no boxed hero card). */}
        <View style={styles.top}>
          {/* Fallback purple sky while the image loads */}
          <LinearGradient
            colors={["#1B1147", "#2A1A5E"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Layer 1 — purple night sky (glow + stars) */}
          <Image source={skyImg} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Bottom scrim — dissolves the sky into the page (#191040) at the
              band's edges (sides of the cards, below the island). */}
          <LinearGradient
            colors={["rgba(25,16,64,0)", "rgba(25,16,64,0)", "rgba(25,16,64,1)"]}
            locations={[0, 0.72, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Top scrim — light dark veil so the header text stays legible */}
          <LinearGradient
            colors={["rgba(25,16,64,0.5)", "rgba(25,16,64,0)"]}
            locations={[0, 0.42]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Layer 2 — fox baked onto the island (always aligned), above the
              scrims so the whole scene stays bright. */}
          <Image source={sceneImg} style={styles.scene} resizeMode="contain" />
          <SafeAreaView edges={["top"]} style={styles.topInner}>
            {/* Header: greeting + notification / search */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <AppText variant="h1">Сайн уу, {firstName} 👋</AppText>
                <AppText
                  variant="body"
                  color={colors.textSecondary}
                  style={styles.sub}
                >
                  Өнөөдөр шинэ зүйл сурч, өөрийгөө ахиулцгаая! ✨
                </AppText>
              </View>
              <View style={styles.headerIcons}>
                {/* TODO: notifications screen */}
                <IconBtn icon="notifications-outline" onPress={() => {}} />
                {/* Dictionary — in-place search overlay (no screen change) */}
                <IconBtn icon="search" onPress={openSearch} />
              </View>
            </View>

            {/* Streak / gem / XP badges over the scene */}
            <View style={styles.heroTop}>
              <View style={styles.streakBadge}>
                <Ionicons name="flame" size={25} color={colors.streak} />
                <AppText variant="h2" color={colors.white}>{streak}</AppText>
                <View>
                  <AppText variant="caption" color={colors.textOnDark}>
                    Өдөр дараалал
                  </AppText>
                  <AppText variant="caption" color={colors.textOnDarkMuted}>
                    Keep going!
                  </AppText>
                </View>
              </View>
              <View style={styles.heroPillCol}>
                <View style={styles.heroPill}>
                  <Ionicons name="diamond" size={25} color={colors.sparks} />
                  <AppText variant="label" color={colors.white}>
                    {sparks} Очирхон
                  </AppText>
                </View>
                <View style={styles.heroPill}>
                  <Ionicons name="flash" size={25} color={colors.xp} />
                  <AppText variant="label" color={colors.white}>
                    {xp.toLocaleString()} XP
                  </AppText>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Body content (padded; the hero above is full-bleed) */}
        <View style={styles.body}>
          {/* Continue learning */}
          {cont ? (
            <Pressable
              style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
              onPress={() => router.push(`/lesson/${cont.lesson.id}`)}
            >
              <LinearGradient
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.continueBody}>
                <AppText variant="overline" color={colors.textOnDarkMuted}>
                  {cont.resume ? "ҮРГЭЛЖЛҮҮЛЖ СУРАХ" : "СУРАЛЦАЖ ЭХЛЭХ"}
                </AppText>
                <AppText variant="h2" color={colors.white} numberOfLines={1}>
                  {cont.lesson.title}
                </AppText>
                <View style={styles.progressRow}>
                  <AppText variant="caption" color={colors.textOnDark}>
                    {Math.round(continueProgress * 100)}%
                  </AppText>
                  <ProgressBar
                    value={continueProgress}
                    color={colors.white}
                    track="rgba(255,255,255,0.25)"
                    height={8}
                    style={styles.continueBarInline}
                  />
                </View>
                <View style={styles.continueBtn}>
                  <AppText variant="bodyStrong" color={colors.primary}>
                    Үргэлжлүүлэх →
                  </AppText>
                </View>
              </View>
              <View style={styles.continueIcon}>
                <AppText variant="display" color={colors.white}>Aa</AppText>
              </View>
            </Pressable>
          ) : null}

          {/* Review reminder */}
          <View style={styles.reviewCard}>
            <View style={styles.reviewIcon}>
              <Ionicons name="time" size={24} color={colors.primary} />
            </View>
            <View style={styles.reviewBody}>
              <AppText variant="h3">Давтах үгс</AppText>
              <AppText variant="caption" style={styles.reviewSub}>
                {due > 0
                  ? `${due} үг давтах хугацаатай байна`
                  : "Өнөөдөр давтах үг алга"}
              </AppText>
              <Pressable
                style={({ pressed }) => [
                  styles.reviewBtn,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push("/swipe")}
              >
                <AppText variant="bodyStrong" color={colors.white}>
                  Давтах эхлэх
                </AppText>
              </Pressable>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.borderStrong}
            />
          </View>

          {/* My assignments */}
          <Pressable
            style={({ pressed }) => [styles.joinCard, pressed && styles.pressed]}
            onPress={() => router.push("/assignments")}
          >
            <View style={[styles.joinIcon, { backgroundColor: tints.green.bg }]}>
              <Ionicons name="clipboard" size={22} color={tints.green.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">Миний даалгаврууд</AppText>
              <AppText variant="caption">Багшийн оноосон хичээл, сорил</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
          </Pressable>

          {/* Today's tasks — stays inside Home (no navigation yet) */}
          <View style={styles.sectionRow}>
            <AppText variant="h2">Өнөөдрийн даалгавар</AppText>
            <View style={styles.countPill}>
              <AppText variant="label" color={colors.textSecondary}>
                {doneCount}/{TASKS.length}
              </AppText>
            </View>
          </View>
          <View style={styles.grid}>
            {TASKS.map((t) => (
              <Pressable
                key={t.key}
                style={({ pressed }) => [styles.task, pressed && styles.pressed]}
                // TODO: open in-home task view + real data
                onPress={() => {}}
              >
                <View style={[styles.taskIcon, { backgroundColor: t.tint.bg }]}>
                  <Ionicons name={t.icon} size={22} color={t.tint.fg} />
                </View>
                <AppText variant="label" numberOfLines={1}>
                  {t.label}
                </AppText>
                <View style={styles.taskCount}>
                  <Ionicons name="ribbon" size={12} color={colors.xp} />
                  <AppText variant="caption">
                    {t.completed}/{t.total}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>

          <View style={{ height: 110 }} />
        </View>
      </ScrollView>
    </View>
  );
}

function IconBtn({ icon, onPress }: { icon: IconName; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { paddingTop: 0 },

  // Full-bleed top: the layered fox scene reads as the screen background.
  top: { height: HERO_H, width: "100%", overflow: "hidden" },
  // Fox-on-island composite — full-width, parked below the header.
  scene: {
    position: "absolute",
    width: SCENE_W,
    height: SCENE_H,
    left: (SCREEN_W - SCENE_W) / 2,
    top: SCENE_TOP,
  },
  // Header + badges stack near the top; the fox fills the space below them.
  topInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  // Everything below the hero keeps the normal screen gutter. It is pulled up
  // over the hero's faded bottom (zIndex above it) so the first cards sit in
  // front of the floating island's lower rocks.
  body: {
    paddingHorizontal: spacing.lg,
    marginTop: -BODY_OVERLAP,
    zIndex: 1,
  },

  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headerText: { flex: 1, paddingTop: 2 },
  sub: { marginTop: 4 },
  headerIcons: { flexDirection: "row", gap: spacing.sm },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...(elevation.sm as object),
  },

  // Hero overlay badges
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: HERO_PILL,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroPillCol: { gap: spacing.sm, alignItems: "flex-end" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: HERO_PILL,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },

  // Continue learning
  continueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
    overflow: "hidden",
    padding: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    ...(elevation.md as object),
  },
  continueBody: { flex: 1, gap: 2 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  continueBarInline: { flex: 1 },
  continueBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  continueIcon: {
    width: 60,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Review reminder
  reviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...(elevation.sm as object),
  },
  reviewIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBody: { flex: 1, gap: 4 },
  reviewSub: { marginBottom: spacing.sm },
  reviewBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
  },

  // My assignments
  joinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...(elevation.sm as object),
  },
  joinIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  // Today's tasks
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  countPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
  },
  task: {
    width: "23%",
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface, // dark tile so the colored icon chip pops
    ...(elevation.sm as object),
  },
  taskIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  taskCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
