import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { enter } from "../../src/lib/motion";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { haptics } from "../../src/lib/haptics";
import { useAuth } from "../../src/auth/AuthContext";
import { getGamification, type Gamification } from "../../src/api/gamification";
import { getExercises, type Quiz } from "../../src/api/quizzes";
import { loadDailyTasks, DAILY_TASK_GOAL } from "../../src/lib/dailyTasks";
import { AppText } from "../../src/components/Text";
import { AppIcon } from "../../src/components/AppIcon";
import { DictionaryButton } from "../../src/components/DictionaryButton";
import { appIcons } from "../../src/constants/appIcons";
import { IconTile } from "../../src/components/IconTile";
import { Pill } from "../../src/components/Pill";
import { ProgressBar } from "../../src/components/ProgressBar";
import { t, tf } from "../../src/i18n";
import { useColors } from "../../src/settings/SettingsContext";
import {
  spacing,
  radius,
  tints,
  elevation,
  type AppColors,
  progressGradients,
} from "../../src/theme/theme";
import { bounded } from '../../src/theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;
const banner = require("../../assets/soril-banner.webp");

// 3D glossy icon-ууд (assets/soril/README.md-г үз). PNG-ууд бэлэн болсон үед
// доорх require мөрийг нээж, тухайн game-ийн `img`-д онооно. img байвал IconTile
// зургийг, байхгүй бол Ionicons `icon`-ийг харуулна.
// const imgTarget = require("../../assets/soril/game-target.png");
// const imgHeadphones = require("../../assets/soril/game-headphones.png");
// const imgBolt = require("../../assets/soril/game-bolt.png");
// const imgLink = require("../../assets/soril/game-link.png");
// const imgPuzzle = require("../../assets/soril/game-puzzle.png");
// const imgBook = require("../../assets/soril/game-book.png");

interface Game {
  icon: IconName;
  img?: number; // require()'d 3D PNG (тайлбараас нээх)
  title: string;
  desc: string;
  tint: { bg: string; fg: string };
  /** Route to push when tapped. Games without a route show "coming soon". */
  route?: string;
}

/** Game cards. `title`/`desc` have no matching backend content — this is
 *  static UI copy, so it goes through i18n like everything else in the app.
 *  `img` = 3D glossy icon (assets/icons) shown instead of the Ionicons `icon`. */
function games(t: (key: import("../../src/i18n").TranslationKey) => string): Game[] {
  return [
    {
      icon: "locate",
      img: appIcons.reading,
      title: t("gameVocabQuizTitle"),
      desc: t("gameVocabQuizDesc"),
      tint: tints.purple,
      route: "/game/classic",
    },
    {
      icon: "headset",
      img: appIcons.listening,
      title: t("gameListenTitle"),
      desc: t("gameListenDesc"),
      tint: tints.blue,
      route: "/game/listen",
    },
    {
      icon: "flash",
      img: appIcons.xp,
      title: t("gameSpeedTitle"),
      desc: t("gameSpeedDesc"),
      tint: tints.amber,
      route: "/game/speed",
    },
    {
      icon: "link",
      img: appIcons.water,
      title: t("gameMatchTitle"),
      desc: t("gameMatchDesc"),
      tint: tints.teal,
      route: "/game/match",
    },
    {
      icon: "extension-puzzle",
      img: appIcons.fill,
      title: t("gameFillTitle"),
      desc: t("gameFillDesc"),
      tint: tints.pink,
      route: "/skill/fill",
    },
    {
      icon: "book",
      img: appIcons.grammar,
      title: t("gameGrammarTitle"),
      desc: t("gameGrammarDesc"),
      tint: tints.green,
      route: "/skill/grammar",
    },
  ];
}

/** Daily-goal fallback while `/gamification` is still loading (backend: 50 XP). */
const DAILY_GOAL_FALLBACK = 50;

/**
 * Админаас нэмсэн сорилын `Quiz.category` (admin → Сорил хуудас).
 *
 * Дээрх 6 карт бол үгийн сангаас автоматаар үүсдэг тоглоомууд — админы бичсэн
 * сорилыг харуулдаггүй. Тэр контентыг гаргах цорын ганц зам нь энэ хэсэг тул
 * утга нь `admin/src/pages/quizzes/QuizzesPage.tsx`-ийн `SORIL_CATEGORY`-тэй
 * ЯГ таарах ёстой.
 */
const SORIL_CATEGORY = "soril";
export default function SorilScreen() {
  const { user, token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [gam, setGam] = useState<Gamification | null>(null);
  useEffect(() => {
    if (token) getGamification(token).then(setGam).catch(() => {});
  }, [token]);

  // Админаас нэмсэн сорилууд. Хоосон бол хэсэг нь бүрэн нуугдана — "тун
  // удахгүй" маягийн хуурамч мөр үзүүлэхгүй.
  const [customQuizzes, setCustomQuizzes] = useState<Quiz[]>([]);
  useEffect(() => {
    if (!token) return;
    getExercises(token, SORIL_CATEGORY)
      .then((r) => setCustomQuizzes(r.items))
      .catch(() => setCustomQuizzes([]));
  }, [token]);
  const level = gam?.level ?? 1;
  const dailyExerciseGoal = gam?.dailyExerciseGoal ?? DAILY_TASK_GOAL;
  const path = useMemo(
    () => Array.from({ length: dailyExerciseGoal }, (_, i) => i + 1),
    [dailyExerciseGoal],
  );

  // Path nodes = exercises finished TODAY, not an abstract slice of the level
  // bar. A node the student can actually tick off by doing one exercise is the
  // whole point; the old version moved on XP and so looked frozen for hours.
  const [pathDone, setPathDone] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (gam?.todayExercises !== undefined) {
        setPathDone(Math.min(dailyExerciseGoal, gam.todayExercises));
        return () => { active = false; };
      }
      loadDailyTasks().then((s) => { if (active) setPathDone(Math.min(dailyExerciseGoal, s.done)); });
      return () => { active = false; };
    }, [dailyExerciseGoal, gam?.todayExercises]),
  );
  // Today's challenge = real XP earned today vs the backend's daily goal.
  // Until it loads we show 0 rather than a plausible-looking made-up number.
  const dailyGoal = gam?.dailyGoal ?? DAILY_GOAL_FALLBACK;
  const dailyDone = gam?.todayXp ?? 0;
  const router = useRouter();
  const open = () =>
    Alert.alert(t("comingSoon"), t("gameComingSoon"));
  const openGame = (g: Game) => {
    haptics.tap();
    return g.route ? router.push(g.route as never) : open();
  };
  const GAMES = games(t);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.container, bounded]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="h1">{t("quiz")}</AppText>
          <View style={styles.headerActions}>
            <DictionaryButton size={38} />
            <View style={styles.diamondBadge}>
              <AppIcon name="sparks" size={20} />
              <AppText variant="label" color={c.text}>
                {user?.sparks ?? 0}
              </AppText>
            </View>
          </View>
        </View>
        <AppText
          variant="body"
          color={c.textSecondary}
          style={styles.subtitle}
        >
          {t("sorilSubtitle")}
        </AppText>

        {/* Daily challenge hero — banner image as background (same as Home) */}
        <ImageBackground
          source={banner}
          style={styles.hero}
          imageStyle={styles.heroImg}
          resizeMode="cover"
        >
          <View style={styles.heroBody}>
            <View style={styles.heroPill}>
              <AppIcon name="streak" size={14} />
              <AppText variant="overline" color={c.white}>
                {t("dailyChallenge")}
              </AppText>
            </View>
            <AppText variant="h3" color={c.white} style={styles.heroTitle}>
              {tf("dailyChallengeTitle", { xp: dailyGoal })}
            </AppText>
            {/* Was a flat "20 XP bonus waiting!" — the backend awards no such
                bonus, so this now states the real XP still owed on the goal. */}
            <AppText variant="bodyStrong" color={c.xp}>
              {dailyDone >= dailyGoal
                ? t("dailyChallengeDone")
                : tf("dailyChallengeRemaining", { xp: dailyGoal - dailyDone })}
            </AppText>
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.9)"
              style={styles.heroProg}
            >
              {dailyDone} / {dailyGoal} XP {t("completedOf")}
            </AppText>
            <ProgressBar
              value={Math.min(1, dailyDone / dailyGoal)}
              gradient={progressGradients.success}
              track="rgba(255,255,255,0.3)"
              height={8}
            />
            <Pressable
              style={({ pressed }) => [
                styles.heroBtn,
                pressed && styles.pressed,
              ]}
              onPress={open}
            >
              <AppText variant="bodyStrong" color={c.primary}>
                {t("continue")} →
              </AppText>
            </Pressable>
          </View>
        </ImageBackground>

        {/* Section */}
        <View style={styles.sectionRow}>
          <AppText variant="h2">{t("quizzesSection")}</AppText>
          <Pressable style={styles.filterChip} onPress={open}>
            <AppText variant="label" color={c.text}>
              {t("allLabel")}
            </AppText>
            <Ionicons
              name="chevron-down"
              size={14}
              color={c.textSecondary}
            />
          </Pressable>
        </View>

        {/* Games grid */}
        <View style={styles.grid}>
          {GAMES.map((g, i) => (
            <Animated.View key={g.title} entering={enter(i * 60)} style={styles.cardWrap}>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => openGame(g)}
            >
              <IconTile
                icon={g.icon}
                image={g.img}
                bg={g.tint.bg}
                fg={g.tint.fg}
                size={56}
                iconSize={28}
              />
              <View style={styles.cardBody}>
                <AppText variant="h3" numberOfLines={1}>
                  {g.title}
                </AppText>
                <AppText
                  variant="caption"
                  numberOfLines={2}
                  style={styles.cardDesc}
                >
                  {g.desc}
                </AppText>
                <View style={styles.cardPill}>
                  <Pill
                    label="+10 XP"
                    icon="flash"
                    bg={tints.purple.bg}
                    fg={c.primary}
                  />
                </View>
              </View>
            </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Админаас нэмсэн сорилууд — байгаа үед л харагдана */}
        {customQuizzes.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <AppText variant="h2">{t("sorilCustomSection")}</AppText>
            </View>
            <View style={styles.quizList}>
              {customQuizzes.map((q) => (
                <Pressable
                  key={q.id}
                  style={({ pressed }) => [styles.quizRow, pressed && styles.pressed]}
                  onPress={() => { haptics.tap(); router.push(`/quiz/${q.id}`); }}
                  accessibilityRole="button"
                  accessibilityLabel={q.title}
                >
                  <IconTile
                    icon="help-circle"
                    bg={tints.purple.bg}
                    fg={tints.purple.fg}
                    size={44}
                    iconSize={24}
                  />
                  <View style={styles.quizBody}>
                    <AppText variant="bodyStrong" numberOfLines={2}>{q.title}</AppText>
                    <AppText variant="caption" color={c.textSecondary}>
                      {tf("questionCount", { n: q.questions?.length ?? 0 })} · {q.xpReward} XP ·{" "}
                      {q.level.toUpperCase()}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Progress path */}
        <View style={styles.pathCard}>
          <View style={styles.pathHead}>
            <IconTile
              icon="trophy"
              image={appIcons.trophy}
              bg={tints.amber.bg}
              fg={tints.amber.fg}
              size={44}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{t("progressPath")}</AppText>
              <AppText variant="caption">
                {pathDone >= dailyExerciseGoal
                  ? t("progressPathDone")
                  : tf("progressPathHint", { n: dailyExerciseGoal - pathDone })}
              </AppText>
            </View>
            <Pill
              label={`Level ${level}`}
              bg={c.primarySoft}
              fg={c.primaryDark}
            />
          </View>

          <View style={styles.pathRow}>
            {path.map((n, i) => {
              const done = n <= pathDone;
              const current = n === pathDone + 1;
              const last = i === path.length - 1;
              return (
                <Fragment key={n}>
                  <View
                    style={[
                      styles.node,
                      done || current ? styles.nodeOn : styles.nodeOff,
                      current && styles.nodeCurrent,
                    ]}
                  >
                    {done ? (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={c.white}
                      />
                    ) : last ? (
                      <Ionicons name="star" size={16} color={c.xp} />
                    ) : (
                      <AppText
                        variant="label"
                        color={current ? c.white : c.textMuted}
                      >
                        {n}
                      </AppText>
                    )}
                  </View>
                  {!last && (
                    <View
                      style={[
                        styles.connector,
                        n <= pathDone && styles.connectorOn,
                      ]}
                    />
                  )}
                </Fragment>
              );
            })}
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  diamondBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    ...(elevation.sm as object),
  },
  subtitle: { marginTop: 2, marginBottom: spacing.lg },

  // Hero
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: "hidden",
    minHeight: 180,
    justifyContent: "center",
    backgroundColor: c.primary, // зураг ачаалагдах хүртэлх fallback
  },
  heroImg: { borderRadius: radius.xl },
  heroBody: { maxWidth: "62%" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  heroTitle: { marginBottom: 2 },
  heroProg: { marginTop: spacing.md, marginBottom: 6 },
  heroBtn: {
    alignSelf: "flex-start",
    backgroundColor: c.white,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },

  // Section
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
  },

  // Games
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
  },
  cardWrap: { width: "48.5%" },
  card: {
    width: "100%",
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...(elevation.sm as object),
  },
  cardBody: { flex: 1, gap: 2 },
  cardDesc: { marginBottom: spacing.sm },
  cardPill: { alignSelf: "flex-start", marginTop: "auto" },

  // Админаас нэмсэн сорилын жагсаалт
  quizList: { gap: spacing.sm },
  quizRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...(elevation.sm as object),
  },
  quizBody: { flex: 1, gap: 2 },

  // Progress path
  pathCard: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.xl,
    ...(elevation.sm as object),
  },
  pathHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pathRow: { flexDirection: "row", alignItems: "center" },
  node: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  nodeOn: { backgroundColor: c.primary },
  nodeOff: { backgroundColor: c.surfaceAlt },
  nodeCurrent: { borderWidth: 3, borderColor: c.primarySoft },
  connector: {
    flex: 1,
    height: 3,
    backgroundColor: c.surfaceAlt,
    marginHorizontal: 2,
  },
  connectorOn: { backgroundColor: c.primary },

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
