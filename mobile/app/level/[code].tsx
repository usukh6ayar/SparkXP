import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '../../src/components/AppIcon';
import { useAuth } from '../../src/auth/AuthContext';
import { useSettings } from '../../src/settings/SettingsContext';
import type { TranslationKey } from '../../src/i18n';
import { getLessons, getCompletedLessonIds, type Lesson } from '../../src/api/lessons';
import { getGamification, getLessonStars, type Gamification } from '../../src/api/gamification';
import { AppText } from '../../src/components/Text';
import { haptics } from '../../src/lib/haptics';
import { DURATION, useReduceMotion } from '../../src/lib/motion';
import { colors, islandMap } from '../../src/theme/theme';
import { bounded, CONTENT_MAX_WIDTH } from '../../src/theme/responsive';

/**
 * Level journey — the lessons of one CEFR level laid out as numbered nodes
 * along a winding trail, bottom (start) → top (goal), inside a vertical
 * SCROLL view so the path can grow upward as more lessons are added (each
 * lesson = one node; a few locked nodes hint at what's coming). Reached from
 * the "Хичээлийн ертөнц" island map by tapping a level. The forest backdrop
 * stays fixed while the trail scrolls over it.
 *
 * Scope: FRONTEND-only. Tapping a real node opens its lesson detail.
 */

const bgDark = require('../../assets/avatars/islands/lessonBackground.webp'); // dark forest — dark theme
const bgLight = require('../../assets/avatars/islands/lessonLightBackground.webp'); // bright forest — light theme
const foxMascot = require('../../assets/avatars/lessonAvatar.png'); // progress-card mascot (transparent XP fox)

/** Theme-aware palette for the header UI over the (dark/light) forest backdrop. */
function palette(isLight: boolean) {
  return isLight
    ? {
        text: '#1F2937',
        textDim: 'rgba(31,41,55,0.72)',
        card: 'rgba(255,255,255,0.98)',
        cardBorder: 'rgba(0,0,0,0.06)',
        back: 'rgba(255,255,255,0.95)',
        backIcon: '#1F2937',
        scrim: ['rgba(236,243,250,0.97)', 'rgba(236,243,250,0.6)', 'transparent'] as const,
        track: 'rgba(0,0,0,0.1)',
        plus: 'rgba(0,0,0,0.08)',
      }
    : {
        text: '#FFFFFF',
        textDim: 'rgba(255,255,255,0.82)',
        card: 'rgba(44,28,90,0.88)',
        cardBorder: 'rgba(160,140,255,0.42)',
        back: 'rgba(0,0,0,0.45)',
        backIcon: '#FFFFFF',
        scrim: ['rgba(6,10,24,0.95)', 'rgba(6,10,24,0.6)', 'transparent'] as const,
        track: 'rgba(255,255,255,0.15)',
        plus: 'rgba(255,255,255,0.18)',
      };
}

interface LevelMeta {
  color: string;
  emoji: string;
  /** Island name — narrative "world map" copy (Ой / Тосгон / Цайз …). */
  nameKey: TranslationKey;
  /** CEFR tier label + one-line subtitle. */
  tierKey: TranslationKey;
  descKey: TranslationKey;
}

/**
 * Per-level island: colour, emoji and the i18n keys for its copy.
 *
 * Only non-text data is held here — the strings are looked up through `t()` at
 * render time, because a module-level constant is evaluated once at import and
 * would keep the language the app started in after a switch. The CEFR tier and
 * subtitle reuse the SAME `cefr*` keys as registration and edit-profile
 * (`src/constants/levels.ts`), so the app has one Mongolian wording per level
 * rather than a second English-only set that drifts from it.
 */
const LEVEL: Record<string, LevelMeta> = {
  a1: { color: islandMap.green,  emoji: '🌿', nameKey: 'levelNameA1', tierKey: 'cefrA1', descKey: 'cefrA1Desc' },
  a2: { color: islandMap.green,  emoji: '🏡', nameKey: 'levelNameA2', tierKey: 'cefrA2', descKey: 'cefrA2Desc' },
  b1: { color: islandMap.blue,   emoji: '🏰', nameKey: 'levelNameB1', tierKey: 'cefrB1', descKey: 'cefrB1Desc' },
  b2: { color: islandMap.blue,   emoji: '⛰️', nameKey: 'levelNameB2', tierKey: 'cefrB2', descKey: 'cefrB2Desc' },
  c1: { color: islandMap.purple, emoji: '🪐', nameKey: 'levelNameC1', tierKey: 'cefrC1', descKey: 'cefrC1Desc' },
  c2: { color: islandMap.purple, emoji: '✨', nameKey: 'levelNameC2', tierKey: 'cefrC2', descKey: 'cefrC2Desc' },
};

const NODE = 62;            // node diameter
const RING = NODE + 14;     // glowing ring diameter around a node
const V_SPACING = 150;      // vertical gap between node centers
const V_BOTTOM_PAD = 96;    // gap below the first (bottom) node
const V_TOP_PAD = 70;       // gap above the last (top) node
const LOCKED_AHEAD = 1;     // just the single "Next" node past the real lessons
const MIN_NODES = 4;        // always show at least this many slots
const BEAD = 11;            // golden trail bead diameter
const BEAD_GAP = 22;        // spacing between beads along the trail

/** Gentle serpentine wave — node x as a fraction of width, clamped on-screen. */
function nodeXFrac(i: number): number {
  const f = 0.5 + 0.26 * Math.sin(i * 0.9 + 0.6);
  return Math.max(0.2, Math.min(0.8, f));
}

/** The current node's glow ring — softly pulses (§3.2b: exactly one node pulses).
 *  Frozen when Reduce Motion is on. */
function CurrentRing({ left, top, reduce }: { left: number; top: number; reduce: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) { s.value = 1; return; }
    s.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1,
      false,
    );
  }, [reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.ring, styles.ringCurrent, { left, top }, anim]} />;
}

export default function LevelScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const levelCode = (code ?? 'a1').toLowerCase();
  const { token, user } = useAuth();
  const { theme, t } = useSettings();
  // An unknown code still renders (the route is just a URL) — it falls back to
  // a neutral island rather than crashing on an undefined lookup.
  const meta = LEVEL[levelCode];
  const island = {
    color: meta?.color ?? islandMap.purple,
    emoji: meta?.emoji ?? '✨',
    name: t(meta?.nameKey ?? 'levelNameFallback'),
    tier: meta ? t(meta.tierKey) : '',
    desc: meta ? t(meta.descKey) : '',
  };
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isLight = theme === 'light';
  const bg = isLight ? bgLight : bgDark;
  const C = palette(isLight);
  const reduceMotion = useReduceMotion();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // Per-lesson stars (0–3) — shown under each node. `{}` = none earned yet.
  const [stars, setStars] = useState<Record<string, number>>({});
  const [gam, setGam] = useState<Gamification | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Measured header height → the trail starts right below it (no overlap).
  const [headerH, setHeaderH] = useState(0);
  // The climb starts at the bottom (node 1), so jump there once on first render.
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [r, g, done, starMap] = await Promise.all([
        getLessons(token, { level: levelCode }),
        getGamification(token),
        // Which lessons are finished — by id, so the trail can't mis-tick.
        getCompletedLessonIds(token).catch(() => ({ ids: [] as string[] })),
        getLessonStars(token).catch(() => ({} as Record<string, number>)),
      ]);
      setLessons(r.items);
      setGam(g);
      setCompleted(new Set(done.ids));
      setStars(starMap);
    } catch (e) {
      console.warn('Level load failed:', (e as Error)?.message ?? e);
      setLessons([]);
    }
  }, [token, levelCode]);

  // Refetch on focus, not just on mount: after taking a lesson's test the user
  // returns to this (still-mounted) screen, so stars / completion / castle
  // progress must reload here or the just-earned stars never appear.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    await load();
    setRefreshing(false);
  }, [load]);

  // Real streak + this level's lesson-completion from the backend.
  const gems = user?.sparks ?? 0;
  const streak = gam?.currentStreak ?? 0;
  const levelProg = gam?.progressByLevel?.[levelCode];
  const done = levelProg?.done ?? 0;
  const total = levelProg?.total ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  // "Current" = the first lesson of this level the student has NOT finished.
  // -1 (all done) means every node is mastered and nothing is ahead.
  const firstUndone = lessons.findIndex((l) => !completed.has(l.id));
  const currentIndex = firstUndone === -1 ? lessons.length : firstUndone;

  // One node per lesson + a few locked "coming soon" nodes. The path is tall
  // enough to hold them all and scrolls; node 1 sits at the very bottom.
  const nodeCount = Math.max(lessons.length + LOCKED_AHEAD, MIN_NODES);
  const pathHeight = V_TOP_PAD + nodeCount * V_SPACING + V_BOTTOM_PAD;
  // On tablets the trail lives in a centered max-width column (mapX offset)
  // instead of sprawling edge-to-edge; on phones mapW == width, mapX == 0.
  const mapW = Math.min(width, CONTENT_MAX_WIDTH);
  const mapX = (width - mapW) / 2;
  const nodeCenter = (i: number) => ({
    x: mapX + nodeXFrac(i) * mapW,
    y: pathHeight - V_BOTTOM_PAD - i * V_SPACING,
  });

  // Beaded golden trail: sample dots evenly along the polyline between nodes
  // (a bead every BEAD_GAP px), so it curves nicely for any number of nodes.
  // Segments at/above the current node are "ahead" (not yet earned) → rendered
  // muted, so travelled-vs-ahead reads at a glance like the island trail (§3.2b).
  const beads: { x: number; y: number; key: string; ahead: boolean }[] = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    const a = nodeCenter(i);
    const b = nodeCenter(i + 1);
    const ahead = i >= currentIndex;
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / BEAD_GAP));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      beads.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, key: `${i}-${k}`, ahead });
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: isLight ? '#DCEAF5' : '#06101C' }]}>
      {/* Fixed forest backdrop — stays put while the trail scrolls over it. */}
      <ImageBackground source={bg} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Scrolling trail: golden connectors + numbered/locked lesson nodes. */}
      <ScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ paddingTop: (headerH || insets.top + 260) + 28, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={islandMap.gold} progressViewOffset={headerH || insets.top + 260} />
        }
        onContentSizeChange={(_w, h) => {
          if (!didInitialScroll.current && h > 0) {
            didInitialScroll.current = true;
            scrollRef.current?.scrollToEnd({ animated: false });
          }
        }}
      >
        <View style={{ height: pathHeight }}>
          {!loading &&
            // Beaded golden trail (behind the nodes); ahead segments run muted.
            beads.map((p) => (
              <View
                key={`bead-${p.key}`}
                style={[styles.bead, p.ahead && styles.beadAhead, { left: p.x - BEAD / 2, top: p.y - BEAD / 2 }]}
              />
            ))}

          {!loading &&
            Array.from({ length: nodeCount }).map((_, i) => {
              const lesson = lessons[i];
              const c = nodeCenter(i);
              // Four node states (§3.2b): mastered (done) · current (the one that
              // pulses) · unlocked (a real lesson ahead) · locked (coming soon).
              const isDone = !!lesson && completed.has(lesson.id);
              // Sequential path: a lesson opens only once the PREVIOUS one is
              // cleared — finished (✓) or passed its test (≥1 star, i.e. ≥50%).
              // The first lesson is always open; completion also counts so a
              // lesson without a test can never dead-end the trail.
              const prev = lessons[i - 1];
              const prevCleared =
                i === 0 || (!!prev && (completed.has(prev.id) || (stars[prev.id] ?? 0) > 0));
              const locked = i >= lessons.length || (!!lesson && !prevCleared);
              const current = i === currentIndex && i < lessons.length && !locked;
              const unlocked = !isDone && !current && !locked;
              return (
                <Fragment key={i}>
                  {/* Rings: current pulses (glow); unlocked gets a quiet outline;
                      mastered + locked have none. */}
                  {current ? (
                    <CurrentRing left={c.x - RING / 2} top={c.y - RING / 2} reduce={reduceMotion} />
                  ) : unlocked ? (
                    <View
                      pointerEvents="none"
                      style={[styles.ring, styles.ringUnlocked, { left: c.x - RING / 2, top: c.y - RING / 2 }]}
                    />
                  ) : null}

                  {/* Node — fill + glyph vary by state. */}
                  <Animated.View
                    style={[styles.nodeWrap, { left: c.x - NODE / 2, top: c.y - NODE / 2 }]}
                    entering={reduceMotion ? undefined : ZoomIn.delay(i * 45).duration(DURATION.base)}
                  >
                    <Pressable
                      onPress={lesson && !locked ? () => { haptics.tap(); router.push(`/lesson/${lesson.id}`); } : undefined}
                      style={({ pressed }) => [
                        styles.node,
                        isDone && styles.nodeMastered,
                        current && styles.nodeCurrent,
                        unlocked && styles.nodeUnlocked,
                        locked && styles.nodeLocked,
                        pressed && lesson && !locked && { transform: [{ scale: 0.94 }] },
                      ]}
                    >
                      {current ? (
                        <LinearGradient
                          colors={colors.primaryGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.nodeFill}
                        />
                      ) : null}
                      {isDone ? (
                        <Ionicons name="checkmark" size={28} color={colors.white} />
                      ) : locked ? (
                        <Ionicons name="lock-closed" size={22} color={colors.lockedInk} />
                      ) : (
                        <AppText variant="h3" color={colors.white}>{i + 1}</AppText>
                      )}
                    </Pressable>
                  </Animated.View>

                  {/* "ЭНД" flag above the current node. */}
                  {current ? (
                    <View pointerEvents="none" style={[styles.endFlag, { left: c.x - 26, top: c.y - RING / 2 - 22 }]}>
                      <AppText variant="overline" color={colors.white}>{t('youAreHereShort')}</AppText>
                    </View>
                  ) : null}

                  {/* Stars under the node, on a soft pill so they read clearly
                      over the illustrated map — empty (a "take the test" prompt)
                      until the lesson's test fills them 0–3 from the best score. */}
                  {lesson && !locked ? (
                    <View pointerEvents="none" style={[styles.starRow, { left: c.x - 43, top: c.y + NODE / 2 + 2 }]}>
                      {[0, 1, 2].map((si) => {
                        const filled = si < (stars[lesson.id] ?? 0);
                        return (
                          <Ionicons
                            key={si}
                            name={filled ? 'star' : 'star-outline'}
                            size={si === 1 ? 24 : 20}
                            color={filled ? islandMap.gold : 'rgba(255,255,255,0.55)'}
                            style={[filled && styles.starGlow, si === 1 && styles.starMid]}
                          />
                        );
                      })}
                    </View>
                  ) : null}
                </Fragment>
              );
            })}
        </View>
      </ScrollView>

      {/* Top scrim so the header reads over the forest top (light=white, dark=navy). */}
      <LinearGradient
        colors={C.scrim}
        locations={[0, 0.72, 1]}
        style={[styles.topScrim, { height: insets.top + 320 }]}
        pointerEvents="none"
      />

      {/* Fixed header (title + progress) — sits above the scrolling trail. */}
      <View
        style={[styles.header, { paddingTop: insets.top + 6 }]}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        {/* Centered max-width column on tablets (no-op on phones). */}
        <View style={bounded}>
        {/* Top row: back + streak + gems */}
        <View style={styles.topRow}>
          {/* Same fallback as `TopBar`: opened from a deep link there is
              nothing to pop, and a bare `router.back()` is then a dead press. */}
          <Pressable
            onPress={() => {
              haptics.tap();
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/lessons');
            }}
            hitSlop={12}
            style={[styles.backBtn, { backgroundColor: C.back }]}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
          >
            <Ionicons name="chevron-back" size={24} color={C.backIcon} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={[styles.statPill, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <AppIcon name="streak" size={16} />
            <AppText variant="bodyStrong" color={C.text}>{streak}</AppText>
          </View>
          <View style={[styles.statPill, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <AppIcon name="sparks" size={16} />
            <AppText variant="bodyStrong" color={C.text}>{gems}</AppText>
            <View style={[styles.plusBtn, { backgroundColor: C.plus }]}>
              <Ionicons name="add" size={14} color={C.backIcon} />
            </View>
          </View>
        </View>

        {/* Title → subtitle → level chip */}
        <View style={styles.titleBlock}>
          <AppText variant="h1" color={C.text} style={styles.bigTitle}>
            {island.name} {island.emoji}
          </AppText>
          {!!island.desc && (
            <AppText variant="body" color={C.textDim} style={{ marginTop: 2 }}>

            </AppText>
          )}
          <View style={[styles.tierRow, { marginTop: 10 }]}>
            <View style={[styles.levelChip, { backgroundColor: island.color }]}>
              <AppText variant="overline" color={colors.white}>{levelCode.toUpperCase()}</AppText>
            </View>
            {!!island.tier && <AppText variant="bodyStrong" color={island.color}>{island.tier}</AppText>}
          </View>
        </View>

        {/* Progress card with mascot + completion message */}
        <View style={[styles.progressCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <Image source={foxMascot} style={styles.mascot} resizeMode="contain" />
          <View style={{ marginRight: 110 }}>
            <View style={styles.progressTop}>
              <AppText variant="label" color={C.textDim}>Progress</AppText>
              <AppText variant="bodyStrong" color={C.text}>{pct}%</AppText>
            </View>
            <View style={[styles.track, { backgroundColor: C.track }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: island.color }]} />
            </View>
            <View style={styles.starsRow}>
              <Ionicons name="star" size={16} color={islandMap.gold} />
              <AppText variant="bodyStrong" color={C.text}>{done}/{total}</AppText>
            </View>
            <AppText variant="caption" color={C.textDim} style={{ marginTop: 5 }}>
              {pct >= 100 ? 'Perfect! Stage complete.' : done > 0 ? 'Keep it up!' : 'Start learning!'}
            </AppText>
          </View>
        </View>

        {/* Empty: this level has no lessons yet (successful load, zero lessons). */}
        {!loading && lessons.length === 0 ? (
          <View style={styles.emptyHint}>
            <Ionicons name="information-circle-outline" size={16} color={C.textDim} />
            <AppText variant="caption" color={C.textDim} style={{ flex: 1 }}>{t('levelNoLessons')}</AppText>
          </View>
        ) : null}
        </View>
      </View>

      {loading && <ActivityIndicator size="large" color={C.text} style={StyleSheet.absoluteFill} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06101C' },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 6,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(10,14,30,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(150,130,255,0.28)',
  },
  plusBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  emptyHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingHorizontal: 4, maxWidth: '80%',
  },
  titleBlock: { marginTop: 14 },
  bigTitle: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressCard: {
    alignSelf: 'flex-start',
    width: '70%',
    minHeight: 132,
    marginTop: 12,
    padding: 10,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,14,30,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(150,130,255,0.28)',
    // soft lift so the frosted card reads cleanly over the bright forest
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  mascot: {
    position: 'absolute',
    right: -6,
    top: -6,
    width: 132,
    height: 152,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginTop: 7,
  },
  fill: { height: '100%', borderRadius: 999, backgroundColor: islandMap.green },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  levelChip: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bead: {
    position: 'absolute',
    width: BEAD,
    height: BEAD,
    borderRadius: BEAD / 2,
    backgroundColor: islandMap.gold,
    // warm golden glow, like the reference trail
    shadowColor: '#FFD34A',
    shadowOpacity: 0.95,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 4,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
  },
  // Current node — glowing violet halo (pulses via CurrentRing).
  ringCurrent: {
    borderColor: colors.glow,
    shadowColor: colors.glow,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  // Unlocked node — a quiet outline, no glow.
  ringUnlocked: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    shadowOpacity: 0,
  },
  // Ahead-of-you trail beads run muted + smaller (not yet earned).
  beadAhead: {
    backgroundColor: 'rgba(167,155,208,0.45)',
    shadowOpacity: 0,
    transform: [{ scale: 0.7 }],
  },
  // "ЭНД" flag above the current node.
  endFlag: {
    position: 'absolute',
    width: 52,
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: colors.glow,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  nodeWrap: { position: 'absolute', width: NODE, height: NODE },
  // Three stars sitting just under a node (slight arc via the raised middle).
  starRow: {
    position: 'absolute', width: 86, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 2,
    paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999,
    backgroundColor: 'rgba(12,8,32,0.42)',
  },
  // The centre star sits a touch higher for a little podium shape.
  starMid: { marginTop: -5 },
  // Filled stars get a soft gold glow so a 3-star lesson reads as a reward.
  starGlow: { textShadowColor: 'rgba(255,193,60,0.95)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 7 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,14,30,0.78)',
    borderWidth: 3,
    borderColor: 'transparent',
    // soft glow
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  // The gradient fill inside the current node (matches the circle via radius).
  nodeFill: { ...StyleSheet.absoluteFillObject, borderRadius: NODE / 2 },
  // Per-state fills (§3.2b).
  nodeMastered: { backgroundColor: islandMap.green, borderColor: 'rgba(255,255,255,0.5)' },
  nodeCurrent: { borderColor: colors.glow },
  nodeUnlocked: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  nodeLocked: { backgroundColor: colors.lockedSurface, borderColor: 'rgba(139,130,173,0.25)' },
});
