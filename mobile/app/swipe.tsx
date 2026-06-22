import { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Animated, PanResponder, Dimensions, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useAuth } from '../src/auth/AuthContext';
import {
  getLearnQueue, markKnown, markForgot, toggleSave, type LearnWord,
} from '../src/api/reviews';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { Loading } from '../src/components/Loading';
import { Button } from '../src/components/Button';
import { ProgressBar } from '../src/components/ProgressBar';
import { VocabCard } from '../src/components/VocabCard';
import { colors, spacing, radius, elevation } from '../src/theme/theme';

const SCREEN_W = Dimensions.get('window').width;
const THRESHOLD = SCREEN_W * 0.25;
const OUT_DURATION = 250;

/**
 * Vocabulary swipe learning (design mockup zurag.jpg).
 * - Swipe RIGHT / "Know"   → mark known (quality 5), card leaves the deck.
 * - Swipe LEFT  / "Forgot" → mark forgot (quality 1), card goes to the back.
 * - ⭐ tap → save/unsave the word.
 * - 🔊 tap → play the word's pronunciation.
 * Only published words come back from the server. Loops until all are known.
 */
export default function SwipeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [queue, setQueue] = useState<LearnWord[]>([]);
  const [known, setKnown] = useState(0);
  const [loading, setLoading] = useState(true);

  const position = useRef(new Animated.ValueXY()).current;
  const player = useAudioPlayer();
  // Refs so the (once-created) PanResponder always reads the latest values.
  const queueRef = useRef<LearnWord[]>([]);
  queueRef.current = queue;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!token) return;
    getLearnQueue(token)
      .then(setQueue)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function playAudio() {
    const url = queueRef.current[0]?.audioUrl;
    if (!url) return;
    try {
      player.replace({ uri: url });
      player.play();
    } catch {
      // audio is non-critical — ignore playback errors
    }
  }

  function onToggleSave() {
    const card = queueRef.current[0];
    if (!card) return;
    // optimistic flip on the visible card
    setQueue((q) =>
      q.map((w, i) => (i === 0 ? { ...w, saved: !w.saved } : w)),
    );
    const t = tokenRef.current;
    if (t) toggleSave(t, card.id).catch(() => {});
  }

  function handleSwipe(dir: 'left' | 'right') {
    const card = queueRef.current[0];
    if (!card) return;
    const t = tokenRef.current;
    if (dir === 'right') {
      if (t) markKnown(t, card.id).catch(() => {});
      setKnown((k) => k + 1);
      setQueue((q) => q.slice(1)); // known → remove
    } else {
      if (t) markForgot(t, card.id).catch(() => {});
      setQueue((q) => [...q.slice(1), card]); // forgot → back of deck
    }
    position.setValue({ x: 0, y: 0 });
  }

  function forceSwipe(dir: 'left' | 'right') {
    Animated.timing(position, {
      toValue: { x: dir === 'right' ? SCREEN_W * 1.4 : -SCREEN_W * 1.4, y: 0 },
      duration: OUT_DURATION,
      useNativeDriver: false,
    }).start(() => handleSwipe(dir));
  }

  function reset() {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > THRESHOLD) forceSwipe('right');
        else if (g.dx < -THRESHOLD) forceSwipe('left');
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
  const knowOpacity = position.x.interpolate({ inputRange: [0, THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const dontOpacity = position.x.interpolate({ inputRange: [-THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  const total = known + queue.length;
  const progress = total > 0 ? known / total : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar title="Үг сурах" back />

      <View style={styles.counterWrap}>
        <ProgressBar value={progress} color={colors.success} />
        <View style={styles.counter}>
          <AppText variant="label" color={colors.success}>{known} мэдсэн</AppText>
          <AppText variant="label" color={colors.textMuted}>{queue.length} үлдсэн</AppText>
        </View>
      </View>

      {!current ? (
        <View style={styles.done}>
          <AppText style={styles.doneEmoji}>🎉</AppText>
          <AppText variant="h1" center style={styles.doneTitle}>Бүх үгийг мэдлээ!</AppText>
          <AppText variant="body" color={colors.textSecondary} center>Энэ удаад {known} үг сурлаа.</AppText>
          <Button label="Нүүр рүү" icon="home" onPress={() => router.back()} style={{ marginTop: spacing.xl }} />
        </View>
      ) : (
        <View style={styles.deck}>
          {/* Next card peek */}
          {next ? (
            <View style={[styles.cardWrap, styles.cardBehind]} pointerEvents="none">
              <VocabCard word={next} saved={next.saved} onToggleSave={() => {}} onPlayAudio={() => {}} />
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
            <Animated.View style={[styles.badge, styles.badgeKnow, { opacity: knowOpacity }]}>
              <AppText color={colors.success} style={styles.badgeText}>KNOW</AppText>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.badgeDont, { opacity: dontOpacity }]}>
              <AppText color={colors.danger} style={styles.badgeText}>FORGOT</AppText>
            </Animated.View>

            <VocabCard
              word={current}
              saved={current.saved}
              onToggleSave={onToggleSave}
              onPlayAudio={playAudio}
            />
          </Animated.View>
        </View>
      )}

      {/* Forgot / Know actions */}
      {current ? (
        <View style={styles.actions}>
          <Pressable style={[styles.actBtn, styles.actForgot]} onPress={() => forceSwipe('left')}>
            <Ionicons name="arrow-back" size={20} color={colors.danger} />
            <AppText variant="label" color={colors.danger}>Forgot</AppText>
          </Pressable>
          <AppText variant="caption">— Swipe —</AppText>
          <Pressable style={[styles.actBtn, styles.actKnow]} onPress={() => forceSwipe('right')}>
            <AppText variant="label" color={colors.success}>Know</AppText>
            <Ionicons name="arrow-forward" size={20} color={colors.success} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  counterWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.xs },
  counter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  deck: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  cardWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  cardBehind: { transform: [{ scale: 0.95 }, { translateY: 14 }], opacity: 0.55 },
  badge: {
    position: 'absolute', top: spacing.lg, zIndex: 10,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.md, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.9)',
  },
  badgeKnow: { right: spacing.lg, borderColor: colors.success, transform: [{ rotate: '12deg' }] },
  badgeDont: { left: spacing.lg, borderColor: colors.danger, transform: [{ rotate: '-12deg' }] },
  badgeText: { fontWeight: '900', letterSpacing: 1, fontSize: 18 },
  actions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  actBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    borderRadius: radius.full, borderWidth: 1.5, flex: 1, justifyContent: 'center',
    ...(elevation.sm as object),
  },
  actForgot: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  actKnow: { borderColor: colors.success, backgroundColor: colors.successSoft },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneEmoji: { fontSize: 56 },
  doneTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
});
