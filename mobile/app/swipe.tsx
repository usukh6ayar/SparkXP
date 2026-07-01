import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useAuth } from '../src/auth/AuthContext';
import { getLearnQueue, submitReview, toggleSave, type LearnWord } from '../src/api/reviews';
import { getGamification } from '../src/api/gamification';
import { AppText } from '../src/components/Text';
import { Loading } from '../src/components/Loading';
import { ProgressBar } from '../src/components/ProgressBar';
import { FlashCard, type MemoryStatus } from '../src/components/FlashCard';
import { ReviewStats } from '../src/components/ReviewStats';
import { t } from '../src/i18n';
import { colors, spacing, radius, elevation } from '../src/theme/theme';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const CARD_H = Math.min(Math.round(SCREEN_H * 0.6), 540);
const THRESH_X = SCREEN_W * 0.28;
const THRESH_Y = SCREEN_H * 0.16;

type Verdict = 'know' | 'review' | 'favorite';

export default function ReviewFlashcardsScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [queue, setQueue] = useState<LearnWord[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [streak, setStreak] = useState(0);
  const [known, setKnown] = useState(0);
  const [review, setReview] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  const player = useAudioPlayer();
  const audioStatus = useAudioPlayerStatus(player);
  const speaking = ttsSpeaking || audioStatus.playing;

  // Reanimated (UI thread → 60fps).
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const spin = useSharedValue(0); // top card flip
  const zero = useSharedValue(0); // behind card is always front
  const flipped = useRef(false);

  const total = queue.length;
  const stateRef = useRef({ index: 0 });
  stateRef.current = { index };

  useEffect(() => {
    if (!token) return;
    getLearnQueue(token).then(setQueue).catch(() => {}).finally(() => setLoading(false));
    getGamification(token).then((g) => setStreak(g.currentStreak)).catch(() => {});
  }, [token]);

  const current = queue[index];
  const next = queue[index + 1];
  const done = total > 0 && index >= total;

  /* ── Audio ─────────────────────────────────────────────────────────────── */
  function playAudio(word?: LearnWord) {
    const w = word ?? queue[stateRef.current.index];
    if (!w) return;
    if (w.audioUrl) {
      try {
        player.replace({ uri: w.audioUrl });
        player.play();
        return;
      } catch {
        /* fall through to TTS */
      }
    }
    setTtsSpeaking(true);
    Speech.stop();
    Speech.speak(w.english, {
      language: 'en-US',
      rate: 0.9,
      onDone: () => setTtsSpeaking(false),
      onStopped: () => setTtsSpeaking(false),
      onError: () => setTtsSpeaking(false),
    });
  }

  /* ── Flip (tap) ────────────────────────────────────────────────────────── */
  function flip() {
    flipped.current = !flipped.current;
    spin.value = withSpring(flipped.current ? 1 : 0, { damping: 22, stiffness: 140, overshootClamping: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  /* ── Verdict side-effects + advance ───────────────────────────────────── */
  function haptic(kind: Verdict) {
    if (kind === 'know') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'review') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function applyVerdict(kind: Verdict) {
    const w = queue[stateRef.current.index];
    if (!w) return;
    if (kind === 'know') {
      if (token) submitReview(token, w.id, 5).catch(() => {});
      setKnown((k) => k + 1);
      setXpEarned((x) => x + 10);
    } else if (kind === 'review') {
      if (token) submitReview(token, w.id, 1).catch(() => {});
      setReview((r) => r + 1);
      setXpEarned((x) => x + 2);
    } else if (kind === 'favorite') {
      if (token && !w.saved) toggleSave(token, w.id).catch(() => {});
      setQueue((q) => q.map((x, i) => (i === stateRef.current.index ? { ...x, saved: true } : x)));
    }
  }

  function afterFling(kind: Verdict) {
    applyVerdict(kind);
    flipped.current = false;
    spin.value = 0;
    tx.value = 0;
    ty.value = 0;
    setIndex((i) => i + 1);
  }

  function fling(kind: Verdict) {
    const cfg = { duration: 230 } as const;
    const cb = (fin?: boolean) => {
      'worklet';
      if (fin) runOnJS(afterFling)(kind);
    };
    if (kind === 'know') {
      ty.value = withTiming(ty.value + 40, cfg);
      tx.value = withTiming(SCREEN_W * 1.5, cfg, cb);
    } else if (kind === 'review') {
      ty.value = withTiming(ty.value + 40, cfg);
      tx.value = withTiming(-SCREEN_W * 1.5, cfg, cb);
    } else {
      // favorite (swipe up)
      tx.value = withTiming(tx.value, cfg);
      ty.value = withTiming(-SCREEN_H * 1.2, cfg, cb);
    }
  }

  function handleEnd(dx: number, dy: number, vx: number, vy: number) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX >= absY) {
      if (dx > THRESH_X || vx > 900) return void (haptic('know'), fling('know'));
      if (dx < -THRESH_X || vx < -900) return void (haptic('review'), fling('review'));
    } else if (dy < -THRESH_Y || vy < -900) {
      // Swipe up = favorite. Swipe down does nothing → springs back.
      return void (haptic('favorite'), fling('favorite'));
    }
    tx.value = withSpring(0, { damping: 18, stiffness: 150 });
    ty.value = withSpring(0, { damping: 18, stiffness: 150 });
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(handleEnd)(e.translationX, e.translationY, e.velocityX, e.velocityY);
    });

  function onToggleSave() {
    const w = queue[index];
    if (!w) return;
    setQueue((q) => q.map((x, i) => (i === index ? { ...x, saved: !x.saved } : x)));
    if (token) toggleSave(token, w.id).catch(() => {});
  }

  function memOf(w: LearnWord): MemoryStatus {
    return w.saved ? 'learning' : 'new';
  }

  /* ── Animated styles ──────────────────────────────────────────────────── */
  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${interpolate(tx.value, [-SCREEN_W, 0, SCREEN_W], [-10, 0, 10], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const behindStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(Math.abs(tx.value), Math.abs(ty.value)) / THRESH_X, 1);
    return {
      transform: [{ scale: 0.94 + 0.06 * p }, { translateY: 14 * (1 - p) }],
      opacity: 0.55 + 0.45 * p,
    };
  });
  const knowTint = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, THRESH_X], [0, 0.28], Extrapolation.CLAMP) }));
  const reviewTint = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-THRESH_X, 0], [0.28, 0], Extrapolation.CLAMP) }));
  const favTint = useAnimatedStyle(() => ({ opacity: interpolate(ty.value, [-THRESH_Y, 0], [0.26, 0], Extrapolation.CLAMP) }));
  const knowStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [10, THRESH_X], [0, 1], Extrapolation.CLAMP) }));
  const reviewStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [-THRESH_X, -10], [1, 0], Extrapolation.CLAMP) }));
  const favStamp = useAnimatedStyle(() => ({ opacity: interpolate(ty.value, [-THRESH_Y, -10], [1, 0], Extrapolation.CLAMP) }));

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <AppText variant="label" color={colors.textMuted}>{t('reviewWords')}</AppText>
          {total > 0 && !done ? <AppText variant="h3">{Math.min(index + 1, total)} / {total}</AppText> : null}
        </View>
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={15} color={colors.streak} />
          <AppText variant="label">{streak}</AppText>
        </View>
      </View>
      {!done ? (
        <View style={styles.progressWrap}>
          <ProgressBar value={total > 0 ? index / total : 0} color={colors.primary} />
        </View>
      ) : null}

      {total === 0 ? (
        <View style={styles.empty}>
          <AppText style={styles.emoji}>🎉</AppText>
          <AppText variant="h2" center>{t('noReviews')}</AppText>
          <AppText variant="body" center color={colors.textSecondary} style={{ marginTop: 4 }}>{t('noReviewsHint')}</AppText>
        </View>
      ) : done ? (
        <ReviewStats known={known} review={review} xpEarned={xpEarned} streak={streak} onContinue={() => router.back()} />
      ) : (
        <View style={styles.deck}>
          <View style={styles.stack}>
            {/* Behind (next) card */}
            {next ? (
              <Animated.View style={[StyleSheet.absoluteFill, behindStyle]} pointerEvents="none">
                <FlashCard word={next} spin={zero} speaking={false} saved={next.saved} memory={memOf(next)} onToggleSave={() => {}} onPlayAudio={() => {}} />
              </Animated.View>
            ) : null}

            {/* Top card */}
            <GestureDetector gesture={pan}>
              <Animated.View style={[StyleSheet.absoluteFill, topStyle]}>
                <Pressable style={styles.press} onPress={flip} onLongPress={() => playAudio(current)} delayLongPress={280}>
                  {current ? (
                    <FlashCard
                      word={current}
                      spin={spin}
                      speaking={speaking}
                      saved={current.saved}
                      memory={memOf(current)}
                      onToggleSave={onToggleSave}
                      onPlayAudio={() => playAudio(current)}
                    />
                  ) : null}

                  {/* Colored tints */}
                  <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: colors.success }, knowTint]} />
                  <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: colors.danger }, reviewTint]} />
                  <Animated.View pointerEvents="none" style={[styles.tint, { backgroundColor: colors.xp }, favTint]} />

                  {/* Stamps */}
                  <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampLeft, { borderColor: colors.success, transform: [{ rotate: '-16deg' }] }, knowStamp]}>
                    <AppText style={[styles.stampText, { color: colors.success }]}>✓ {t('swipeKnow')}</AppText>
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampRight, { borderColor: colors.danger, transform: [{ rotate: '16deg' }] }, reviewStamp]}>
                    <AppText style={[styles.stampText, { color: colors.danger }]}>✕ {t('swipeReview')}</AppText>
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampTop, { borderColor: colors.xp }, favStamp]}>
                    <AppText style={[styles.stampText, { color: colors.xp }]}>♥ {t('swipeFav')}</AppText>
                  </Animated.View>
                </Pressable>
              </Animated.View>
            </GestureDetector>
          </View>

          <AppText variant="caption" color={colors.textMuted} center style={styles.hint}>
            {t('swipeCardHint')}
          </AppText>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm,
  },
  headerCenter: { alignItems: 'center' },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', ...(elevation.sm as object),
  },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.full, ...(elevation.sm as object),
  },
  progressWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },

  deck: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  stack: { width: SCREEN_W - spacing.lg * 2, height: CARD_H },
  press: { flex: 1 },
  tint: { ...StyleSheet.absoluteFillObject, borderRadius: 30 },
  stamp: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: 'rgba(15,10,40,0.25)',
  },
  stampLeft: { top: 28, left: 24 },
  stampRight: { top: 28, right: 24 },
  stampTop: { top: 20, alignSelf: 'center' },
  stampText: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  hint: { marginTop: spacing.lg },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.md },
});
