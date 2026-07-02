import { Fragment, useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/AuthContext";
import { getGamification, type Gamification } from "../../src/api/gamification";
import { AppText } from "../../src/components/Text";
import { IconTile } from "../../src/components/IconTile";
import { Pill } from "../../src/components/Pill";
import { ProgressBar } from "../../src/components/ProgressBar";
import { t } from "../../src/i18n";
import { useColors } from "../../src/settings/SettingsContext";
import {
  spacing,
  radius,
  tints,
  elevation,
  type AppColors,
} from "../../src/theme/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const banner = require("../../assets/soril-banner.png");

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
 *  static UI copy, so it goes through i18n like everything else in the app. */
function games(t: (key: import("../../src/i18n").TranslationKey) => string): Game[] {
  return [
    {
      icon: "locate",
      // img: imgTarget,
      title: t("gameVocabQuizTitle"),
      desc: t("gameVocabQuizDesc"),
      tint: tints.purple,
      route: "/vocab-quiz",
    },
    {
      icon: "headset",
      // img: imgHeadphones,
      title: t("gameListenTitle"),
      desc: t("gameListenDesc"),
      tint: tints.blue,
    },
    {
      icon: "flash",
      // img: imgBolt,
      title: t("gameSpeedTitle"),
      desc: t("gameSpeedDesc"),
      tint: tints.amber,
    },
    {
      icon: "link",
      // img: imgLink,
      title: t("gameMatchTitle"),
      desc: t("gameMatchDesc"),
      tint: tints.teal,
    },
    {
      icon: "extension-puzzle",
      // img: imgPuzzle,
      title: t("gameFillTitle"),
      desc: t("gameFillDesc"),
      tint: tints.pink,
    },
    {
      icon: "book",
      // img: imgBook,
      title: t("gameGrammarTitle"),
      desc: t("gameGrammarDesc"),
      tint: tints.green,
    },
  ];
}

// TODO: бодит daily-challenge backend-ээс.
const DAILY_DONE = 2;
const DAILY_GOAL = 5;
const PATH = [1, 2, 3, 4, 5]; // node-ууд (тухайн level доторх ахиц)

export default function SorilScreen() {
  const { user, token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [gam, setGam] = useState<Gamification | null>(null);
  useEffect(() => {
    if (token) getGamification(token).then(setGam).catch(() => {});
  }, [token]);
  const level = gam?.level ?? 1;
  // Path nodes = progress through the current level (5 steps).
  const pathDone = gam ? Math.min(PATH.length, Math.round(gam.progress * PATH.length)) : 0;
  const router = useRouter();
  const open = () =>
    Alert.alert(t("comingSoon"), t("gameComingSoon"));
  const openGame = (g: Game) => (g.route ? router.push(g.route as never) : open());
  const GAMES = games(t);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="h1">{t("quiz")}</AppText>
          <View style={styles.diamondBadge}>
            <Ionicons name="diamond" size={16} color={c.sparks} />
            <AppText variant="label" color={c.text}>
              {user?.sparks ?? 0}
            </AppText>
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
              <Ionicons name="flame" size={12} color={c.streak} />
              <AppText variant="overline" color={c.white}>
                {t("dailyChallenge")}
              </AppText>
            </View>
            <AppText variant="h3" color={c.white} style={styles.heroTitle}>
              {t("dailyChallengeTitle")}
            </AppText>
            <AppText variant="bodyStrong" color={c.xp}>
              {t("dailyChallengeBonus")}
            </AppText>
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.9)"
              style={styles.heroProg}
            >
              {DAILY_DONE} / {DAILY_GOAL} {t("completedOf")}
            </AppText>
            <ProgressBar
              value={DAILY_DONE / DAILY_GOAL}
              color={c.success}
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
          {GAMES.map((g) => (
            <Pressable
              key={g.title}
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
          ))}
        </View>

        {/* Progress path */}
        <View style={styles.pathCard}>
          <View style={styles.pathHead}>
            <IconTile
              icon="trophy"
              bg={tints.amber.bg}
              fg={tints.amber.fg}
              size={44}
            />
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{t("progressPath")}</AppText>
              <AppText variant="caption">{t("progressPathHint")}</AppText>
            </View>
            <Pill
              label={`Level ${level}`}
              bg={c.primarySoft}
              fg={c.primaryDark}
            />
          </View>

          <View style={styles.pathRow}>
            {PATH.map((n, i) => {
              const done = n <= pathDone;
              const current = n === pathDone + 1;
              const last = i === PATH.length - 1;
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
  card: {
    width: "48.5%",
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
