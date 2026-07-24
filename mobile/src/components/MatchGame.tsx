import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { AppIcon } from "./AppIcon";
import { useAuth } from "../auth/AuthContext";
import { getMe } from "../api/auth";
import {
  getMatchPairs,
  submitQuiz,
  type MatchPair,
  type QuizResult,
} from "../api/wordQuiz";
import { TopBar } from "./TopBar";
import { AwardBadge } from "./AwardBadge";
import { AppText } from "./Text";
import { Button } from "./Button";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { t } from "../i18n";
import { spacing, radius, type AppColors } from "../theme/theme";
import { useColors } from "../settings/SettingsContext";

const PAIR_COUNT = 5;
const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

// Card geometry — fixed so matched pairs can be connected with SVG lines whose
// endpoints are computed (no per-card measuring). H = card height, VGAP = the
// vertical gap between cards in a column, HGAP = the gutter between the columns.
const CARD_H = 64;
const VGAP = 12; // = spacing.md (kept in sync with the `col` gap)
const HGAP = 56; // wide gutter so the connecting curves have room to flow

/** One distinct colour per matched pair — the left card and its meaning both
 *  take the same colour so it's obvious which two are linked (no numbers).
 *  Translucent fills read well on both light and dark themes. */
const PAIR_COLORS: { fg: string; bg: string }[] = [
  { fg: "#7C4DFF", bg: "rgba(124,77,255,0.16)" },
  { fg: "#12B5A5", bg: "rgba(18,181,165,0.16)" },
  { fg: "#FF8A3D", bg: "rgba(255,138,61,0.16)" },
  { fg: "#FF5C8A", bg: "rgba(255,92,138,0.16)" },
  { fg: "#3D8BFF", bg: "rgba(61,139,255,0.16)" },
];

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
  const [boardW, setBoardW] = useState(0); // measured columns width → line geometry
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
          <AwardBadge icon={perfect ? "trophy" : "sparkles"} color={colors.white} bg={colors.primary} size={84} />
          <AppText variant="h1" center>
            {result.correct} / {result.total} {t("correctSuffix")}
          </AppText>
          <View style={styles.rewards}>
            <View style={[styles.rewardPill, { backgroundColor: colors.cream }]}>
              <AppIcon name="xp" size={16} />
              <AppText variant="label" color={colors.xp}>+{result.xpAwarded} XP</AppText>
            </View>
            <View style={[styles.rewardPill, { backgroundColor: colors.primarySoft }]}>
              <AppIcon name="sparks" size={16} />
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
        {/* Classic two-column match: tap an English word (left), then its meaning
            (right). A matched pair takes ONE shared colour on both cards, so it's
            obvious which two are linked — no numbers. Tap either half to unlink. */}
        <View style={styles.columns} onLayout={(e) => setBoardW(e.nativeEvent.layout.width)}>
          {/* Connecting lines drawn in the gutter between the columns — one per
              matched pair, in that pair's colour. Endpoints are computed from the
              fixed card height, so no per-card measuring is needed. */}
          {boardW > 0 ? (
            <Svg
              width={boardW}
              height={pairs.length * CARD_H + (pairs.length - 1) * VGAP}
              style={styles.lines}
              pointerEvents="none"
            >
              {pairs.map((p, i) => {
                const m = assign[p.wordId];
                if (!m) return null;
                const j = rights.indexOf(m);
                if (j < 0) return null;
                const colW = (boardW - HGAP) / 2;
                const pc = PAIR_COLORS[i % PAIR_COLORS.length];
                const x1 = colW;
                const y1 = i * (CARD_H + VGAP) + CARD_H / 2;
                const x2 = colW + HGAP;
                const y2 = j * (CARD_H + VGAP) + CARD_H / 2;
                // Cubic Bézier with horizontal handles → a smooth S-curve that
                // eases out of one card and into the other (not a hard diagonal).
                // Handles stay inside the gutter (≤ HGAP) so the whole curve is
                // visible between the columns.
                const cx = HGAP * 0.5;
                const d = `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`;
                return (
                  <Fragment key={p.wordId}>
                    <Path d={d} stroke={pc.fg} strokeWidth={3} fill="none" strokeLinecap="round" />
                    <Circle cx={x1} cy={y1} r={4} fill={pc.fg} />
                    <Circle cx={x2} cy={y2} r={4} fill={pc.fg} />
                  </Fragment>
                );
              })}
            </Svg>
          ) : null}

          {/* Left — English words */}
          <View style={styles.col}>
            {pairs.map((p, i) => {
              const done = !!assign[p.wordId];
              const selected = selLeft === p.wordId;
              const pc = done ? PAIR_COLORS[i % PAIR_COLORS.length] : null;
              return (
                <Pressable
                  key={p.wordId}
                  style={[styles.card, selected && styles.cardSel, pc && { borderColor: pc.fg, backgroundColor: pc.bg }]}
                  onPress={() => {
                    if (done) {
                      setAssign((a) => { const n = { ...a }; delete n[p.wordId]; return n; });
                      setSelLeft(null);
                    } else {
                      setSelLeft(p.wordId);
                    }
                  }}
                >
                  <AppText variant="bodyStrong" center numberOfLines={2}
                    color={pc ? pc.fg : selected ? colors.primary : colors.text}>
                    {p.english}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Right — Mongolian meanings (shuffled) */}
          <View style={styles.col}>
            {rights.map((m) => {
              const pairedId = Object.keys(assign).find((k) => assign[k] === m);
              const idx = pairedId ? pairs.findIndex((p) => p.wordId === pairedId) : -1;
              const pc = idx >= 0 ? PAIR_COLORS[idx % PAIR_COLORS.length] : null;
              return (
                <Pressable
                  key={m}
                  style={[styles.card, pc && { borderColor: pc.fg, backgroundColor: pc.bg }]}
                  onPress={() => {
                    if (pairedId) {
                      setAssign((a) => { const n = { ...a }; delete n[pairedId]; return n; });
                    } else if (selLeft) {
                      tapRight(m);
                    }
                  }}
                >
                  <AppText variant="bodyStrong" center numberOfLines={2}
                    color={pc ? pc.fg : colors.text}>
                    {m}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
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
    board: { padding: spacing.lg },
    row: { flexDirection: "row", gap: spacing.md },

    // Two columns of tappable cards (English ↔ Mongolian). A FIXED height keeps
    // left and right rows perfectly aligned so the board looks tidy; the wider
    // HGAP gutter gives the connecting lines room to breathe.
    columns: { flexDirection: "row", gap: HGAP },
    col: { flex: 1, gap: VGAP },
    // SVG line overlay sits behind the cards (lines show in the gutter).
    lines: { position: "absolute", top: 0, left: 0 },
    card: {
      height: 64, borderRadius: radius.lg,
      backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      alignItems: "center", justifyContent: "center",
      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    },
    cardSel: {
      borderColor: colors.primary, backgroundColor: colors.primarySoft,
      shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
    },
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
