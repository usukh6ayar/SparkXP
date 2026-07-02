import { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { getMe } from "../api/auth";
import {
  getMatchPairs,
  submitQuiz,
  type MatchPair,
  type QuizResult,
} from "../api/wordQuiz";
import { TopBar } from "./TopBar";
import { AppText } from "./Text";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { t } from "../i18n";
import { spacing, radius, type AppColors } from "../theme/theme";
import { useColors } from "../settings/SettingsContext";

const PAIR_COUNT = 5;
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

/**
 * "Холбож ял" — a word↔meaning matching board. Distinct from the MCQ games:
 * the student pairs English words (left) to Mongolian meanings (right). Grading
 * reuses the vocab quiz endpoint (each pairing is submitted as wordId + choice).
 */
export function MatchGame() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, updateUser } = useAuth();
  const router = useRouter();

  const [pairs, setPairs] = useState<MatchPair[]>([]);
  const [rights, setRights] = useState<string[]>([]); // shuffled meanings
  const [assign, setAssign] = useState<Record<string, string>>({}); // wordId → meaning
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    setAssign({});
    setSelLeft(null);
    return getMatchPairs(token, PAIR_COUNT)
      .then((p) => {
        setPairs(p);
        setRights(shuffle(p.map((x) => x.mongolian)));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const allMatched = pairs.length > 0 && Object.keys(assign).length === pairs.length;

  function tapRight(meaning: string) {
    if (!selLeft || Object.values(assign).includes(meaning)) return;
    setAssign((a) => ({ ...a, [selLeft]: meaning }));
    setSelLeft(null);
  }

  async function submit() {
    if (!token || !allMatched) return;
    setSubmitting(true);
    const answers = pairs.map((p) => ({ wordId: p.wordId, choice: assign[p.wordId] }));
    try {
      const res = await submitQuiz(token, answers);
      setResult(res);
      getMe(token).then(updateUser).catch(() => {});
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <TopBar title={t("gameMatchTitle")} back />
        <View style={styles.board}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton height={52} radius={radius.lg} style={{ flex: 1 }} />
              <Skeleton height={52} radius={radius.lg} style={{ flex: 1 }} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (error || pairs.length < 2) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <TopBar title={t("gameMatchTitle")} back />
        <EmptyState
          icon="alert-circle-outline"
          title={t("error")}
          hint={t("quizLoadError")}
          action={{ label: t("retry"), onPress: load }}
        />
      </SafeAreaView>
    );
  }

  if (result) {
    const perfect = result.correct === result.total;
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <TopBar title={t("scoreTitle")} back />
        <View style={styles.center}>
          <AppText style={styles.emoji}>{perfect ? "🏆" : "🎉"}</AppText>
          <AppText variant="h1" center>
            {result.correct} / {result.total} {t("correctSuffix")}
          </AppText>
          <View style={styles.rewards}>
            <View style={[styles.rewardPill, { backgroundColor: colors.cream }]}>
              <Ionicons name="flash" size={16} color={colors.xp} />
              <AppText variant="label" color={colors.xp}>+{result.xpAwarded} XP</AppText>
            </View>
            <View style={[styles.rewardPill, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="diamond" size={16} color={colors.primary} />
              <AppText variant="label" color={colors.primary}>+{result.sparksAwarded}</AppText>
            </View>
          </View>
          <Button
            label={t("playAgain")}
            icon="refresh"
            onPress={() => {
              setResult(null);
              load();
            }}
            style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
          />
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <AppText variant="label" color={colors.textSecondary}>{t("backToQuizzes")}</AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <TopBar title={t("gameMatchTitle")} back />
      <AppText variant="caption" color={colors.textMuted} center style={styles.hint}>
        {t("matchHint")}
      </AppText>
      <ScrollView contentContainerStyle={styles.board} showsVerticalScrollIndicator={false}>
        {pairs.map((p) => {
          const selected = selLeft === p.wordId;
          const done = !!assign[p.wordId];
          return (
            <View key={p.wordId} style={styles.row}>
              {/* Left: English word */}
              <Pressable
                style={[styles.cell, selected && styles.cellSel, done && styles.cellDone]}
                onPress={() => setSelLeft(p.wordId)}
              >
                <AppText variant="bodyStrong" color={colors.text}>{p.english}</AppText>
                {done ? (
                  <AppText variant="caption" color={colors.primary}>→ {assign[p.wordId]}</AppText>
                ) : null}
              </Pressable>
            </View>
          );
        })}

        <View style={styles.divider} />

        {/* Right: shuffled meanings to assign */}
        <View style={styles.rightWrap}>
          {rights.map((m) => {
            const used = Object.values(assign).includes(m);
            return (
              <Pressable
                key={m}
                disabled={used}
                onPress={() => tapRight(m)}
                style={[styles.chip, used && styles.chipUsed]}
              >
                <AppText variant="label" color={used ? colors.textMuted : colors.text}>{m}</AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={submitting ? t("scoring") : t("submit")}
          onPress={submit}
          disabled={!allMatched || submitting}
        />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    emoji: { fontSize: 56, marginBottom: spacing.md },
    hint: { marginTop: spacing.xs, marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
    board: { padding: spacing.lg, gap: spacing.sm },
    row: { flexDirection: "row", gap: spacing.md },
    cell: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    cellSel: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    cellDone: { borderColor: colors.success, backgroundColor: colors.successSoft },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
    rightWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
    chip: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    chipUsed: { opacity: 0.35 },
    rewards: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    rewardPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
    },
    backLink: { marginTop: spacing.lg, padding: spacing.sm },
    footer: { padding: spacing.lg },
  });
