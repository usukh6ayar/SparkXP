import { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth/AuthContext";
import { getStats } from "../../src/api/users";
import { getDue } from "../../src/api/reviews";
import { getLessons } from "../../src/api/lessons";
import { apiRequest } from "../../src/api/client";
import { getLastLesson, type LastLesson } from "../../src/lib/lastLesson";
import { AppText } from "../../src/components/Text";
import { ProgressBar } from "../../src/components/ProgressBar";
import { SectionHeader } from "../../src/components/SectionHeader";
import {
  colors,
  spacing,
  radius,
  tints,
  elevation,
} from "../../src/theme/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const banner = require("../../assets/home-banner.png");

// TODO: бодит утгуудаар солих (backend streak / daily-XP tracking)
const STREAK = 5;
const DAILY_GOAL = 50;
const TODAY_XP = 35;

const CATS: {
  key: string;
  label: string;
  en: string;
  icon: IconName;
  tint: { bg: string; fg: string };
  progress: number;
}[] = [
  {
    key: "listening",
    label: "Сонсгол",
    en: "Listening",
    icon: "headset",
    tint: tints.purple,
    progress: 0.45,
  },
  {
    key: "reading",
    label: "Унших",
    en: "Reading",
    icon: "book",
    tint: tints.green,
    progress: 0.6,
  },
  {
    key: "fill",
    label: "Нөхөх",
    en: "Fill in the blank",
    icon: "pencil",
    tint: tints.coral,
    progress: 0.3,
  },
  {
    key: "writing",
    label: "Бичих",
    en: "Writing",
    icon: "create",
    tint: tints.blue,
    progress: 0.5,
  },
];

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const firstName =
    user?.englishName?.trim() || (user?.fullName?.split(" ")[0] ?? "");

  const [xp, setXp] = useState(user?.xp ?? 0);
  const [sparks, setSparks] = useState(user?.sparks ?? 0);
  const [due, setDue] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cont, setCont] = useState<{ lesson: LastLesson; resume: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [stats, dueList, lessons] = await Promise.all([
        getStats(token),
        getDue(token),
        apiRequest<{ items: { type: string }[] }>(
          "/lessons?limit=100&isPublished=true",
          { token },
        ),
      ]);
      setXp(stats.xp);
      setSparks(stats.sparks);
      setDue(dueList.length);
      const c: Record<string, number> = {};
      lessons.items.forEach((l) => {
        c[l.type] = (c[l.type] ?? 0) + 1;
      });
      setCounts(c);
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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
        {/* Header: greeting + badges */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="h1">Сайн уу, {firstName} аа! 👋</AppText>
            <AppText
              variant="body"
              color={colors.textSecondary}
              style={styles.sub}
            >
              Өнөөдөр англи хэлийг хамтдаа урагшлуулцгаая!
            </AppText>
          </View>
          <View style={styles.badges}>
            <Badge
              icon="flame"
              color={colors.streak}
              value={STREAK}
              label="Цуврал"
            />
            <Badge
              icon="diamond"
              color={colors.sparks}
              value={sparks}
              label="Очирхон"
            />
          </View>
        </View>

        {/* Continue learning — primary action */}
        {cont ? (
          <Pressable
            style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}
            onPress={() => router.push(`/lesson/${cont.lesson.id}`)}
          >
            {cont.lesson.thumbnailUrl ? (
              <ImageBackground source={{ uri: cont.lesson.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={["rgba(18,10,40,0.80)", "rgba(18,10,40,0.30)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.continueBody}>
              <AppText variant="overline" color={colors.textOnDarkMuted}>
                {cont.resume ? "ҮРГЭЛЖЛҮҮЛЭХ" : "СУРАЛЦАЖ ЭХЛЭХ"}
              </AppText>
              <AppText variant="h2" color={colors.white} numberOfLines={2}>{cont.lesson.title}</AppText>
            </View>
            <View style={styles.continuePlay}>
              <Ionicons name="play" size={22} color={colors.primary} style={{ marginLeft: 3 }} />
            </View>
          </Pressable>
        ) : null}

        {/* Daily goal hero — banner image as full background */}
        <ImageBackground
          source={banner}
          style={styles.hero}
          imageStyle={styles.heroImg}
          resizeMode="cover"
        >
          <View style={styles.heroText}>
            <AppText variant="bodyStrong" color={colors.textOnDark}>
              Өнөөдрийн зорилго
            </AppText>
            <AppText
              variant="display"
              color={colors.white}
              style={styles.heroGoal}
            >
              {DAILY_GOAL} XP
            </AppText>
            <ProgressBar
              value={TODAY_XP / DAILY_GOAL}
              color={colors.white}
              track="rgba(255,255,255,0.35)"
              height={10}
              style={styles.heroBar}
            />
            <AppText variant="caption" color={colors.textOnDark}>
              {TODAY_XP} / {DAILY_GOAL} XP
            </AppText>
          </View>
        </ImageBackground>

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

        {/* Learn categories */}
        <SectionHeader
          title="Юу сурах вэ?"
          actionLabel="Бүгдийг харах ›"
          onAction={() => router.push("/(tabs)/lessons")}
          style={styles.section}
        />
        <View style={styles.grid}>
          {CATS.map((c) => (
            <Pressable
              key={c.key}
              style={({ pressed }) => [
                styles.cat,
                { backgroundColor: c.tint.bg },
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/lessons",
                  params: { type: c.key },
                })
              }
            >
              <View style={styles.catTop}>
                <View style={styles.catIcon}>
                  <Ionicons name={c.icon} size={20} color={c.tint.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3" numberOfLines={1}>
                    {c.label}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {c.en}
                  </AppText>
                </View>
              </View>
              <ProgressBar
                value={c.progress}
                color={c.tint.fg}
                track="rgba(255,255,255,0.7)"
                height={6}
                style={styles.catBar}
              />
              <AppText variant="caption" style={styles.catCount}>
                {counts[c.key] ?? 0} хичээл
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* Stats summary */}
        <View style={styles.statsCard}>
          <StatCol
            icon="flash"
            color={colors.xp}
            value={xp.toLocaleString()}
            label="XP оноо"
          />
          <View style={styles.statDivider} />
          <StatCol
            icon="diamond"
            color={colors.sparks}
            value={sparks}
            label="Очирхон"
          />
          <View style={styles.statDivider} />
          <StatCol
            icon="flame"
            color={colors.streak}
            value={`${STREAK} өдөр`}
            label="Цуврал"
          />
        </View>
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({
  icon,
  color,
  value,
  label,
}: {
  icon: IconName;
  color: string;
  value: number | string;
  label: string;
}) {
  return (
    <View style={styles.badge}>
      <View style={styles.badgeTop}>
        <Ionicons name={icon} size={16} color={color} />
        <AppText variant="h3">{value}</AppText>
      </View>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

function StatCol({
  icon,
  color,
  value,
  label,
}: {
  icon: IconName;
  color: string;
  value: number | string;
  label: string;
}) {
  return (
    <View style={styles.statCol}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View>
        <AppText variant="h3" numberOfLines={1}>
          {value}
        </AppText>
        <AppText variant="caption">{label}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headerText: { flex: 1, paddingTop: 2 },
  sub: { marginTop: 4 },
  badges: { flexDirection: "row", gap: spacing.sm },
  badge: {
    alignItems: "center",
    minWidth: 76,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...(elevation.sm as object),
  },
  badgeTop: { flexDirection: "row", alignItems: "center", gap: 5 },

  continueCard: {
    height: 132,
    borderRadius: radius.xl,
    overflow: "hidden",
    marginTop: spacing.lg,
    backgroundColor: colors.navy,
    justifyContent: "flex-end",
    ...(elevation.md as object),
  },
  continueBody: { padding: spacing.lg, paddingRight: 80, gap: 2 },
  continuePlay: {
    position: "absolute",
    right: spacing.lg,
    top: "50%",
    marginTop: -26,
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...(elevation.sm as object),
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    overflow: "hidden",
    minHeight: 180,
    justifyContent: "center",
    backgroundColor: colors.primary, // зураг ачаалагдах хүртэлх fallback
  },
  heroImg: { borderRadius: radius.xl },
  heroText: { maxWidth: "62%" },
  heroGoal: { marginTop: 2, marginBottom: spacing.md },
  heroBar: { marginBottom: spacing.sm },

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
  reviewBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
  },

  section: { marginTop: spacing.xl },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
  },
  cat: { width: "48.5%", borderRadius: radius.lg, padding: spacing.md },
  catTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  catBar: { marginBottom: spacing.xs },
  catCount: { alignSelf: "flex-end" },

  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...(elevation.sm as object),
  },
  statCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },

  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
