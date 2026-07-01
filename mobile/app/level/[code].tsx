import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { useSettings } from '../../src/settings/SettingsContext';
import { getLessons, type Lesson } from '../../src/api/lessons';
import { AppText } from '../../src/components/Text';
import { colors, islandMap } from '../../src/theme/theme';

/**
 * Level journey — the lessons of one CEFR level laid out as numbered nodes
 * along the winding forest path (assets/avatars/lessonBackground.png), bottom
 * (start) → top (goal). Reached from the "Хичээлийн ертөнц" island map by
 * tapping a level. Real lessons fill the path from the bottom; the remaining
 * nodes show as locked future steps.
 *
 * Scope: FRONTEND-only. Tapping a real node opens its lesson detail.
 */

const bgDark = require('../../assets/avatars/islands/lessonBackground.png'); // dark forest — dark theme
const bgLight = require('../../assets/avatars/islands/lessonLightBackground.png'); // bright forest — light theme
const line = require('../../assets/avatars/islands/line.png'); // golden beaded trail

/** Theme-aware palette for the header UI over the (dark/light) forest backdrop. */
function palette(isLight: boolean) {
  return isLight
    ? {
        text: '#1F2937',
        textDim: 'rgba(31,41,55,0.72)',
        card: 'rgba(255,255,255,0.9)',
        cardBorder: 'rgba(0,0,0,0.06)',
        back: 'rgba(255,255,255,0.9)',
        backIcon: '#1F2937',
        scrim: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.3)', 'transparent'] as const,
        track: 'rgba(0,0,0,0.1)',
        plus: 'rgba(0,0,0,0.08)',
      }
    : {
        text: '#FFFFFF',
        textDim: 'rgba(255,255,255,0.85)',
        card: 'rgba(10,14,30,0.72)',
        cardBorder: 'rgba(150,130,255,0.28)',
        back: 'rgba(0,0,0,0.35)',
        backIcon: '#FFFFFF',
        scrim: ['rgba(6,10,24,0.9)', 'rgba(6,10,24,0.45)', 'transparent'] as const,
        track: 'rgba(255,255,255,0.15)',
        plus: 'rgba(255,255,255,0.18)',
      };
}

// Vertical band (fractions of screen height) the trail image is stretched over.
// The ANCHORS below were sampled from line.png's curve across this same band,
// so every node sits exactly on the painted line.
const LINE_TOP = 0.22; // starts below the header block
const LINE_BOT = 0.96;

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

// Node anchors as fractions of the screen — sampled from line.png's curve so
// each node lands on the golden trail (bottom start → top goal).
const ANCHORS = [
  { x: 0.435, y: 0.908 },
  { x: 0.384, y: 0.802 },
  { x: 0.563, y: 0.696 },
  { x: 0.423, y: 0.590 },
  { x: 0.565, y: 0.484 },
  { x: 0.533, y: 0.378 },
  { x: 0.586, y: 0.276 },
];

const NODE = 60;

export default function LevelScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const levelCode = (code ?? 'a1').toLowerCase();
  const meta = LEVEL[levelCode] ?? { name: 'Level', color: islandMap.purple, emoji: '✨', tier: '', desc: '' };
  const { token, user } = useAuth();
  const { theme } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isLight = theme === 'light';
  const bg = isLight ? bgLight : bgDark;
  const C = palette(isLight);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await getLessons(token, { level: levelCode });
      setLessons(r.items);
    } catch (e) {
      console.warn('Level load failed:', (e as Error)?.message ?? e);
      setLessons([]);
    }
  }, [token, levelCode]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // TODO: real streak + lesson-completion from backend. Placeholders for now.
  const gems = user?.sparks ?? 0;
  const streak = 7;
  const done = 18;
  const total = 40;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <View style={[styles.root, { backgroundColor: isLight ? '#DCEAF5' : '#06101C' }]}>
      <ImageBackground source={bg} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {/* Top scrim so the header reads over the forest top (light=white, dark=navy). */}
      <LinearGradient
        colors={C.scrim}
        style={[styles.topScrim, { height: insets.top + 250 }]}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
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

        {/* Title + tier + description */}
        <View style={styles.titleBlock}>
          <AppText variant="h1" color={C.text} style={styles.bigTitle}>
            {meta.name} {meta.emoji}
          </AppText>
          <View style={styles.tierRow}>
            <View style={[styles.levelChip, { backgroundColor: meta.color }]}>
              <AppText variant="overline" color={colors.white}>{levelCode.toUpperCase()}</AppText>
            </View>
            {!!meta.tier && <AppText variant="bodyStrong" color={meta.color}>{meta.tier}</AppText>}
          </View>
          {!!meta.desc && (
            <AppText variant="caption" color={C.textDim} style={{ marginTop: 4 }}>
              {meta.desc}
            </AppText>
          )}
        </View>

        {/* Progress card */}
        <View style={[styles.progressCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
          <View style={styles.progressTop}>
            <AppText variant="label" color={C.textDim}>Progress</AppText>
            <AppText variant="bodyStrong" color={C.text}>{pct}%</AppText>
          </View>
          <View style={[styles.track, { backgroundColor: C.track }]}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
          <View style={styles.starsRow}>
            <Ionicons name="star" size={16} color={islandMap.gold} />
            <AppText variant="bodyStrong" color={C.text}>{done}/{total}</AppText>
          </View>
        </View>
      </View>

      {/* Golden beaded trail connecting the nodes (sits behind them) */}
      {!loading && (
        <Image
          source={line}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: 0,
            width,
            top: LINE_TOP * height,
            height: (LINE_BOT - LINE_TOP) * height,
          }}
        />
      )}

      {/* Lesson nodes along the path */}
      {loading ? (
        <ActivityIndicator size="large" color={C.text} style={StyleSheet.absoluteFill} />
      ) : (
        ANCHORS.map((a, i) => {
          const lesson = lessons[i];
          const locked = !lesson;
          const left = a.x * width - NODE / 2;
          const top = a.y * height - NODE / 2;
          return (
            <Pressable
              key={i}
              onPress={lesson ? () => router.push(`/lesson/${lesson.id}`) : undefined}
              style={({ pressed }) => [
                styles.node,
                { left, top, borderColor: locked ? 'rgba(255,255,255,0.4)' : meta.color },
                pressed && lesson && { transform: [{ scale: 0.94 }] },
              ]}
            >
              {locked ? (
                <Ionicons name="lock-closed" size={22} color="rgba(255,255,255,0.7)" />
              ) : (
                <AppText variant="h3" color={colors.white}>{i + 1}</AppText>
              )}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06101C' },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
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
    width: 210,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(10,14,30,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(150,130,255,0.28)',
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginTop: 8,
  },
  fill: { height: '100%', borderRadius: 999, backgroundColor: islandMap.green },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
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
