import { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Animated, PanResponder, Dimensions, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { getLearnQueue, markKnown, type LearnWord } from '../src/api/reviews';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { Loading } from '../src/components/Loading';
import { Button } from '../src/components/Button';
import { ProgressBar } from '../src/components/ProgressBar';
import { colors, spacing, radius, elevation } from '../src/theme/theme';

const SCREEN_W = Dimensions.get('window').width;
const THRESHOLD = SCREEN_W * 0.25;
const OUT_DURATION = 250;

/**
 * Tinder-style word learning.
 * - Swipe RIGHT = "Мэднэ" → mark known (quality 5), word leaves the deck.
 * - Swipe LEFT  = "Мэдэхгүй" → word goes to the back of the deck (comes again).
 * - Tap the card → flip to the Mongolian meaning.
 * Loops until every word is known. Known count shown on Profile.
 */
export default function SwipeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [queue, setQueue] = useState<LearnWord[]>([]);
  const [known, setKnown] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  const position = useRef(new Animated.ValueXY()).current;
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

  function handleSwipe(dir: 'left' | 'right') {
    const card = queueRef.current[0];
    if (!card) return;
    if (dir === 'right') {
      const t = tokenRef.current;
      if (t) markKnown(t, card.id).catch(() => {});
      setKnown((k) => k + 1);
      setQueue((q) => q.slice(1)); // known → remove
    } else {
      setQueue((q) => [...q.slice(1), card]); // don't know → back of deck
    }
    position.setValue({ x: 0, y: 0 });
    setFlipped(false);
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
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) setFlipped((f) => !f);
        else if (g.dx > THRESHOLD) forceSwipe('right');
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
    outputRange: ['-28deg', '0deg', '28deg'],
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
            <View style={[styles.card, styles.cardBehind]}>
              <AppText style={styles.word}>{next.english}</AppText>
            </View>
          ) : null}

          {/* Current card */}
          <Animated.View
            {...pan.panHandlers}
            style={[
              styles.card,
              { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
            ]}
          >
            <Animated.View style={[styles.badge, styles.badgeKnow, { opacity: knowOpacity }]}>
              <AppText variant="label" color={colors.success} style={styles.badgeText}>МЭДНЭ</AppText>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.badgeDont, { opacity: dontOpacity }]}>
              <AppText variant="label" color={colors.danger} style={styles.badgeText}>МЭДЭХГҮЙ</AppText>
            </Animated.View>

            {!flipped ? (
              <>
                <AppText style={styles.word}>{current.english}</AppText>
                <AppText variant="caption" style={styles.hint}>дарж орчуулга харах</AppText>
              </>
            ) : (
              <>
                <AppText style={styles.translation}>{current.mongolian}</AppText>
                {current.exampleSentence ? (
                  <AppText variant="body" color={colors.textSecondary} center style={styles.example}>
                    {current.exampleSentence}
                  </AppText>
                ) : null}
              </>
            )}
          </Animated.View>
        </View>
      )}

      {/* Action buttons */}
      {current ? (
        <View style={styles.actions}>
          <Pressable style={[styles.actBtn, styles.actDont]} onPress={() => forceSwipe('left')}>
            <Ionicons name="close" size={30} color={colors.danger} />
          </Pressable>
          <Pressable style={[styles.actBtn, styles.actFlip]} onPress={() => setFlipped((f) => !f)}>
            <Ionicons name="sync" size={22} color={colors.navy} />
          </Pressable>
          <Pressable style={[styles.actBtn, styles.actKnow]} onPress={() => forceSwipe('right')}>
            <Ionicons name="checkmark" size={30} color={colors.white} />
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
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    position: 'absolute',
    width: SCREEN_W - spacing.lg * 2,
    minHeight: 320,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    ...(elevation.md as object),
  },
  cardBehind: { transform: [{ scale: 0.94 }, { translateY: 16 }], opacity: 0.6 },
  word: { fontSize: 40, lineHeight: 46, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  hint: { marginTop: spacing.lg },
  translation: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  example: { marginTop: spacing.md },
  badge: { position: 'absolute', top: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md, borderWidth: 2.5 },
  badgeKnow: { right: spacing.lg, borderColor: colors.success, transform: [{ rotate: '12deg' }] },
  badgeDont: { left: spacing.lg, borderColor: colors.danger, transform: [{ rotate: '-12deg' }] },
  badgeText: { fontWeight: '900', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.lg },
  actBtn: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  actDont: { borderColor: colors.danger, backgroundColor: colors.background },
  actFlip: { borderColor: colors.border, backgroundColor: colors.background, width: 52, height: 52 },
  actKnow: { borderColor: colors.success, backgroundColor: colors.success },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  doneEmoji: { fontSize: 56 },
  doneTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
});
