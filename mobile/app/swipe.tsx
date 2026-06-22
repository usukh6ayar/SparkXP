import { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Animated, PanResponder, Dimensions, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useAuth } from '../src/auth/AuthContext';
import {
  getLearnQueue, submitReview, type LearnWord,
} from '../src/api/reviews';
import { AppText } from '../src/components/Text';
import { Loading } from '../src/components/Loading';
import { Button } from '../src/components/Button';
import { ProgressBar } from '../src/components/ProgressBar';
import { VocabCard } from '../src/components/VocabCard';
import { colors, spacing, radius, elevation } from '../src/theme/theme';

const SCREEN_W = Dimensions.get('window').width;
const THRESHOLD = SCREEN_W * 0.25;
const OUT_DURATION = 300;

/** SM-2 quality per verdict. */
const QUALITY = { forgot: 1, know: 5 } as const;
type Verdict = keyof typeof QUALITY;

/**
 * Flashcard review (design spec): Tinder-style swipe deck for vocabulary.
 * - Swipe RIGHT / "Мэднэ"     → quality 5, card leaves the deck.
 * - Swipe LEFT  / "Мэдэхгүй"  → quality 1, card returns to the back.
 * Card stack, swipe tint + rotation, first-run gesture hint, haptics.
 * Only published, not-yet-known words come from the server.
 */
export default function SwipeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [queue, setQueue] = useState<LearnWord[]>([]);
  const [total, setTotal] = useState(0);
  const [known, setKnown] = useState(0);
  const [loading, setLoading] = useState(true);

  const position = useRef(new Animated.ValueXY()).current;
  const player = useAudioPlayer();
  const queueRef = useRef<LearnWord[]>([]);
  queueRef.current = queue;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return;
    getLearnQueue(token)
      .then((q) => { setQueue(q); setTotal(q.length); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Gesture affordance: as each new card lands on top, give it a subtle
  // left↔right nudge so the user sees it can be swiped both ways.
  const topId = queue[0]?.id;
  useEffect(() => {
    if (loading || !topId) return;
    position.setValue({ x: 0, y: 0 });
    const wiggle = Animated.sequence([
      Animated.timing(position, { toValue: { x: -10, y: 0 }, duration: 180, useNativeDriver: false }),
      Animated.timing(position, { toValue: { x: 10, y: 0 }, duration: 260, useNativeDriver: false }),
      Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }),
    ]);
    wiggle.start();
    return () => wiggle.stop();
  }, [topId, loading, position]);

  function playAudio() {
    const card = queueRef.current[0];
    if (!card) return;
    // Prefer an uploaded audio file; otherwise speak the word with device TTS
    // so pronunciation works for every word without any audio content.
    if (card.audioUrl) {
      try { player.replace({ uri: card.audioUrl }); player.play(); return; } catch { /* fall through to TTS */ }
    }
    Speech.stop();
    Speech.speak(card.english, { language: 'en-US', rate: 0.9 });
  }

  function haptic(v: Verdict) {
    if (v === 'know') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function resolve(v: Verdict) {
    const card = queueRef.current[0];
    if (!card) return;
    const t = tokenRef.current;
    if (t) submitReview(t, card.id, QUALITY[v]).catch(() => {});
    if (v === 'know') {
      setKnown((k) => k + 1);
      setQueue((q) => q.slice(1)); // mastered → remove
    } else {
      setQueue((q) => [...q.slice(1), card]); // forgot / unsure → back of deck
    }
    position.setValue({ x: 0, y: 0 });
  }

  /** Animate the top card away, then apply the verdict. */
  function fling(v: Verdict) {
    haptic(v);
    const to = v === 'know'
      ? { x: SCREEN_W * 1.4, y: 0 }
      : { x: -SCREEN_W * 1.4, y: 0 };
    Animated.timing(position, { toValue: to, duration: OUT_DURATION, useNativeDriver: false })
      .start(() => resolve(v));
  }

  function reset() {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > THRESHOLD) fling('know');
        else if (g.dx < -THRESHOLD) fling('forgot');
        else reset();
      },
    }),
  ).current;

  if (loading) return <Loading />;

  const current = queue[0];
  const next = queue[1];

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_W * 1.4, 0, SCREEN_W * 1.4],
    outputRange: ['-12deg', '0deg', '12deg'],
  });
  const knowTint = position.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 0.18], extrapolate: 'clamp' });
  const forgotTint = position.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [0.18, 0], extrapolate: 'clamp' });

  const done = Math.min(known, total);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
        </Pressable>
        <AppText variant="h3" color={colors.navy}>
          {done} <AppText variant="h3" color={colors.textMuted}>/ {total}</AppText>
        </AppText>
        <View style={styles.xpPill}>
          <Ionicons name="flash" size={15} color={colors.xp} />
          <AppText variant="label" color={colors.navy}>{user?.xp ?? 0}</AppText>
        </View>
      </View>
      <View style={styles.progressWrap}>
        <ProgressBar value={total > 0 ? done / total : 0} color={colors.primary} />
      </View>

      {!current ? (
        <View style={styles.done}>
          <AppText style={styles.doneEmoji}>🎉</AppText>
          <AppText variant="h1" center style={styles.doneTitle}>Бүх үгийг давтлаа!</AppText>
          <AppText variant="body" color={colors.textSecondary} center>Энэ удаад {known} үг сурлаа.</AppText>
          <Button label="Нүүр рүү" icon="home" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
        </View>
      ) : (
        <View style={styles.deck}>
          {/* Next card peek (8px lower, 97%) */}
          {next ? (
            <View style={[styles.cardWrap, styles.cardBehind]} pointerEvents="none">
              <VocabCard word={next} onPlayAudio={() => {}} />
            </View>
          ) : null}

          {/* Current card */}
          <Animated.View
            {...pan.panHandlers}
            style={[
              styles.cardWrap,
              { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
            ]}
          >
            <VocabCard word={current} onPlayAudio={playAudio} />
            {/* swipe tint overlays */}
            <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: colors.success, opacity: knowTint }]} />
            <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: colors.danger, opacity: forgotTint }]} />
          </Animated.View>
        </View>
      )}

      {/* ── Gesture hint + 3 pill actions ────────────────────────────── */}
      {current ? (
        <>
          <View style={styles.hint}>
            <AppText variant="caption" color={colors.danger}>← Мэдэхгүй</AppText>
            <Ionicons name="hand-left-outline" size={16} color={colors.textMuted} />
            <AppText variant="caption" color={colors.success}>Мэднэ →</AppText>
          </View>
          <View style={styles.actions}>
            <Pressable style={[styles.pill, styles.pillForgot]} onPress={() => fling('forgot')}>
              <AppText style={styles.pillEmoji}>😵</AppText>
              <AppText variant="label" color={colors.danger}>Мэдэхгүй</AppText>
            </Pressable>
            <Pressable style={[styles.pill, styles.pillKnow]} onPress={() => fling('know')}>
              <AppText style={styles.pillEmoji}>✅</AppText>
              <AppText variant="label" color={colors.success}>Мэднэ</AppText>
            </Pressable>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', ...(elevation.sm as object),
  },
  xpPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full, ...(elevation.sm as object),
  },
  progressWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  deck: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  cardWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  cardBehind: { transform: [{ scale: 0.97 }, { translateY: 8 }], opacity: 0.6 },
  tint: { ...StyleSheet.absoluteFillObject, borderRadius: radius.xl },
  hint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, paddingBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg,
  },
  pill: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: radius.full, borderWidth: 1.5, ...(elevation.sm as object),
  },
  pillEmoji: { fontSize: 16 },
  pillForgot: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  pillKnow: { borderColor: colors.success, backgroundColor: colors.successSoft },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneEmoji: { fontSize: 56 },
  doneTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
});
