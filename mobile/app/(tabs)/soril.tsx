import { Fragment } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/AuthContext";
import { AppText } from "../../src/components/Text";
import { IconTile } from "../../src/components/IconTile";
import { Pill } from "../../src/components/Pill";
import { ProgressBar } from "../../src/components/ProgressBar";
import {
  colors,
  spacing,
  radius,
  tints,
  elevation,
} from "../../src/theme/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const banner = require("../../assets/soril-banner.png");

interface Game {
  icon: IconName;
  title: string;
  desc: string;
  tint: { bg: string; fg: string };
}

const GAMES: Game[] = [
  {
    icon: "locate",
    title: "Үг ангууч",
    desc: "Зураг харж, зөв үгийг сонго.",
    tint: tints.purple,
  },
  {
    icon: "headset",
    title: "Сонсож барь",
    desc: "Аудио сонсож, зөв хариул.",
    tint: tints.blue,
  },
  {
    icon: "flash",
    title: "Хурдан бууд",
    desc: "Хугацаанд багтааж хариул!",
    tint: tints.amber,
  },
  {
    icon: "link",
    title: "Холбож ял",
    desc: "Үг, зургийг зөв холбо.",
    tint: tints.teal,
  },
  {
    icon: "extension-puzzle",
    title: "Нөхөж дуусга",
    desc: "Хоосон зайг зөв нөх.",
    tint: tints.pink,
  },
  {
    icon: "book",
    title: "Grammar Boss",
    desc: "Грамматик мэдлэгээ шалга.",
    tint: tints.green,
  },
];

// TODO: бодит challenge / level progress backend-ээс.
const DAILY_DONE = 2;
const DAILY_GOAL = 5;
const LEVEL = 4;
const PATH = [1, 2, 3, 4, 5]; // node-ууд; LEVEL хүртэл done

export default function SorilScreen() {
  const { user } = useAuth();
  const open = () =>
    Alert.alert("Тун удахгүй", "Энэ тоглоом удахгүй нэмэгдэнэ. 🦊");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <AppText variant="h1">Сорил</AppText>
          <View style={styles.diamondBadge}>
            <Ionicons name="diamond" size={16} color={colors.sparks} />
            <AppText variant="label" color={colors.text}>
              {user?.sparks ?? 0}
            </AppText>
          </View>
        </View>
        <AppText
          variant="body"
          color={colors.textSecondary}
          style={styles.subtitle}
        >
          Мэдлэгээ шалгаж, амжилтаа ахиулаарай!
        </AppText>

        {/* Daily challenge hero — banner image as full background */}
        <ImageBackground
          source={banner}
          style={styles.hero}
          imageStyle={styles.heroImg}
          resizeMode="cover"
        >
          <View style={styles.heroBody}>
            <View style={styles.heroPill}>
              <Ionicons name="flame" size={12} color={colors.streak} />
              <AppText variant="overline" color={colors.white}>
                ӨНӨӨДРИЙН CHALLENGE
              </AppText>
            </View>
            <AppText variant="h3" color={colors.white} style={styles.heroTitle}>
              Өнөөдөр 50 XP авахад
            </AppText>
            <AppText variant="bodyStrong" color={colors.xp}>
              20 XP bonus хүлээж байна!
            </AppText>
            <AppText
              variant="caption"
              color="rgba(255,255,255,0.9)"
              style={styles.heroProg}
            >
              {DAILY_DONE} / {DAILY_GOAL} дууссан
            </AppText>
            <ProgressBar
              value={DAILY_DONE / DAILY_GOAL}
              color={colors.success}
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
              <AppText variant="bodyStrong" color={colors.primary}>
                Үргэлжлүүлэх →
              </AppText>
            </Pressable>
          </View>
        </ImageBackground>

        {/* Section */}
        <View style={styles.sectionRow}>
          <AppText variant="h2">Сорилууд</AppText>
          <Pressable style={styles.filterChip} onPress={open}>
            <AppText variant="label" color={colors.text}>
              Бүгд
            </AppText>
            <Ionicons
              name="chevron-down"
              size={14}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* Games grid */}
        <View style={styles.grid}>
          {GAMES.map((g) => (
            <Pressable
              key={g.title}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={open}
            >
              <View style={styles.cardTop}>
                <IconTile
                  icon={g.icon}
                  bg={g.tint.bg}
                  fg={g.tint.fg}
                  size={52}
                  iconSize={26}
                />
                <View style={styles.cardText}>
                  <AppText variant="h3" numberOfLines={1}>
                    {g.title}
                  </AppText>
                  <AppText variant="caption" numberOfLines={2}>
                    {g.desc}
                  </AppText>
                </View>
              </View>
              <Pill
                label="+10 XP"
                icon="flash"
                bg={tints.purple.bg}
                fg={colors.primary}
              />
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
              <AppText variant="h3">Амжилтын зам</AppText>
              <AppText variant="caption">Сорил тоглож, level ахицгаая!</AppText>
            </View>
            <Pill
              label={`Level ${LEVEL}`}
              bg={colors.primarySoft}
              fg={colors.primaryDark}
            />
          </View>

          <View style={styles.pathRow}>
            {PATH.map((n, i) => {
              const done = n < LEVEL;
              const current = n === LEVEL;
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
                        color={colors.white}
                      />
                    ) : last ? (
                      <Ionicons name="star" size={16} color={colors.xp} />
                    ) : (
                      <AppText
                        variant="label"
                        color={current ? colors.white : colors.textMuted}
                      >
                        {n}
                      </AppText>
                    )}
                  </View>
                  {!last && (
                    <View
                      style={[
                        styles.connector,
                        n < LEVEL && styles.connectorOn,
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.surface,
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
    minHeight: 210,
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  heroImg: { borderRadius: radius.xl },
  heroBody: { maxWidth: "60%" },
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
    backgroundColor: colors.white,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...(elevation.sm as object),
  },
  cardTop: { gap: spacing.sm },
  cardText: { gap: 2 },

  // Progress path
  pathCard: {
    backgroundColor: colors.surface,
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
  nodeOn: { backgroundColor: colors.primary },
  nodeOff: { backgroundColor: colors.surfaceAlt },
  nodeCurrent: { borderWidth: 3, borderColor: colors.primarySoft },
  connector: {
    flex: 1,
    height: 3,
    backgroundColor: colors.surfaceAlt,
    marginHorizontal: 2,
  },
  connectorOn: { backgroundColor: colors.primary },

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
