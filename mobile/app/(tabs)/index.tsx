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
import { getHearts, type HeartsState } from "../../src/api/hearts";
import { HeartsRow } from "../../src/components/HeartsRow";
import { HeartsSheet } from "../../src/components/HeartsSheet";
import { DailyGoalCard } from "../../src/components/DailyGoalCard";
import { DailyGoalSheet } from "../../src/components/DailyGoalSheet";
import { StreakFreezeSheet } from "../../src/components/StreakFreezeSheet";
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
import { PressableScale } from "../../src/components/PressableScale";
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
  progressGradients,
  skillGradients,
} from "../../src/theme/theme";
import { bounded, s } from '../../src/theme/responsive';

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
const FOX_EARS = 0.16; // empty sky above his ears, as a fraction of the composite

const { width: SCREEN_W } = Dimensions.get("window");

// The fox+island scene spans the full width and sits just under the header.
const SCENE_W = SCREEN_W;
const SCENE_H = Math.round(SCENE_W * SCENE_RATIO);

// Hero stat pills (see `StatPill`). One fixed height for all four, so a pill
// with five small hearts lines up with one holding a single big icon.
// Sized so each 3D icon is readable as *what it is* at a glance (a flame vs a
// gem vs a bolt) — below ~24pt they all reduce to a coloured smudge. Still well
// under the source PNGs' 166–234px, so nothing softens.
const STAT_PILL_H = 44;
const STAT_ICON = 28;
/**
 * Hearts show as five separate icons, so each stays smaller than a lone stat
 * icon — but not by much: heart.png is wider than it is tall (166×125), so at
 * `size` the shape only fills three quarters of that height and reads smaller
 * than the number it replaces.
 */
const HEART_ICON = 22;
/** The tallest side: the right-hand column of three (Sparks · XP · hearts). */
const STAT_STACK_H = STAT_PILL_H * 3 + spacing.sm * 2;

// Typical safe-area top and the header row (a 44pt IconButton). Estimates on
// purpose: the scene is positioned at module scope, before any inset is known,
// and being a few points out only shifts empty sky.
const SAFE_TOP_EST = 44;
const HEADER_ROW_H = 44;

// Space reserved at the top, so the fox parks BELOW the greeting and the stat
// stack instead of behind them. Derived from the stack rather than hardcoded —
// the stack's height is what actually moves this, and a magic number is exactly
// what would put the fox back under the pills next time they change. The
// composite's own empty sky is subtracted back out (the pills may reach into
// it — nothing is drawn there), and `spacing.md` keeps a gap above his ears.
const HEADER_RESERVE =
  SAFE_TOP_EST + HEADER_ROW_H + spacing.xs + spacing.sm + STAT_STACK_H + spacing.md
  - Math.round(SCENE_H * FOX_EARS);

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

// Skill tile — the 3D icon is the thing students actually aim at, so it gets a
// glass disc and most of the tile. Sizes are derived from ONE number so the
// disc can never outgrow the tile on a narrow phone.
//
// `s()` keeps the disc proportional to the screen (46pt on a 320pt SE → 54 at
// the 375 baseline → 68 on a tablet). The icon stays ~40pt at baseline, which
// is the ceiling the source PNGs (210–400px) can take before they soften.
const SKILL_ART = s(54);
const SKILL_ICON = Math.round(SKILL_ART * 0.74);
/** Disc + name + count + padding. Derived so a bigger disc grows the tile. */
const SKILL_TILE_H = SKILL_ART + 64;

const TASKS: {
  key: string;
  labelKey: TranslationKey;
  // Brand 3D icon (assets/icons via `appIcons`) — every skill has one, so there
  // is no vector fallback: the tiles always show the same picture as the rest
  // of the app uses for that skill.
  appIcon: AppIconName;
  tint: { bg: string; fg: string };
}[] = [
  { key: "reading", labelKey: "catReading", appIcon: "reading", tint: tints.green },
  { key: "listening", labelKey: "catListening", appIcon: "listening", tint: tints.blue },
  { key: "speaking", labelKey: "catSpeaking", appIcon: "speaking", tint: tints.pink },
  { key: "writing", labelKey: "catWriting", appIcon: "writing", tint: tints.orange },
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
  }, [streak, reduce, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <AppIcon name="streak" size={STAT_ICON} />
    </Animated.View>
  );
}

/**
 * One hero stat: its icon and value in a frosted capsule that glows in the
 * stat's own colour.
 *
 * Deliberately small. These float ON the fox scene, so anything with the mass
 * of a card stops being a badge and becomes a lid over the artwork — the glow
 * and the tinted hairline carry the colour instead of a big filled icon tile.
 * All four stats are the same object with different contents, so the shell is
 * written once here; `children` is the icon (an `<AppIcon>`, the animated flame,
 * or the hearts row, each of which owns its own behaviour).
 */
function StatPill({
  tint,
  value,
  label,
  children,
  onPress,
  accessibilityLabel,
  alert = false,
  badge,
}: {
  /** The stat's brand pair — `fg` tints the hairline and the glow. */
  tint: { bg: string; fg: string };
  /** Omit where the icon IS the value (five hearts need no "5/5" beside them). */
  value?: string;
  /**
   * The stat's name ("Дараалал", "XP", …), set after the value. The 3D icons
   * alone don't say WHICH counter a number is, so a new student can't tell the
   * gem from the bolt — the word does, and it costs one line of small text.
   */
  label?: string;
  children: React.ReactNode;
  /** Omit for a display-only stat — it then reads as text, not a button. */
  onPress?: () => void;
  accessibilityLabel: string;
  /** Warm tint for a stat that needs attention (hearts at zero). */
  alert?: boolean;
  /** Small overhanging chip, e.g. the banked streak-freeze count. */
  badge?: React.ReactNode;
}) {
  const c = useColors();
  const shell = [
    pillStyles.pill,
    { borderColor: alert ? c.danger : tint.fg, shadowColor: alert ? c.danger : tint.fg },
    alert && pillStyles.alert,
  ];
  const inner = (
    <>
      {children}
      {value ? (
        // Shrinks rather than clips — XP only ever grows.
        <AppText
          variant="h3"
          color={c.white}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={pillStyles.value}
        >
          {value}
        </AppText>
      ) : null}
      {label ? (
        // `label` (13/600), not `caption` (12/400): at caption weight the name
        // reads as a hairline next to the bold number and disappears against
        // the artwork behind the pill.
        <AppText variant="label" color={c.white} numberOfLines={1} style={pillStyles.label}>
          {label}
        </AppText>
      ) : null}
      {badge}
    </>
  );

  if (!onPress) {
    return (
      <View style={shell} accessibilityLabel={accessibilityLabel}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [...shell, pressed && pillStyles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {inner}
    </Pressable>
  );
}

// Static: the hero artwork is dark in BOTH themes, so these never change with
// the palette (the two values that do — the tint and the alert colour — are
// applied inline above).
const pillStyles = StyleSheet.create({
  pill: {
    height: STAT_PILL_H,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: HERO_PILL,
    borderRadius: radius.full,
    borderWidth: 1,
    // Soft halo in the stat's colour — the whole pill radiates instead of a
    // filled tile inside it. iOS only; on Android the tinted hairline carries it.
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  value: { flexShrink: 1 },
  // Sits tight after the number so "12 Дараалал" reads as one unit; never
  // wraps or pushes the pill wider than its row — the name is the hint, the
  // number is the stat.
  label: { flexShrink: 1, marginLeft: -2 },
  alert: { backgroundColor: "rgba(248,113,113,0.28)" },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
});

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
  // Greet by username. `username` is nullable in the DB (accounts that predate
  // the auth overhaul), so fall back to the first word of the full name —
  // `full_name` is NOT NULL, so this never renders a bare "Сайн уу,".
  const displayName =
    user?.username?.trim() || (user?.fullName?.split(" ")[0] ?? "");

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
  // Quiz lives. Shown here (not only inside a quiz) so a student knows what
  // they have BEFORE starting — otherwise the limit is invisible until it bites.
  const [hearts, setHearts] = useState<HeartsState | null>(null);
  const [goalSheet, setGoalSheet] = useState(false);
  const [heartsSheet, setHeartsSheet] = useState(false);
  const [freezeSheet, setFreezeSheet] = useState(false);
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
      const [stats, dueList, gamification, myClasses, heartsState] = await Promise.all([
        getStats(token),
        getDue(token),
        getGamification(token).catch(() => null),
        getMyClasses(token).catch(() => null),
        getHearts(token).catch(() => null),
      ]);
      setXp(stats.xp);
      setSparks(stats.sparks);
      setDue(dueList.length);
      if (gamification) setGam(gamification);
      if (heartsState) setHearts(heartsState);
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

  // On focus, not just on mount: XP, streak, hearts and the daily-goal ring all
  // change while the student is off in a lesson or quiz. Refetching on mount
  // only meant coming back to Home showed the numbers from app start. The GET
  // cache paints instantly and dedups the request, so this is cheap.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
  const freezes = gam?.streakFreezes ?? 0;

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
                <AppText variant="h1" color={c.white}>{t("greeting")}, {displayName} 👋</AppText>
              </View>
              <View style={styles.headerIcons}>
                <IconButton icon="notifications-outline" dot={hasUnread} size={44} style={styles.headerIconBtn} accessibilityLabel={t('notifications')} onPress={() => router.push('/notifications')} />
                {/* Dictionary — search overlay → the word panel */}
                <IconButton icon="search" size={44} style={styles.headerIconBtn} accessibilityLabel={t('searchEnglishWord')} onPress={openSearch} />
              </View>
            </View>

            {/* Streak alone on the left, the other three stacked on the right —
                so the middle of the frame, where the fox stands, stays empty.
                The right column is right-aligned and each pill is only as wide
                as its contents, which leaves a ragged inner edge: the stats read
                as badges floating over the scene rather than a panel bolted on
                top of it. The whole block also sits ABOVE the fox (see
                HEADER_RESERVE) — nothing covers him. */}
            <View style={styles.statFrame}>
              {/* Tapping the streak opens the freeze shop — the offer appears
                  where the thing it protects is already on screen. The ❄ badge
                  shows how many freezes are banked. */}
              <StatPill
                tint={tints.orange}
                value={String(streak)}
                label={t("streak")}
                onPress={() => { haptics.tap(); setFreezeSheet(true); }}
                accessibilityLabel={`${t("statStreak")}: ${streak} — ${t("streakFreezeTitle")}`}
                badge={freezes > 0 ? (
                  <View style={styles.freezeBadge}>
                    <Ionicons name="snow" size={9} color={c.sparks} />
                    <AppText variant="caption" color={c.white}>{freezes}</AppText>
                  </View>
                ) : null}
              >
                <StreakFlame streak={streak} />
              </StatPill>

              {/* Hearts first: they are the only stat that gates play, so they
                  get the position closest to the greeting. Sparks and XP are
                  scoreboard, not permission, and read below it. */}
              <View style={styles.statRight}>
                {/* Five actual hearts, not "5/5" — a student counts what is left
                    at a glance and sees one go dim when it is spent, which a
                    fraction cannot show. No `value` for the same reason: the
                    icons already ARE the number. */}
                <StatPill
                  tint={tints.coral}
                  onPress={() => { haptics.tap(); setHeartsSheet(true); }}
                  accessibilityLabel={t("heartsLabel")}
                  alert={!!hearts && !hearts.unlimited && hearts.hearts === 0}
                >
                  <HeartsRow state={hearts} size={HEART_ICON} onDark onRegen={load} />
                  {/* HeartsRow renders nothing until the fetch lands. */}
                  {!hearts ? <AppText variant="h3" color={c.textOnDarkMuted}>—</AppText> : null}
                </StatPill>

                <StatPill tint={tints.blue} value={String(sparks)} label={t("sparks")} accessibilityLabel={`${t("sparks")}: ${sparks}`}>
                  <AppIcon name="sparks" size={STAT_ICON} />
                </StatPill>

                <StatPill tint={tints.amber} value={xp.toLocaleString()} label={t("xp")} accessibilityLabel={`XP: ${xp}`}>
                  <AppIcon name="xp" size={STAT_ICON} />
                </StatPill>
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
                      gradient={progressGradients.onHero}
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

          {/* Today's XP against the student's own goal. Only once the summary
              has loaded — a ring at 0/50 while loading reads as "you did
              nothing today", which is a lie on a slow connection. */}
          {gam ? (
            <DailyGoalCard
              todayXp={gam.todayXp}
              dailyGoal={gam.dailyGoal}
              onPress={() => { haptics.tap(); setGoalSheet(true); }}
            />
          ) : null}

          {/* SECONDARY — review + assignments, each a FULL-WIDTH card stacked
              one under the other. Half-width tiles squeezed the Mongolian
              labels ("Давтах үгс" / "Миний даалгавар") into one clipped line
              and shrank the review CTA to an icon; full width keeps both
              readable whether or not the student is enrolled in a class. */}
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
              onPress={() => { haptics.tap(); router.push("/assignments"); }}
            >
              <View style={[styles.joinIcon, { backgroundColor: tints.green.bg, borderColor: tints.green.fg }]}>
                <Ionicons name="clipboard" size={24} color={tints.green.fg} />
              </View>
              <View style={styles.joinBody}>
                <AppText variant="h3">{t("myAssignments")}</AppText>
                <AppText variant="caption" color={c.textSecondary}>{t("assignmentsSubtitle")}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.borderStrong} />
            </Pressable>
          ) : null}

          {/* BROWSE — the skill menu as ONE row of 4 gradient tiles ("Юу сурах
              вэ?"). All four skills are peers, so a single row says that; the
              old 2×2 made Унших/Сонсгол look like a tier above Ярих/Бичих. */}
          <View style={styles.learnHead}>
            <AppText variant="overline" color={c.textMuted}>{t("learnEyebrow")}</AppText>
            <AppText variant="h2">{t("whatToLearn")}</AppText>
          </View>
          <View style={styles.skillGrid}>
            {loading
              ? TASKS.map((task) => (
                  <Skeleton key={task.key} height={SKILL_TILE_H} radius={radius.lg} style={styles.skillWrap} />
                ))
              : TASKS.map((task, i) => {
                  const count = taskCounts[task.key] ?? 0;
                  const grad = skillGradients[task.key] ?? skillGradients.reading;
                  const countLabel =
                    task.key === "reading"
                      ? tf("materialCount", { n: count })
                      : tf("exerciseCount", { n: count });
                  return (
                    <Animated.View
                      key={task.key}
                      style={styles.skillWrap}
                      entering={reduceMotion ? undefined : FadeInDown.delay(i * 60).springify()}
                    >
                      <PressableScale
                        style={styles.skillTile}
                        // Reading = passages grouped by сэдэв (own screen); the other
                        // skills are quiz-based exercise lists.
                        onPress={() => { haptics.tap(); router.push(task.key === "reading" ? "/reading" : `/skill/${task.key}`); }}
                        accessibilityRole="button"
                        accessibilityLabel={`${t(task.labelKey)}, ${countLabel}`}
                      >
                        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                        {/* Glass disc behind the 3D icon — it lifts the artwork
                            off the gradient (several icons are light-coloured and
                            washed out against their own stop) and gives all four
                            tiles the same optical weight whatever the icon shape. */}
                        <View style={styles.skillArt}>
                          <AppIcon name={task.appIcon} size={SKILL_ICON} />
                        </View>
                        <View style={styles.skillSpacer} />
                        {/* A quarter-width tile leaves ~50pt of text on a small
                            phone, and "Сонсгол" / "12 дасгал" are longer than
                            that. Shrink-to-fit instead of truncating: a clipped
                            skill name is what makes a tile row look broken. */}
                        <AppText
                          variant="label"
                          color={c.white}
                          center
                          style={styles.skillText}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {t(task.labelKey)}
                        </AppText>
                        <AppText
                          variant="caption"
                          color="rgba(255,255,255,0.9)"
                          center
                          style={styles.skillText}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {countLabel}
                        </AppText>
                      </PressableScale>
                    </Animated.View>
                  );
                })}
          </View>

          {/* Occasional verticals drop into a horizontal rail ("Бас үзээрэй"). */}
          <View style={styles.learnHead}>
            <AppText variant="h2">{t("alsoTry")}</AppText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            <PressableScale style={styles.railCard} onPress={() => { haptics.tap(); router.push("/ielts"); }}>
              <View style={[styles.railIcon, { backgroundColor: tints.amber.bg, borderColor: tints.amber.fg }]}>
                <Ionicons name="school" size={24} color={tints.amber.fg} />
              </View>
              <AppText variant="h3" numberOfLines={1}>{t("ieltsHomeCard")}</AppText>
              <AppText variant="caption" color={c.textSecondary} numberOfLines={2}>{t("ieltsHomeHint")}</AppText>
            </PressableScale>
            <PressableScale style={styles.railCard} onPress={() => { haptics.tap(); router.push("/idioms"); }}>
              <View style={[styles.railIcon, { backgroundColor: tints.purple.bg, borderColor: tints.purple.fg }]}>
                <Ionicons name="chatbubbles" size={24} color={tints.purple.fg} />
              </View>
              <AppText variant="h3" numberOfLines={1}>{t("idiomsTitle")}</AppText>
              <AppText variant="caption" color={c.textSecondary} numberOfLines={2}>{t("idiomsSubtitle")}</AppText>
            </PressableScale>
          </ScrollView>

          <View style={{ height: 110 }} />
        </View>
      </ScrollView>

      {/* Goal picker. Saving returns the refreshed summary, so the ring updates
          from the response — no extra round trip. */}
      <DailyGoalSheet
        visible={goalSheet}
        current={gam?.dailyGoal ?? 0}
        onClose={() => setGoalSheet(false)}
        onSaved={setGam}
      />

      {/* Buying spends Sparks, so refresh the balance from the same load that
          feeds the hero cards — the summary itself comes back in the response. */}
      <StreakFreezeSheet
        visible={freezeSheet}
        gam={gam}
        sparksBalance={sparks}
        onClose={() => setFreezeSheet(false)}
        onBought={(next) => { setGam(next); load(); }}
      />

      {/* Info only here — there is no quiz to leave, so no `onExit`. */}
      <HeartsSheet
        visible={heartsSheet}
        state={hearts}
        sparksBalance={sparks}
        onRefilled={(next) => { setHearts(next); load(); }}
        onClose={() => setHeartsSheet(false)}
        onRegen={load}
      />
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
  // Tighter gap keeps the one-row stat pills up near the greeting, clear of
  // the fox's head below.
  topInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
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
  headerIcons: { flexDirection: "row", gap: spacing.sm },
  headerIconBtn: { borderWidth: 1, borderColor: c.border },

  // 1 left (streak) · 3 stacked right. In normal flow (not absolutely placed)
  // because the safe-area inset above varies by device, and a hardcoded y would
  // drift between an iPhone notch and an Android status bar.
  statFrame: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // Right-aligned and content-width, NOT a fixed-width column: pinning the
  // right edge keeps the stack tidy while the left edge stays ragged, which is
  // what stops three pills from reading as one solid block.
  // Shrinkable: the pills grew a name each, and on a 320pt screen hearts +
  // "Зүрх" beside the streak pill would otherwise run off the frame. Bounding
  // the column lets each label truncate instead.
  statRight: { alignItems: "flex-end", gap: spacing.sm, flexShrink: 1 },
  // Banked streak freezes — a corner badge so it never widens the pill.
  freezeBadge: {
    position: "absolute",
    top: -8,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.sparks,
    // Near-solid, unlike the bar itself: the badge overhangs the capsule onto
    // the sky art, and a 45%-alpha chip there is unreadable.
    backgroundColor: "rgba(18,10,40,0.92)",
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
    // The one glowing element on Home (§3.1) — the only elevation.float.
    ...(elevation.float as object),
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

  // Review reminder — full-width card: icon chip + title/subtitle + due badge,
  // with the "start review" button on its own line underneath.
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

  // My assignments — full-width row: icon chip + text + chevron.
  joinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
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
  joinBody: { flex: 1, gap: 2 },

  // Section eyebrow + title (skill grid / rail).
  learnHead: { marginTop: spacing.xl, marginBottom: spacing.md, gap: 2 },

  // Skill menu — ONE row of 4 gradient tiles, never wrapping.
  skillGrid: { flexDirection: "row", gap: spacing.sm },
  // `flex: 1` (not a % width) so the four always divide whatever the row has,
  // on a 320pt SE as well as a tablet. `minWidth: 0` lets a tile shrink below
  // its text's natural width instead of pushing the last one off-screen.
  skillWrap: { flex: 1, minWidth: 0 },
  skillTile: {
    height: SKILL_TILE_H,
    borderRadius: radius.lg,
    overflow: "hidden",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    // Centred, not left-aligned: at a quarter of the row the disc and the label
    // are near the same width, so anything off-centre reads as a mistake.
    alignItems: "center",
    justifyContent: "flex-start",
    ...(elevation.sm as object),
  },
  // Frosted disc under the 3D icon.
  skillArt: {
    width: SKILL_ART,
    height: SKILL_ART,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },
  skillSpacer: { flex: 1, minHeight: spacing.xs },
  // `alignItems: "center"` on the tile shrink-wraps its children, and
  // `adjustsFontSizeToFit` needs a real width to shrink against — so the two
  // labels stretch to the tile and centre themselves with `textAlign` instead.
  skillText: { alignSelf: "stretch" },

  // "Бас үзээрэй" horizontal rail.
  rail: { gap: spacing.md, paddingRight: spacing.lg },
  railCard: {
    width: 232,
    gap: spacing.xs,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    ...(elevation.sm as object),
  },
  railIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },

  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
