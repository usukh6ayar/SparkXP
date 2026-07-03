import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { useSettings } from '../../src/settings/SettingsContext';
import { getLessons, type Lesson } from '../../src/api/lessons';
import { getGamification, type Gamification } from '../../src/api/gamification';
import { AppText } from '../../src/components/Text';
import { colors, islandMap } from '../../src/theme/theme';

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
  name: string;
  color: string;
  emoji: string;
  tier: string; // CEFR tier label (Beginner … Proficient)
  desc: string; // one-line subtitle
}

// TODO(i18n/copy): name/tier/desc are English-only "world map" narrative
// content (Forest/Village/Castle...), not plain UI chrome — needs Boju's
// call on Mongolian names before this goes through i18n like the rest of
// the app's copy (CLAUDE.md: Mongolian-primary).
const LEVEL: Record<string, LevelMeta> = {
  a1: { name: 'Forest',    color: islandMap.green,  emoji: '🌿', tier: 'Beginner',          desc: 'Learn greetings and basic words' },
  a2: { name: 'Village',   color: islandMap.green,  emoji: '🏡', tier: 'Elementary',        desc: 'Everyday phrases and simple talk' },
  b1: { name: 'Castle',    color: islandMap.blue,   emoji: '🏰', tier: 'Intermediate',      desc: 'Hold conversations with confidence' },
  b2: { name: 'Mountain',  color: islandMap.blue,   emoji: '⛰️', tier: 'Upper-Intermediate', desc: 'Express ideas on complex topics' },
  c1: { name: 'Space',     color: islandMap.purple, emoji: '🪐', tier: 'Advanced',          desc: 'Fluent, nuanced communication' },
  c2: { name: 'Sky Realm', color: islandMap.purple, emoji: '✨', tier: 'Proficient',        desc: 'Near-native mastery of English' },
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
const NEXT_XP = 10;         // hinted XP shown on the "Next" locked node

/** Gentle serpentine wave — node x as a fraction of width, clamped on-screen. */
function nodeXFrac(i: number): number {
  const f = 0.5 + 0.26 * Math.sin(i * 0.9 + 0.6);
  return Math.max(0.2, Math.min(0.8, f));
}

export default function LevelScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const levelCode = (code ?? 'a1').toLowerCase();
  const meta = LEVEL[levelCode] ?? { name: 'Level', color: islandMap.purple, emoji: '✨', tier: '', desc: '' };
  const { token, user } = useAuth();
  const { theme } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isLight = theme === 'light';
  const bg = isLight ? bgLight : bgDark;
  const C = palette(isLight);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [gam, setGam] = useState<Gamification | null>(null);
  const [loading, setLoading] = useState(true);
  // Measured header height → the trail starts right below it (no overlap).
  const [headerH, setHeaderH] = useState(0);
  // The climb starts at the bottom (node 1), so jump there once on first render.
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [r, g] = await Promise.all([
        getLessons(token, { level: levelCode }),
        getGamification(token),
      ]);
      setLessons(r.items);
      setGam(g);
    } catch (e) {
      console.warn('Level load failed:', (e as Error)?.message ?? e);
      setLessons([]);
    }
  }, [token, levelCode]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Real streak + this level's lesson-completion from the backend.
  const gems = user?.sparks ?? 0;
  const streak = gam?.currentStreak ?? 0;
  const levelProg = gam?.progressByLevel?.[levelCode];
  const done = levelProg?.done ?? 0;
  const total = levelProg?.total ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // One node per lesson + a few locked "coming soon" nodes. The path is tall
  // enough to hold them all and scrolls; node 1 sits at the very bottom.
  const nodeCount = Math.max(lessons.length + LOCKED_AHEAD, MIN_NODES);
  const pathHeight = V_TOP_PAD + nodeCount * V_SPACING + V_BOTTOM_PAD;
  const nodeCenter = (i: number) => ({
    x: nodeXFrac(i) * width,
    y: pathHeight - V_BOTTOM_PAD - i * V_SPACING,
  });

  // Beaded golden trail: sample dots evenly along the polyline between nodes
  // (a bead every BEAD_GAP px), so it curves nicely for any number of nodes.
  const beads: { x: number; y: number; key: string }[] = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    const a = nodeCenter(i);
    const b = nodeCenter(i + 1);
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / BEAD_GAP));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      beads.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, key: `${i}-${k}` });
    }
  }

  // The first `done` lessons of this level count as completed (green + stars);
  // the next unlocked one is "current"; anything past the real lessons is locked.
  const completedCount = Math.min(done, lessons.length);
  const lessonXp = (l?: Lesson) => {
    const xp = (l?.content as { xp?: number } | undefined)?.xp;
    return typeof xp === 'number' ? xp : 20;
  };

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
        onContentSizeChange={(_w, h) => {
          if (!didInitialScroll.current && h > 0) {
            didInitialScroll.current = true;
            scrollRef.current?.scrollToEnd({ animated: false });
          }
        }}
      >
        <View style={{ height: pathHeight }}>
          {!loading &&
            // Beaded golden trail (behind the nodes).
            beads.map((p) => (
              <View key={`bead-${p.key}`} style={[styles.bead, { left: p.x - BEAD / 2, top: p.y - BEAD / 2 }]} />
            ))}

          {!loading &&
            Array.from({ length: nodeCount }).map((_, i) => {
              const lesson = lessons[i];
              const c = nodeCenter(i);
              const completed = i < completedCount;
              const current = i === completedCount && i < lessons.length;
              const locked = i >= lessons.length;
              const isFirstLocked = i === lessons.length;
              const ringColor = locked ? islandMap.purple : meta.color;
              // Label bubble sits on the side the node leans away from.
              const leftLean = nodeXFrac(i) < 0.5;
              const bubbleSide = leftLean
                ? { left: c.x + NODE / 2 + 14 }
                : { right: width - (c.x - NODE / 2 - 14) };
              return (
                <Fragment key={i}>
                  {/* Glowing ring around the node */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.ring,
                      {
                        left: c.x - RING / 2,
                        top: c.y - RING / 2,
                        borderColor: locked ? 'rgba(150,130,255,0.5)' : ringColor,
                        shadowColor: ringColor,
                        shadowOpacity: locked ? 0 : 0.9, // no glow on locked rings → no bleed behind header
                      },
                    ]}
                  />
                  {/* Node circle (number or lock) */}
                  <Pressable
                    onPress={lesson ? () => router.push(`/lesson/${lesson.id}`) : undefined}
                    style={({ pressed }) => [
                      styles.node,
                      { left: c.x - NODE / 2, top: c.y - NODE / 2 },
                      pressed && lesson && { transform: [{ scale: 0.94 }] },
                    ]}
                  >
                    {locked ? (
                      <Ionicons name="lock-closed" size={22} color="rgba(255,255,255,0.75)" />
                    ) : (
                      <AppText variant="h3" color={colors.white}>{i + 1}</AppText>
                    )}
                  </Pressable>
                  {/* Three stars sitting on the lower rim of a completed node */}
                  {completed && (
                    <View style={[styles.starRow, { left: c.x - 33, top: c.y + NODE / 2 - 14 }]} pointerEvents="none">
                      {[0, 1, 2].map((s) => (
                        <Ionicons key={s} name="star" size={17} color={islandMap.gold} style={s === 1 ? styles.starMid : styles.star} />
                      ))}
                    </View>
                  )}
                  {/* Side label bubble (Great job / Start / Next) */}
                  {(completed || current || isFirstLocked) && (
                    <View
                      style={[styles.bubble, bubbleSide, { top: c.y - 24, backgroundColor: C.card, borderColor: C.cardBorder }]}
                      pointerEvents="none"
                    >
                      {isFirstLocked ? (
                        <>
                          <AppText variant="bodyStrong" color={C.text}>Next</AppText>
                          <AppText variant="caption" color={C.textDim}>New words</AppText>
                          <AppText variant="label" color={islandMap.gold}>+{NEXT_XP} XP</AppText>
                        </>
                      ) : (
                        <>
                          <AppText variant="bodyStrong" color={meta.color}>{current ? 'Start' : 'Great job!'}</AppText>
                          <AppText variant="label" color={islandMap.gold}>+{lessonXp(lesson)} XP</AppText>
                        </>
                      )}
                    </View>
                  )}
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
        {/* Top row: back + streak + gems */}
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, { backgroundColor: C.back }]}>
            <Ionicons name="chevron-back" size={24} color={C.backIcon} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={[styles.statPill, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Ionicons name="flame" size={16} color={islandMap.streak} />
            <AppText variant="bodyStrong" color={C.text}>{streak}</AppText>
          </View>
          <View style={[styles.statPill, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <Ionicons name="diamond" size={16} color={islandMap.blue} />
            <AppText variant="bodyStrong" color={C.text}>{gems}</AppText>
            <View style={[styles.plusBtn, { backgroundColor: C.plus }]}>
              <Ionicons name="add" size={14} color={C.backIcon} />
            </View>
          </View>
        </View>

        {/* Title → subtitle → level chip */}
        <View style={styles.titleBlock}>
          <AppText variant="h1" color={C.text} style={styles.bigTitle}>
            {meta.name} {meta.emoji}
          </AppText>
          {!!meta.desc && (
            <AppText variant="body" color={C.textDim} style={{ marginTop: 2 }}>
              {meta.desc}
            </AppText>
          )}
          <View style={[styles.tierRow, { marginTop: 10 }]}>
            <View style={[styles.levelChip, { backgroundColor: meta.color }]}>
              <AppText variant="overline" color={colors.white}>{levelCode.toUpperCase()}</AppText>
            </View>
            {!!meta.tier && <AppText variant="bodyStrong" color={meta.color}>{meta.tier}</AppText>}
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
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: meta.color }]} />
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
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  starRow: {
    position: 'absolute',
    width: 66,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  star: { marginHorizontal: -1 },
  starMid: { marginHorizontal: -1, marginBottom: 5 },
  bubble: {
    position: 'absolute',
    maxWidth: 150,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,14,30,0.78)',
    borderWidth: 3,
    // soft glow
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
});
