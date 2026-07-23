import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Dimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/AuthContext";
import { getStats } from "../../src/api/users";
import { getGamification, type Gamification } from "../../src/api/gamification";
import { getDue } from "../../src/api/reviews";
import { getContinue } from "../../src/api/lessons";
import { getExercises } from "../../src/api/quizzes";
import { getReadingList } from "../../src/api/reading";
import { getMyClasses } from "../../src/api/classes";
import { getLastLesson, type LastLesson } from "../../src/lib/lastLesson";
import { useUnreadNotifications } from "../../src/lib/useUnreadNotifications";
import { useDictionary } from "../../src/components/DictionaryProvider";
import { AppText } from "../../src/components/Text";
import { AppImage } from "../../src/components/AppImage";
import { AppIcon } from "../../src/components/AppIcon";
import { type AppIconName } from "../../src/constants/appIcons";
import { IconButton } from "../../src/components/IconButton";
import { Button } from "../../src/components/Button";
import { Skeleton } from "../../src/components/Skeleton";
import { ProgressBar } from "../../src/components/ProgressBar";
import { useColors, useSettings } from "../../src/settings/SettingsContext";
import { useReduceMotion } from "../../src/lib/motion";
import { haptics } from "../../src/lib/haptics";
import { tf, type TranslationKey } from "../../src/i18n";
import {
  spacing,
  radius,
  tints,
  elevation,
  type AppColors,
} from "../../src/theme/theme";
import { bounded } from '../../src/theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;

// Hero = two layers only: an on-brand purple night-sky background, and the fox
// pre-composited onto the island as ONE image. Baking the fox + island together
// means the fox is ALWAYS standing on the grass on every device — no per-screen
// alignment math to drift. Both layers scale to the screen width ("flexible").
const skyImg = require("../../assets/background.webp");
// Light-mode sky — bright daytime clouds instead of the purple night sky.
const skyImgLight = require("../../assets/light-mode-index.webp");
const sceneImg = require("../../assets/fox-island.webp");

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

// "Өнөөдрийн даалгавар" tiles → the 4 Дасгал skill categories. Each tile opens
// the matching skill screen (/skill/<key>), which lists that category's
// standalone exercises (quizzes with standalone=true) from the SAME database
// admins author them in. `key` must match the backend quiz `category`
// (listening/reading/writing/speaking). The per-tile count is fetched live.
const TASKS: {
  key: string;
  labelKey: TranslationKey;
  icon: IconName;
  // Brand 3D icon when one exists (speaking has no PNG → falls back to `icon`).
  appIcon?: AppIconName;
  tint: { bg: string; fg: string };
}[] = [
  { key: "reading", labelKey: "catReading", icon: "book", appIcon: "reading", tint: tints.green },
  { key: "listening", labelKey: "catListening", icon: "headset", appIcon: "listening", tint: tints.blue },
  { key: "speaking", labelKey: "catSpeaking", icon: "mic", appIcon: "speaking", tint: tints.pink },
  { key: "writing", labelKey: "catWriting", icon: "create", appIcon: "writing", tint: tints.orange },
];

/**
 * Streak flame that gently pulses (scale) while the streak is alive, so the
 * hero feels "on fire" instead of static. Freezes when streak is 0 or the user
 * has Reduce Motion enabled.
 */
function StreakFlame({ streak }: { streak: number }) {
  const scale = useSharedValue(1);
  const reduce = useReduceMotion();

  useEffect(() => {
    if (streak > 0 && !reduce) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 650 }),
          withTiming(1, { duration: 650 }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1);
    }
  }, [streak, reduce]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <AppIcon name="streak" size={32} />
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { user, token } = useAuth();
  const c = useColors();
  const { theme, t } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduceMotion = useReduceMotion();

  // Hero swaps with the appearance toggle: bright daytime sky in light mode,
  // purple night sky in dark. The bottom scrim dissolves the sky into the
  // active page background (`c.background`) so there is no seam either way.
  const lightMode = theme === "light";
  const skySource = lightMode ? skyImgLight : skyImg;
  // RGB of the page background, used to build the fade-to-page gradient stops.
  const pageRgb = lightMode ? "244,242,252" : "25,16,64";
  // Colour of the sky at the very top of the hero (sky image top + the dark top
  // scrim). Fills the pull-to-refresh overscroll so it reads as more sky instead
  // of a white gap — the hero looks "locked" while a spinner shows (Instagram-style).
  const overscrollColor = lightMode ? "#294C98" : "#0C082D";
  const router = useRouter();
  const { openSearch } = useDictionary();
  const hasUnread = useUnreadNotifications();
  const firstName =
    user?.englishName?.trim() || (user?.fullName?.split(" ")[0] ?? "");

  const [xp, setXp] = useState(user?.xp ?? 0);
  const [sparks, setSparks] = useState(user?.sparks ?? 0);
  const [due, setDue] = useState(0);
  const [cont, setCont] = useState<{
    lesson: LastLesson;
    resume: boolean;
    /** Level of the target lesson + how many of its lessons are done (C1). */
    level: string | null;
    done: number;
    total: number;
  } | null>(null);
  const [gam, setGam] = useState<Gamification | null>(null);
  // Whether the student has joined a class — assignments come from a teacher's
  // class, so the "My assignments" card only shows for enrolled students.
  const [enrolled, setEnrolled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // First-load flag → show skeletons instead of "jumping from 0" content.
  const [loading, setLoading] = useState(true);
  // How many published exercises each skill category has (keyed by TASKS.key).
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  // The primary data load failed (network/server) — show a retry cue since the
  // dashboard otherwise degrades silently to cached/zero values.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoadFailed(false);
      const [stats, dueList, gamification, myClasses] = await Promise.all([
        getStats(token),
        getDue(token),
        getGamification(token).catch(() => null),
        getMyClasses(token).catch(() => null),
      ]);
      setXp(stats.xp);
      setSparks(stats.sparks);
      setDue(dueList.length);
      if (gamification) setGam(gamification);
      setEnrolled((myClasses?.enrolled?.length ?? 0) > 0);
    } catch {
      setLoadFailed(true); // keep last values, but surface a retry cue
    }
    // Exercise counts per skill — independent of the stats above, so a failure
    // here never blocks the rest of the home screen.
    try {
      const results = await Promise.all(
        TASKS.map((task) =>
          // Reading content = passages (ReadingPassage), not quizzes.
          (task.key === 'reading'
            ? getReadingList(token).then((r) => r.items.length)
            : getExercises(token, task.key).then((r) => r.items.length)
          )
            .then((n) => [task.key, n] as const)
            .catch(() => [task.key, 0] as const),
        ),
      );
      setTaskCounts(Object.fromEntries(results));
    } catch {
      // keep last counts
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // "Continue learning": the server picks the next unfinished lesson and reports
  // real progress through its level (C1). If everything is done we fall back to
  // the last opened lesson so the hero still has somewhere to go. On a failed
  // request we show that same local lesson without progress (offline-safe).
  const loadContinue = useCallback(async () => {
    if (!token) return;
    const last = await getLastLesson();
    try {
      const r = await getContinue(token);
      const lesson = r.lesson ?? last;
      setCont(
        lesson
          ? {
              lesson,
              resume: lesson.id === last?.id,
              level: r.level,
              done: r.levelDone,
              total: r.levelTotal,
            }
          : null,
      );
    } catch {
      setCont(last ? { lesson: last, resume: true, level: null, done: 0, total: 0 } : null);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadContinue();
    }, [loadContinue]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    haptics.tap(); // tactile confirmation of the pull-to-refresh
    await load();
    setRefreshing(false);
  };

  const streak = gam?.currentStreak ?? 0;
  // Total published exercises across all skills (header count pill).
  const totalExercises = Object.values(taskCounts).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.root}>
      {/* Solid page background (#191040). The hero below dissolves into this
          exact color, so there is no seam between the fox scene and the page. */}
      <ScrollView
        contentContainerStyle={[styles.container, bounded]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.white}
          />
        }
      >
        {/* Overscroll fill — sits just ABOVE the content so pulling down reveals
            the hero's sky colour (not white). It never affects the body: it is
            anchored above y=0 and only appears while bouncing. */}
        <View pointerEvents="none" style={[styles.overscrollFill, { backgroundColor: overscrollColor }]} />
        {/* Top: fox scene as a full-bleed background — greeting + streak/gem/XP
            overlaid, fading into the page background (no boxed hero card). */}
        <View style={styles.top}>
          {/* Fallback sky while the image loads — matches the active theme */}
          <LinearGradient
            colors={c.backgroundGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Layer 1 — sky image (purple night sky / bright daytime clouds) */}
          <Image source={skySource} style={StyleSheet.absoluteFill} resizeMode="cover" />
          {/* Bottom scrim — dissolves the sky into the page background at the
              band's edges (sides of the cards, below the island). */}
          <LinearGradient
            colors={[`rgba(${pageRgb},0)`, `rgba(${pageRgb},0)`, `rgba(${pageRgb},1)`]}
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
                {/* On the dark sky hero — always light text, both themes. */}
                <AppText variant="h1" color={c.white}>{t("greeting")}, {firstName} 👋</AppText>
                <AppText
                  variant="body"
                  color={c.textOnDarkMuted}
                  style={styles.sub}
                >
                  {t("homeSubtitle")}
                </AppText>
              </View>
              <View style={styles.headerIcons}>
                <IconButton icon="notifications-outline" dot={hasUnread} size={44} style={styles.headerIconBtn} accessibilityLabel={t('notifications')} onPress={() => router.push('/notifications')} />
                {/* Dictionary — in-place search overlay (no screen change) */}
                <IconButton icon="search" size={44} style={styles.headerIconBtn} accessibilityLabel={t('searchEnglishWord')} onPress={openSearch} />
              </View>
            </View>

            {/* Streak / gem / XP badges over the scene */}
            <View style={styles.heroTop}>
              <View style={styles.streakBadge}>
                <StreakFlame streak={streak} />
                <AppText variant="h2" color={c.white}>{streak}</AppText>
                <View>
                  <AppText variant="caption" color={c.textOnDark}>
                    {t("statStreak")}
                  </AppText>
                  <AppText variant="caption" color={c.textOnDarkMuted}>
                    {t("keepGoing")}
                  </AppText>
                </View>
              </View>
              <View style={styles.heroPillCol}>
                <View style={styles.heroPill}>
                  <AppIcon name="sparks" size={30} />
                  <AppText variant="label" color={c.white}>
                    {sparks} {t("sparks")}
                  </AppText>
                </View>
                <View style={styles.heroPill}>
                  <AppIcon name="xp" size={30} />
                  <AppText variant="label" color={c.white}>
                    {xp.toLocaleString()} XP
                  </AppText>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Body content (padded; the hero above is full-bleed) */}
        <View style={styles.body}>
          {/* First-load failure → inline retry (dashboard otherwise shows stale/zero). */}
          {loadFailed && !loading ? (
            <Pressable style={styles.retryBanner} onPress={() => { haptics.tap(); load(); }}>
              <Ionicons name="cloud-offline-outline" size={18} color={c.danger} />
              <AppText variant="caption" color={c.textSecondary} style={{ flex: 1 }}>
                {t("errorGeneric")}
              </AppText>
              <View style={styles.retryBtn}>
                <Ionicons name="refresh" size={13} color={c.primary} />
                <AppText variant="label" color={c.primary}>{t("retry")}</AppText>
              </View>
            </Pressable>
          ) : null}

          {/* Continue learning */}
          {cont ? (
            <Pressable
              style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
              onPress={() => router.push(`/lesson/${cont.lesson.id}`)}
            >
              <LinearGradient
                colors={c.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.continueBody}>
                <AppText variant="overline" color={c.textOnDarkMuted}>
                  {(cont.resume ? t("resumeLearning") : t("startLearning")).toUpperCase()}
                </AppText>
                <AppText variant="h2" color={c.white} numberOfLines={2}>
                  {cont.lesson.title}
                </AppText>
                {/* Real level progress from the server — no placeholder. */}
                {cont.total > 0 ? (
                  <View style={styles.continueProgress}>
                    <ProgressBar
                      value={cont.done / cont.total}
                      color={c.white}
                      track={c.glassBorder}
                      height={6}
                    />
                    <AppText variant="caption" color={c.textOnDarkMuted}>
                      {cont.level ? `${cont.level} · ` : ""}
                      {tf("lessonProgressCount", { done: cont.done, total: cont.total })}
                    </AppText>
                  </View>
                ) : null}
                <View style={styles.continueBtn}>
                  <AppText variant="bodyStrong" color={c.primary}>
                    {t("continue")} →
                  </AppText>
                </View>
              </View>
              <View style={styles.continueIcon}>
                {cont.lesson.thumbnailUrl ? (
                  // AppImage = expo-image: disk cache + a thumbnail-sized download.
                  <AppImage
                    source={{ uri: cont.lesson.thumbnailUrl }}
                    width={160}
                    style={styles.continueThumb}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="play" size={28} color={c.white} />
                )}
              </View>
            </Pressable>
          ) : null}

          {/* Review reminder */}
          <View style={styles.reviewCard}>
            <View style={styles.reviewHead}>
              <View style={styles.reviewIcon}>
                <Ionicons name="alarm" size={26} color={tints.purple.fg} />
              </View>
              <View style={styles.reviewBody}>
                <AppText variant="h3">{t("reviewWords")}</AppText>
                <AppText variant="caption" color={c.textSecondary}>
                  {due > 0 ? tf("wordsDueCount", { n: due }) : t("noWordsDue")}
                </AppText>
              </View>
              {due > 0 ? (
                <View style={styles.reviewDueBadge}>
                  <AppText variant="label" color={c.white} style={styles.reviewDueText}>
                    {due}
                  </AppText>
                </View>
              ) : null}
            </View>
            <Button
              label={t("startReview")}
              icon="play"
              size="md"
              onPress={() => router.push("/swipe")}
            />
          </View>

          {/* My assignments — only for students enrolled in a class (that's
              where assignments come from). */}
          {enrolled ? (
            <Pressable
              style={({ pressed }) => [styles.joinCard, pressed && styles.pressed]}
              onPress={() => router.push("/assignments")}
            >
              <View style={[styles.joinIcon, { backgroundColor: tints.green.bg, borderColor: tints.green.fg }]}>
                <Ionicons name="clipboard" size={24} color={tints.green.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{t("myAssignments")}</AppText>
                <AppText variant="caption">{t("assignmentsSubtitle")}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.borderStrong} />
            </Pressable>
          ) : null}

          {/* IELTS prep — exam vertical, its own hub (no extra tab: the bar is full) */}
          <Pressable
            style={({ pressed }) => [styles.joinCard, pressed && styles.pressed]}
            onPress={() => router.push("/ielts")}
          >
            <View style={[styles.joinIcon, { backgroundColor: tints.amber.bg, borderColor: tints.amber.fg }]}>
              <Ionicons name="school" size={24} color={tints.amber.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{t("ieltsHomeCard")}</AppText>
              <AppText variant="caption">{t("ieltsHomeHint")}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.borderStrong} />
          </Pressable>

          {/* Idioms (Хэлц үг) — self-contained vocabulary feature, its own hub */}
          <Pressable
            style={({ pressed }) => [styles.joinCard, pressed && styles.pressed]}
            onPress={() => router.push("/idioms")}
          >
            <View style={[styles.joinIcon, { backgroundColor: tints.purple.bg, borderColor: tints.purple.fg }]}>
              <Ionicons name="chatbubbles" size={24} color={tints.purple.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{t("idiomsTitle")}</AppText>
              <AppText variant="caption">{t("idiomsSubtitle")}</AppText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.borderStrong} />
          </Pressable>

          {/* Exercises — each tile opens its skill screen of exercises */}
          <View style={styles.sectionRow}>
            <AppText variant="h2">{t("exercisesTitle")}</AppText>
            <View style={styles.countPill}>
              <AppText variant="label" color={c.textSecondary}>
                {tf("exerciseCount", { n: totalExercises })}
              </AppText>
            </View>
          </View>
          <View style={styles.grid}>
            {loading
              ? TASKS.map((task) => (
                  <Skeleton key={task.key} width="23%" height={92} radius={radius.md} />
                ))
              : TASKS.map((task, i) => {
                  const count = taskCounts[task.key] ?? 0;
                  return (
                    <Animated.View
                      key={task.key}
                      style={styles.taskWrap}
                      entering={reduceMotion ? undefined : FadeInDown.delay(i * 60).springify()}
                    >
                      <Pressable
                        style={({ pressed }) => [styles.task, pressed && styles.pressed]}
                        // Reading = passages grouped by сэдэв (own screen); the other
                        // skills are quiz-based exercise lists.
                        onPress={() => router.push(task.key === 'reading' ? '/reading' : `/skill/${task.key}`)}
                      >
                        <View style={[styles.taskIcon, { backgroundColor: task.tint.bg, borderColor: task.tint.fg }]}>
                          {task.appIcon ? (
                            <AppIcon name={task.appIcon} size={30} />
                          ) : (
                            <Ionicons name={task.icon} size={22} color={task.tint.fg} />
                          )}
                        </View>
                        <AppText variant="caption" color={c.text} numberOfLines={1} style={styles.taskLabel}>
                          {t(task.labelKey)}
                        </AppText>
                        <View style={styles.taskCount}>
                          <Ionicons name="ribbon" size={10} color={c.xp} />
                          <AppText variant="caption" numberOfLines={1}>
                            {count}
                          </AppText>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
          </View>

          <View style={{ height: 110 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  container: { paddingTop: 0 },
  // Colour band anchored just above the scroll content; only visible while
  // pulling to refresh, so the top overscroll shows sky instead of white.
  overscrollFill: { position: "absolute", top: -HERO_H, left: 0, right: 0, height: HERO_H },

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
  retryBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 4 },

  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headerText: { flex: 1, paddingTop: 2 },
  sub: { marginTop: 4 },
  headerIcons: { flexDirection: "row", gap: spacing.sm },
  headerIconBtn: { borderWidth: 1, borderColor: c.border },

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
    backgroundColor: c.primary,
    ...(elevation.md as object),
  },
  continueBody: { flex: 1, gap: 6 },
  continueProgress: { gap: 4, marginTop: 2 },
  continueBtn: {
    alignSelf: "flex-start",
    backgroundColor: c.white,
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
    overflow: "hidden",
  },
  continueThumb: { width: "100%", height: "100%" },

  // Review reminder
  reviewCard: {
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...(elevation.sm as object),
  },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  // Shared premium icon chip — rounded square with a soft tint + matching
  // outline so every feature icon reads as one consistent, vivid set.
  reviewIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: tints.purple.bg,
    borderWidth: 1,
    borderColor: tints.purple.fg,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBody: { flex: 1, gap: 2 },
  reviewDueBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewDueText: { fontWeight: "800" },

  // My assignments
  joinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...(elevation.sm as object),
  },
  joinIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Exercises
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  countPill: {
    backgroundColor: c.surfaceAlt,
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
  // Compact secondary "quick-row": 4 flat tiles in a single row, lighter than
  // the primary Continue hero above so there is one clear primary action (C1).
  // 23% × 4 + space-between leaves even gaps.
  taskWrap: { width: "23%" },
  task: {
    width: "100%",
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 5,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border, // flat outline instead of a shadow → reads as secondary
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  taskLabel: { fontWeight: "600" },
  taskCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
