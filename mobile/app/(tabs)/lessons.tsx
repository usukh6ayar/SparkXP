import { Fragment, useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getLessons, type Lesson } from '../../src/api/lessons';
import { AppText } from '../../src/components/Text';

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
 * Scope: FRONTEND-only. Progress / streak are placeholders until the backend
 * tracks lesson completion + daily streak (see TODOs).
 */

const skyImg = require('../../assets/avatars/islands/background.png'); // pure starry sky (scene + header backdrop)
const lineImg = require('../../assets/avatars/islands/line.png'); // golden winding trail overlay
const SCENE_RATIO = 2.6; // scene height = width * RATIO (room for 6 stacked islands)
const ISLAND_ASPECT = 1.18; // island art height / width (avg of the 6 cut-outs)

// Feathered island cut-outs (transparent, float on the sky).
const ISLAND_IMG: Record<string, ReturnType<typeof require>> = {
  A1: require('../../assets/avatars/islands/a1.png'),
  A2: require('../../assets/avatars/islands/a2.png'),
  B1: require('../../assets/avatars/islands/b1.png'),
  B2: require('../../assets/avatars/islands/b2.png'),
  C1: require('../../assets/avatars/islands/c1.png'),
  C2: require('../../assets/avatars/islands/c2.png'),
};

const SKY = {
  bottom: '#0E0A2A',
  card: 'rgba(18, 12, 50, 0.72)',
  cardBorder: 'rgba(150, 130, 255, 0.30)',
  textDim: 'rgba(220, 215, 255, 0.7)',
  gold: '#F5C518',
};

const BADGE = { green: '#22C55E', blue: '#38BDF8', purple: '#8B5CF6' };

interface LevelNode {
  code: string; // CEFR — also matches the lesson.level used for navigation
  name: string; // themed island name
  color: string; // level-badge color
  unlockAt: number | null; // min user level to unlock; null = always open
  // Placeholders (no backend completion tracking yet) — match the design.
  done: number;
  total: number;
  /** Island image placement, as fractions of the scene (left, top, width). */
  isl: { left: number; top: number; w: number };
}

// Serpentine top→bottom path. The label card is auto-placed under each island.
const LEVELS: LevelNode[] = [
  { code: 'A1', name: 'Forest',    color: BADGE.green,  unlockAt: null, done: 15, total: 30, isl: { left: 0.00, top: 0.010, w: 0.52 } },
  { code: 'A2', name: 'Village',   color: BADGE.green,  unlockAt: null, done: 20, total: 30, isl: { left: 0.46, top: 0.150, w: 0.52 } },
  { code: 'B1', name: 'Castle',    color: BADGE.blue,   unlockAt: null, done: 10, total: 30, isl: { left: 0.00, top: 0.310, w: 0.55 } },
  { code: 'B2', name: 'Mountain',  color: BADGE.blue,   unlockAt: 30,   done: 0,  total: 30, isl: { left: 0.45, top: 0.460, w: 0.52 } },
  { code: 'C1', name: 'Space',     color: BADGE.purple, unlockAt: 45,   done: 0,  total: 30, isl: { left: 0.00, top: 0.605, w: 0.52 } },
  { code: 'C2', name: 'Sky Realm', color: BADGE.purple, unlockAt: 60,   done: 0,  total: 30, isl: { left: 0.42, top: 0.745, w: 0.56 } },
];

/** Add thousands separators (Hermes' toLocaleString is unreliable). */
function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function LessonsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [byLevel, setByLevel] = useState<Record<string, Lesson[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Group all published lessons by level so tapping an island opens its first.
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await getLessons(token, {});
      const map: Record<string, Lesson[]> = {};
      for (const l of r.items) (map[l.level?.toLowerCase()] ??= []).push(l);
      setByLevel(map);
    } catch (e) {
      console.warn('Lessons map load failed:', (e as Error)?.message ?? e);
      setByLevel({});
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const xp = user?.xp ?? 0;
  const gems = user?.sparks ?? 0;
  // TODO: real level field + daily-streak counter once the backend has them.
  const userLevel = Math.floor(xp / 100);
  const streak = 7;

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

  return (
    <View style={styles.root}>
      {/* Dark backdrop (no bright purple — the starry sky image fills the top). */}
      <LinearGradient colors={['#150F38', '#0E0A2A', '#0E0A2A']} style={StyleSheet.absoluteFill} />
      <View style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SKY.gold} />
          }
        >
          {/* Header + stats — backed by the real starry sky so it blends with
              the scene (no flat block). The sky image is offset to a star field
              below the galaxy, which stays unique to the scene below. */}
          <View style={styles.top}>
            <Image source={skyImg} style={[styles.headerSky, { width: sceneW, height: sceneH, top: -sceneH * 0.12 }]} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(14,10,42,0.55)', 'rgba(14,10,42,0.35)', 'rgba(14,10,42,0.6)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.topInner, { paddingTop: insets.top + 6 }]}>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <AppText variant="h1" color="#FFFFFF">Хичээлийн ертөнц</AppText>
                    <Ionicons name="sparkles" size={18} color={SKY.gold} style={{ marginLeft: 6 }} />
                  </View>
                  <AppText variant="caption" color={SKY.textDim} style={{ marginTop: 2 }}>
                    Адал явдлаар дамжуулж англи хэлээ эзэмш!
                  </AppText>
                </View>
                <Pressable style={styles.shopBtn}>
                  <MaterialCommunityIcons name="crown" size={17} color={SKY.gold} />
                  <AppText variant="label" color="#FFFFFF" style={{ marginLeft: 6 }}>Эржийн дэлгүүр</AppText>
                </Pressable>
              </View>

              <View style={styles.stats}>
                <StatPill icon="flame" tint="#FF7A1A" value={String(streak)} label="Өдөр даралал" />
                <StatPill icon="diamond" tint={BADGE.blue} value={fmt(gems)} label="Очирхон" />
                <StatPill icon="flash" tint={SKY.gold} value={fmt(xp)} label="XP оноо" />
              </View>
            </View>
          </View>

          {/* Map scene: starry-sky backdrop + 6 floating islands + labels */}
          <View style={[styles.scene, { width: sceneW, height: sceneH }]}>
            <Image source={skyImg} style={StyleSheet.absoluteFill} resizeMode="cover" />

            {/* Golden winding trail (line.png) threading the islands, behind them.
                Span (top / height) is tuned to reach from the first to the last
                island — adjust the 0.06 / 0.84 fractions if it drifts. */}
            <Image
              source={lineImg}
              style={{ position: 'absolute', left: 0, top: sceneH * 0.06, width: sceneW, height: sceneH * 0.84 }}
              resizeMode="stretch"
            />

            {LEVELS.map((node) => {
              const locked = node.unlockAt != null && userLevel < node.unlockAt;
              const onPress = locked ? undefined : () => openLevel(node);

              const islLeft = node.isl.left * sceneW;
              const islTop = node.isl.top * sceneH;
              const islW = node.isl.w * sceneW;
              const islH = islW * ISLAND_ASPECT;

              // Label card centered under the island, clamped to the scene.
              const cardLeft = Math.max(4, Math.min(islLeft + islW / 2 - CARD_W / 2, sceneW - CARD_W - 4));
              const cardTop = islTop + islH * 0.80;

              return (
                <Fragment key={node.code}>
                  {/* Island artwork — the whole image is the tap target */}
                  <Pressable
                    onPress={onPress}
                    style={{ position: 'absolute', left: islLeft, top: islTop, width: islW, height: islH }}
                  >
                    <Image
                      source={ISLAND_IMG[node.code]}
                      style={[styles.island, locked && styles.islandLocked]}
                      resizeMode="contain"
                    />
                    {locked && (
                      <View style={styles.islandLock}>
                        <Ionicons name="lock-closed" size={26} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                  {/* Floating label card */}
                  <Pressable
                    onPress={onPress}
                    style={[styles.card, { width: CARD_W, left: cardLeft, top: cardTop }]}
                  >
                    <Label node={node} locked={locked} />
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
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.pill}>
      <View style={[styles.pillIcon, { backgroundColor: `${tint}26` }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color="#FFFFFF" numberOfLines={1}>{value}</AppText>
        <AppText variant="overline" color={SKY.textDim} numberOfLines={1}>{label}</AppText>
      </View>
    </View>
  );
}

/** Label-card contents: badge + name, then progress or a lock. */
function Label({ node, locked }: { node: LevelNode; locked: boolean }) {
  const pct = node.total > 0 ? node.done / node.total : 0;
  return (
    <>
      <View style={styles.labelTop}>
        <View style={[styles.badge, { backgroundColor: node.color }]}>
          <AppText variant="overline" color="#FFFFFF">{node.code}</AppText>
        </View>
        <AppText variant="h3" color="#FFFFFF" numberOfLines={1} style={{ flexShrink: 1 }}>
          {node.name}
        </AppText>
      </View>

      {locked ? (
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={18} color={SKY.textDim} />
          <AppText variant="caption" color={SKY.textDim} center style={{ marginTop: 4 }}>
            Түвшин {node.unlockAt}-д{'\n'}нээгдэнэ
          </AppText>
        </View>
      ) : (
        <>
          <View style={styles.progRow}>
            <Ionicons name="leaf" size={13} color={node.color} />
            <AppText variant="caption" color="#FFFFFF">{node.done}/{node.total}</AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: node.color }]} />
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

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: SKY.card,
    borderWidth: 1,
    borderColor: SKY.cardBorder,
  },

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
  pillIcon: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  scene: { position: 'relative' },
  island: { width: '100%', height: '100%' },
  islandLocked: { opacity: 0.4 },
  islandLock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
