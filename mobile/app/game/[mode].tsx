import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import { useAuth } from "../../src/auth/AuthContext";
import { getMe } from "../../src/api/auth";
import {
  getQuiz,
  submitQuiz,
  type QuizQuestion,
  type QuizResult,
} from "../../src/api/wordQuiz";
import { MatchGame } from "../../src/components/MatchGame";
import { TopBar } from "../../src/components/TopBar";
import { AppText } from "../../src/components/Text";
import { Skeleton } from "../../src/components/Skeleton";
import { EmptyState } from "../../src/components/EmptyState";
import { Button } from "../../src/components/Button";
import { ProgressBar } from "../../src/components/ProgressBar";
import { t, type TranslationKey } from "../../src/i18n";
import { spacing, radius, elevation, type AppColors } from "../../src/theme/theme";
import { useColors } from "../../src/settings/SettingsContext";

const QUESTION_COUNT = 10;
const SPEED_SECONDS = 8; // per-question countdown for the "Хурдан бууд" mode

/**
 * Vocab MCQ mini-games that share the `/words/quiz` data + server grading:
 *   • classic — show the English word, pick the meaning (Үг ангууч)
 *   • speed   — same, but a per-question countdown (Хурдан бууд)
 *   • listen  — HEAR the word (real audio, else device TTS), pick the meaning
 *               (Сонсож барь) — the word is never shown, so it stays a real
 *               listening test even for words with no recorded audio.
 * The "match" game is a different mechanic (see MatchGame), routed separately.
 */
type McMode = "classic" | "speed" | "listen";
const MODES: Record<McMode, { titleKey: TranslationKey; timed: boolean; audio: boolean }> = {
  classic: { titleKey: "gameVocabQuizTitle", timed: false, audio: false },
  speed: { titleKey: "gameSpeedTitle", timed: true, audio: false },
  listen: { titleKey: "gameListenTitle", timed: false, audio: true },
};

/** Route entry: pick the right game for the `mode` param. */
export default function GameScreen() {
  const { mode } = useLocalSearchParams<{ mode: string }>();
  if (mode === "match") return <MatchGame />;
  const mcMode: McMode = mode === "speed" || mode === "listen" ? mode : "classic";
  return <VocabGame mode={mcMode} />;
}

function VocabGame({ mode }: { mode: McMode }) {
  const cfg = MODES[mode];
  const title = t(cfg.titleKey);

  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, updateUser } = useAuth();
  const router = useRouter();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(SPEED_SECONDS);
  const player = useAudioPlayer();

  // Listen mode: play the word's recorded audio, or speak it with device TTS
  // (so it works even when the word has no audioUrl).
  const speak = useCallback(
    (q: QuizQuestion | undefined) => {
      if (!q) return;
      if (q.audioUrl) {
        try {
          player.replace({ uri: q.audioUrl });
          player.play();
          return;
        } catch {
          /* fall through to TTS */
        }
      }
      Speech.stop();
      Speech.speak(q.english, { language: "en-US", rate: 0.9 });
    },
    [player],
  );

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(false);
    return getQuiz(token, QUESTION_COUNT)
      .then(setQuestions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const finish = useCallback(
    async (allChoices: Record<string, string>) => {
      if (!token) return;
      setSubmitting(true);
      const answers = Object.entries(allChoices).map(([wordId, choice]) => ({
        wordId,
        choice,
      }));
      try {
        const res = await submitQuiz(token, answers);
        setResult(res);
        getMe(token).then(updateUser).catch(() => {});
      } catch {
        setError(true);
      } finally {
        setSubmitting(false);
      }
    },
    [token, updateUser],
  );

  // Advance to the next question, recording `choice` for the current word
  // (an empty string when the speed timer runs out → graded as wrong).
  const advance = useCallback(
    (choice: string) => {
      const q = questions[index];
      if (!q) return;
      const nextChoices = { ...choices, [q.wordId]: choice };
      setChoices(nextChoices);
      setTimeout(() => {
        if (index + 1 < questions.length) {
          setIndex((i) => i + 1);
          setPicked(null);
          setTimeLeft(SPEED_SECONDS);
        } else {
          finish(nextChoices);
        }
      }, 220);
    },
    [questions, index, choices, finish],
  );

  function pick(option: string) {
    if (!questions[index] || picked) return;
    setPicked(option);
    advance(option);
  }

  // Speed mode: count down; on 0, auto-record a miss and move on.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  useEffect(() => {
    if (!cfg.timed || loading || result || picked || questions.length === 0) return;
    if (timeLeft <= 0) {
      setPicked("__timeout__");
      advanceRef.current("");
      return;
    }
    const id = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cfg.timed, loading, result, picked, questions.length, timeLeft]);

  // Listen mode: speak the current word when it appears.
  useEffect(() => {
    if (!cfg.audio || loading || result) return;
    speak(questions[index]);
  }, [cfg.audio, loading, result, index, questions, speak]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <TopBar title={title} back />
        <View style={styles.body}>
          <View style={styles.prompt}>
            <Skeleton width={120} height={14} style={{ marginBottom: spacing.md }} />
            <Skeleton width={200} height={36} />
          </View>
          <View style={styles.options}>
            <Skeleton height={64} radius={radius.lg} />
            <Skeleton height={64} radius={radius.lg} />
            <Skeleton height={64} radius={radius.lg} />
            <Skeleton height={64} radius={radius.lg} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <TopBar title={title} back />
        <EmptyState
          icon="alert-circle-outline"
          title={t("error")}
          hint={t("quizLoadError")}
          action={{ label: t("retry"), onPress: load }}
        />
      </SafeAreaView>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────
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
              <AppText variant="label" color={colors.xp}>
                +{result.xpAwarded} XP
              </AppText>
            </View>
            <View style={[styles.rewardPill, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="diamond" size={16} color={colors.primary} />
              <AppText variant="label" color={colors.primary}>
                +{result.sparksAwarded}
              </AppText>
            </View>
          </View>
          <Button
            label={t("playAgain")}
            icon="refresh"
            onPress={() => {
              setResult(null);
              setIndex(0);
              setChoices({});
              setPicked(null);
              setTimeLeft(SPEED_SECONDS);
              load();
            }}
            style={{ marginTop: spacing.xl, alignSelf: "stretch" }}
          />
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <AppText variant="label" color={colors.textSecondary}>
              {t("backToQuizzes")}
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Question screen ──────────────────────────────────────────────────────
  const q = questions[index];
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <TopBar title={title} back />

      <View style={styles.progressWrap}>
        <ProgressBar
          value={(index + (picked ? 1 : 0)) / questions.length}
          color={colors.primary}
        />
        <AppText variant="caption" style={styles.progressText}>
          {index + 1} / {questions.length}
        </AppText>
      </View>

      {/* Speed mode: per-question countdown */}
      {cfg.timed ? (
        <View style={styles.timerWrap}>
          <Ionicons
            name="timer-outline"
            size={16}
            color={timeLeft <= 3 ? colors.danger : colors.textSecondary}
          />
          <View style={styles.timerBar}>
            <ProgressBar
              value={timeLeft / SPEED_SECONDS}
              color={timeLeft <= 3 ? colors.danger : colors.primary}
              height={6}
            />
          </View>
          <AppText
            variant="label"
            color={timeLeft <= 3 ? colors.danger : colors.textSecondary}
          >
            {timeLeft}
          </AppText>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.prompt}>
          <AppText variant="caption" color={colors.textMuted}>
            {t("whatDoesItMean")}
          </AppText>
          {cfg.audio ? (
            // Listen mode: a play button instead of the written word.
            <Pressable style={styles.playBtn} onPress={() => speak(q)}>
              <Ionicons name="volume-high" size={44} color={colors.white} />
            </Pressable>
          ) : (
            <>
              <AppText style={styles.word}>{q.english}</AppText>
              {q.phonetic ? (
                <AppText variant="body" color={colors.textMuted}>
                  {q.phonetic}
                </AppText>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.options}>
          {q.options.map((opt) => {
            const selected = picked === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => pick(opt)}
                disabled={!!picked}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <AppText variant="h3" color={selected ? colors.primary : colors.text}>
                  {opt}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {submitting ? (
        <View style={styles.submitting}>
          <AppText variant="label" color={colors.textSecondary}>
            {t("scoring")}
          </AppText>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    emoji: { fontSize: 56, marginBottom: spacing.md },
    progressWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xs },
    progressText: { textAlign: "right", marginTop: spacing.xs },
    timerWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
    timerBar: { flex: 1 },
    body: { padding: spacing.lg, flexGrow: 1, justifyContent: "center" },
    prompt: { alignItems: "center", marginBottom: spacing.xxl },
    playBtn: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: spacing.md,
      ...(elevation.md as object),
    },
    word: {
      fontSize: 36,
      lineHeight: 42,
      fontWeight: "800",
      color: colors.navy,
      marginTop: spacing.xs,
      textAlign: "center",
    },
    options: { gap: spacing.md },
    option: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      alignItems: "center",
      ...(elevation.sm as object),
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
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
    submitting: { padding: spacing.lg, alignItems: "center" },
  });
