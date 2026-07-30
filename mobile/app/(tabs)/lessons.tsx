import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { useSettings } from '../../src/settings/SettingsContext';
import { haptics } from '../../src/lib/haptics';
import { useReduceMotion } from '../../src/lib/motion';
import { tf } from '../../src/i18n';
import { getGamification, type Gamification } from '../../src/api/gamification';
import { AppText } from '../../src/components/Text';
import { AppIcon } from '../../src/components/AppIcon';
import { type AppIconName } from '../../src/constants/appIcons';
import { islandMap, colors } from '../../src/theme/theme';
import { bounded } from '../../src/theme/responsive';

/**
 * "Хичээлийн ертөнц" — the Lessons tab as an adventure map of floating islands.
 *
 * The map is now composed at runtime: a tall starry-sky backdrop
 * (assets/avatars/background.png) with the SIX individual island artworks
 * (assets/avatars/islands/a1…c2.png — feathered cut-outs that float on the
 * sky) overlaid at fixed positions. Each island gets a label card
 * (badge / name / progress or lock) and an invisible tap hotspot, positioned
 * as fractions of the scene so they scale to any width. Swapping a level's art
 * is now just swapping one PNG.
 *
 * Per-island progress and the streak both come from `GET /gamification`
 * (`progressByLevel` / `currentStreak`) — no placeholder counts.
 */

const skyImg = require('../../assets/avatars/islands/background.webp'); // starry sky backdrop — dark theme
const lightBgImg = require('../../assets/avatars/islands/lightBackground.webp'); // bright sky backdrop — light theme
const lineImg = require('../../assets/avatars/islands/line.webp'); // golden winding trail overlay
const SCENE_RATIO = 2.7; // scene height = width * RATIO (room for 6 stacked islands)
const ISLAND_ASPECT = 1.0; // island art height / width (the day tiles are ~square)

// Island artwork per theme. Dark = the original night cut-outs on the starry
// sky. Light (`*_light`) = brighter day islands on their own blue-sky/clouds,
// soft-feathered so their edges melt into the light-theme gradient backdrop.
const ISLAND_IMG: Record<string, ReturnType<typeof require>> = {
  A1: require('../../assets/avatars/islands/a1.webp'),
  A2: require('../../assets/avatars/islands/a2.webp'),
  B1: require('../../assets/avatars/islands/b1.webp'),
  B2: require('../../assets/avatars/islands/b2.webp'),
  C1: require('../../assets/avatars/islands/c1.webp'),
  C2: require('../../assets/avatars/islands/c2.webp'),
};
const ISLAND_IMG_LIGHT: Record<string, ReturnType<typeof require>> = {
  A1: require('../../assets/avatars/islands/a1_light.webp'),
  A2: require('../../assets/avatars/islands/a2_light.webp'),
  B1: require('../../assets/avatars/islands/b1_light.webp'),
  B2: require('../../assets/avatars/islands/b2_light.webp'),
  C1: require('../../assets/avatars/islands/c1_light.webp'),
  C2: require('../../assets/avatars/islands/c2_light.webp'),
};

const SKY = {
  bottom: '#0E0A2A',
  card: 'rgba(18, 12, 50, 0.72)',
  cardBorder: 'rgba(150, 130, 255, 0.30)',
  textDim: 'rgba(220, 215, 255, 0.7)',
  gold: islandMap.gold,
};

const BADGE = { green: islandMap.green, blue: islandMap.blue, purple: islandMap.purple };

// Light theme: the island tiles carry their own bright blue sky + clouds, so the
// backdrop is a matching blue→pale-blue gradient (not the dark starry image).
const LIGHT_SKY = {
  grad: ['#96CDF8', '#BFE0FB', '#E0ECFA'] as const, // top blue → bottom pale
  title: '#17324F', // dark text readable on the pale-blue sky
  titleDim: 'rgba(23,50,79,0.72)',
};

interface LevelNode {
  code: string; // CEFR — also matches the lesson.level used for navigation
  name: string; // themed island name
  color: string; // level-badge color
  unlockAt: number | null; // min user level to unlock; null = always open
  /** Island image placement, as fractions of the scene (left, top, width). */
  isl: { left: number; top: number; w: number };
}

/**
 * Real per-island progress from `GET /gamification` (`progressByLevel`, which
 * covers every CEFR level a1…c2). `null` = not loaded yet, or the request
 * failed — the label then shows a dash instead of an invented count. Never
 * fall back to hardcoded numbers here: plausible-looking fake progress is
 * worse than showing nothing.
 */
type LevelProgress = { done: number; total: number } | null;

// Serpentine bottom→top climb: A1 sits at the BOTTOM slot and the path ascends
// to C2 at the top (a mountain-climb metaphor). The 6 on-screen slots (and the
// golden trail stretched over them) are unchanged — only which level occupies
// each slot is reversed. The label card is auto-placed under each island.
const LEVELS: LevelNode[] = [
  { code: 'A1', name: 'Forest',    color: BADGE.green,  unlockAt: null, isl: { left: 0.44, top: 0.740, w: 0.52 } },
  { code: 'A2', name: 'Village',   color: BADGE.green,  unlockAt: null, isl: { left: 0.00, top: 0.600, w: 0.50 } },
  { code: 'B1', name: 'Castle',    color: BADGE.blue,   unlockAt: null, isl: { left: 0.47, top: 0.455, w: 0.50 } },
  { code: 'B2', name: 'Mountain',  color: BADGE.blue,   unlockAt: 30,   isl: { left: 0.00, top: 0.300, w: 0.52 } },
  { code: 'C1', name: 'Space',     color: BADGE.purple, unlockAt: 45,   isl: { left: 0.48, top: 0.140, w: 0.50 } },
  { code: 'C2', name: 'Sky Realm', color: BADGE.purple, unlockAt: 60,   isl: { left: 0.00, top: 0.010, w: 0.50 } },
];

/** Add thousands separators (Hermes' toLocaleString is unreliable). */
function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The "you are here" halo — one softly pulsing glow behind the current island
 *  (§3.2: exactly one thing on the map pulses). Still when Reduce Motion is on. */
function HerePulse({ style }: { style: object }) {
  const reduce = useReduceMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduce) { s.value = 1; return; }
    s.value = withRepeat(
      withSequence(withTiming(1.16, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1,
      false,
    );
  }, [reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View pointerEvents="none" style={[style, styles.hereGlow, anim]} />;
}

export default function LessonsScreen() {
  const { token, user } = useAuth();
  const { theme, t } = useSettings();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Light theme uses the bright sky backdrop (lightBackground.png) + the
  // transparent day islands; dark theme uses the starry sky + night cut-outs.
  const isLight = theme === 'light';
  const bgImg = isLight ? lightBgImg : skyImg;
  const islandImg = isLight ? ISLAND_IMG_LIGHT : ISLAND_IMG;

  const [gam, setGam] = useState<Gamification | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The climb starts at the bottom (A1), so jump there once on first render.
  const scrollRef = useRef<ScrollView>(null);
  const didInitialScroll = useRef(false);

  // The map only needs the gamification summary (streak + per-island progress);
  // the lessons themselves are loaded by the level screen the island opens.
  const load = useCallback(async () => {
    if (!token) return;
    try {
      setGam(await getGamification(token));
    } catch (e) {
      console.warn('Lessons map load failed:', (e as Error)?.message ?? e);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    await load();
    setRefreshing(false);
  }, [load]);

  const xp = user?.xp ?? 0;
  const gems = user?.sparks ?? 0;
  // Real daily-streak from the backend; XP still gates island unlocks.
  const userLevel = Math.floor(xp / 100);
  const streak = gam?.currentStreak ?? 0;

  // Four island states (§3.2). Locked = XP-gated; mastered = every lesson done;
  // "current" = the lowest unlocked island you have not finished — the one that
  // pulses and owns the initial scroll. Everything else is unlocked-not-started.
  const isLocked = (n: LevelNode) => n.unlockAt != null && userLevel < n.unlockAt;
  const isMastered = (n: LevelNode) => {
    const pr = gam?.progressByLevel?.[n.code.toLowerCase()];
    return !!pr && pr.total > 0 && pr.done >= pr.total;
  };
  const currentCode = LEVELS.find((n) => !isLocked(n) && !isMastered(n))?.code ?? null;

  // Tapping an island opens that level's lesson journey (path of nodes).
  const openLevel = useCallback(
    (node: LevelNode) => {
      router.push(`/level/${node.code.toLowerCase()}`);
    },
    [router],
  );

  // Full-bleed scene dimensions.
  const sceneW = width;
  const sceneH = sceneW * SCENE_RATIO;
  const CARD_W = Math.min(sceneW * 0.44, 200);
  // Y (px) of the current island — drives the "ahead" trail scrim + initial scroll.
  const currentTop = (() => {
    const n = LEVELS.find((l) => l.code === currentCode);
    return n ? n.isl.top * sceneH : null;
  })();

  return (
    <View style={[styles.root, isLight && { backgroundColor: '#C7E4FB' }]}>
      {/* Fallback color behind the backdrop image (only shows on overscroll). */}
      <LinearGradient
        colors={isLight ? LIGHT_SKY.grad : ['#150F38', '#0E0A2A', '#0E0A2A']}
        style={StyleSheet.absoluteFill}
      />
      {/* THE sky — one fixed backdrop behind the header AND the map. Because the
          header and the scrolling map both float over this single image (neither
          draws its own sky), there is no seam/line between them, and pull-to-
          refresh overscroll simply reveals more of the same continuous sky. The
          map scrolls over it as parallax. */}
      <Image source={bgImg} style={[styles.headerSky, { width: sceneW, height: sceneH, top: -sceneH * 0.12 }]} resizeMode="cover" />
      <View style={styles.safe}>
        {/* STICKY header — pinned above the scrolling map (Apple/Duolingo-style)
            so the title, subtitle and stats (streak / gems / XP) stay visible
            while only the world map below scrolls. Backed by the starry sky
            (clipped by `top`'s overflow:hidden) so its backdrop stays fixed. */}
        <View style={styles.top}>
            {/* The header has NO sky of its own — it floats over the single fixed
                backdrop sky (below), so there's no seam where it meets the map.
                This theme-tuned gradient only tints the top for text readability
                and fades to transparent so the header melts into the sky. */}
            <LinearGradient
              colors={
                isLight
                  ? ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.12)', 'rgba(199,228,251,0.0)']
                  : ['rgba(14,10,42,0.60)', 'rgba(14,10,42,0.30)', 'rgba(14,10,42,0.0)']
              }
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.topInner, { paddingTop: insets.top + 6 }]}>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <AppText variant="h1" color={isLight ? LIGHT_SKY.title : '#FFFFFF'}>{t('lessonsWorldTitle')}</AppText>
                  <Ionicons name="sparkles" size={22} color={isLight ? '#E0A700' : SKY.gold} style={{ marginLeft: 8 }} />
                </View>
                <AppText variant="body" color={isLight ? LIGHT_SKY.titleDim : SKY.textDim} style={styles.subtitle}>
                  {t('lessonsWorldSubtitle')}
                </AppText>
              </View>

              <View style={styles.stats}>
                <StatPill icon="streak" tint={islandMap.streak} value={String(streak)} label={t('statStreak')} />
                <StatPill icon="sparks" tint={BADGE.blue} value={fmt(gems)} label={t('sparks')} />
                <StatPill icon="xp" tint={SKY.gold} value={fmt(xp)} label={t('xpPoints')} />
              </View>
            </View>
        </View>

        {/* Only the world map scrolls — the header above stays pinned. */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, bounded]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={(_w, h) => {
            // Open scrolled to the "you are here" island (§3.2), ~180pt above it
            // so it sits in view. Falls back to the bottom (A1) until progress
            // loads, so a new/offline session still starts at the beginning.
            if (!didInitialScroll.current && h > 0) {
              didInitialScroll.current = true;
              if (currentTop != null) {
                scrollRef.current?.scrollTo({ y: Math.max(0, currentTop - 180), animated: false });
              } else {
                scrollRef.current?.scrollToEnd({ animated: false });
              }
            }
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SKY.gold} />
          }
        >
          {/* Map scene: the islands + trail float over the single fixed sky
              backdrop (rendered once at root), so the sky stays put and scrolls
              as parallax while the map moves — no seam with the header. */}
          <View style={[styles.scene, { width: sceneW, height: sceneH }]}>
            {/* Golden winding trail (line.png) threading the islands, behind them.
                Span (top / height) is tuned to reach from the first to the last
                island — adjust the 0.06 / 0.84 fractions if it drifts. */}
            <Image
              source={lineImg}
              style={{ position: 'absolute', left: 0, top: sceneH * 0.06, width: sceneW, height: sceneH * 0.84 }}
              resizeMode="stretch"
            />
            {LEVELS.map((node) => {
              // Real per-level lesson progress, or null until it loads.
              const progress: LevelProgress = gam?.progressByLevel?.[node.code.toLowerCase()] ?? null;
              const locked = isLocked(node);
              const mastered = isMastered(node);
              const isCurrent = node.code === currentCode;
              const onPress = locked ? undefined : () => openLevel(node);

              const islLeft = node.isl.left * sceneW;
              const islTop = node.isl.top * sceneH;
              const islW = node.isl.w * sceneW;
              const islH = islW * ISLAND_ASPECT;
              const glowSize = islW * 1.08;

              // Label card centered under the island, clamped to the scene.
              const cardLeft = Math.max(4, Math.min(islLeft + islW / 2 - CARD_W / 2, sceneW - CARD_W - 4));
              const cardTop = islTop + islH * 0.96;

              return (
                <Fragment key={node.code}>
                  {/* "You are here" — one pulsing halo behind the current island. */}
                  {isCurrent ? (
                    <HerePulse
                      style={{
                        position: 'absolute',
                        left: islLeft + islW / 2 - glowSize / 2,
                        top: islTop + islH / 2 - glowSize / 2,
                        width: glowSize,
                        height: glowSize,
                      }}
                    />
                  ) : null}

                  {/* Island artwork — the whole image is the tap target */}
                  <Pressable
                    onPress={onPress}
                    style={{ position: 'absolute', left: islLeft, top: islTop, width: islW, height: islH }}
                  >
                    <Image
                      source={islandImg[node.code]}
                      style={[styles.island, locked && styles.islandLocked]}
                      resizeMode="contain"
                    />
                    {locked ? (
                      <View style={styles.islandLock}>
                        <Ionicons name="lock-closed" size={26} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </Pressable>

                  {/* "ЭНД БАЙНА" waypoint chip above the current island. */}
                  {isCurrent ? (
                    <View
                      pointerEvents="none"
                      style={{ position: 'absolute', left: cardLeft, top: islTop - 16, width: CARD_W, alignItems: 'center' }}
                    >
                      <View style={styles.hereChip}>
                        <AppText variant="overline" color="#FFFFFF">{t('youAreHere')}</AppText>
                      </View>
                    </View>
                  ) : null}

                  {/* Floating label card — ringed when current, lockedSurface when locked */}
                  <Pressable
                    onPress={onPress}
                    style={[
                      styles.card,
                      isCurrent && styles.cardCurrent,
                      locked && styles.cardLocked,
                      { width: CARD_W, left: cardLeft, top: cardTop },
                    ]}
                  >
                    <Label node={node} locked={locked} mastered={mastered} progress={progress} />
                  </Pressable>
                </Fragment>
              );
            })}
          </View>

          <View style={{ height: 70 }} />
        </ScrollView>
      </View>
    </View>
  );
}

/** A header stat pill (streak / gems / xp). */
function StatPill({
  icon,
  tint,
  value,
  label,
}: {
  icon: AppIconName;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.pill}>
      <View style={[styles.pillIcon, { backgroundColor: `${tint}26` }]}>
        <AppIcon name={icon} size={30} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>{value}</AppText>
        <AppText variant="overline" color={SKY.textDim} numberOfLines={1}>{label}</AppText>
      </View>
    </View>
  );
}

/** Label-card contents: badge + name, then progress or a lock. Four states:
 *  mastered (gold star + success count), current/unlocked (level badge + track),
 *  locked (lockedInk badge + unlock condition). */
function Label({ node, locked, mastered, progress }: { node: LevelNode; locked: boolean; mastered: boolean; progress: LevelProgress }) {
  const pct = progress && progress.total > 0 ? progress.done / progress.total : 0;
  const badgeBg = mastered ? SKY.gold : locked ? colors.lockedInk : node.color;
  return (
    <>
      <View style={styles.labelTop}>
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          {mastered ? (
            <Ionicons name="star" size={14} color="#FFFFFF" />
          ) : (
            <AppText variant="overline" color="#FFFFFF">{node.code}</AppText>
          )}
        </View>
        <AppText variant="h3" color={locked ? colors.lockedInk : '#FFFFFF'} numberOfLines={1} style={{ flexShrink: 1 }}>
          {node.name}
        </AppText>
      </View>

      {locked ? (
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={18} color={colors.lockedInk} />
          <AppText variant="caption" color={colors.lockedInk} center style={{ marginTop: 4 }}>
            {tf('unlockAtLevel', { n: node.unlockAt ?? 0 })}
          </AppText>
        </View>
      ) : (
        <>
          <View style={styles.progRow}>
            <Ionicons name={mastered ? 'checkmark-circle' : 'leaf'} size={13} color={mastered ? islandMap.green : node.color} />
            <AppText variant="caption" color={mastered ? islandMap.green : '#FFFFFF'}>
              {progress ? `${progress.done}/${progress.total}` : '—'}
            </AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: mastered ? islandMap.green : node.color }]} />
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SKY.bottom },
  safe: { flex: 1 },
  scroll: { paddingTop: 4 },
  top: { position: 'relative', overflow: 'hidden' },
  headerSky: { position: 'absolute', left: 0 },
  topInner: { paddingHorizontal: 16, paddingBottom: 10 },

  header: { marginBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  subtitle: { marginTop: 4, maxWidth: '92%' },

  stats: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: SKY.card,
    borderWidth: 1,
    borderColor: SKY.cardBorder,
  },
  pillIcon: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  scene: { position: 'relative' },
  island: { width: '100%', height: '100%' },
  islandLocked: { opacity: 0.4 },
  islandLock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // "You are here": soft violet halo (pulses) + a waypoint chip above the island.
  hereGlow: { borderRadius: 999, backgroundColor: 'rgba(157,123,255,0.30)' },
  hereChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    shadowColor: colors.glow,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  card: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: SKY.card,
    borderWidth: 1,
    borderColor: SKY.cardBorder,
  },
  // Current island's label sits forward — a glow ring + lift.
  cardCurrent: {
    borderColor: colors.glow,
    borderWidth: 2,
    shadowColor: colors.glow,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  // Locked label uses the lockedSurface pair instead of dimming (keeps contrast).
  cardLocked: {
    backgroundColor: colors.lockedSurface,
    borderColor: 'rgba(139,130,173,0.30)',
  },
  labelTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  lockRow: { alignItems: 'center', marginTop: 6 },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
    marginTop: 6,
  },
  fill: { height: '100%', borderRadius: 999 },
});
