import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getExercises, type Quiz } from '../../src/api/quizzes';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Loading } from '../../src/components/Loading';
import { ProgressBar } from '../../src/components/ProgressBar';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type TintName = keyof typeof tints;

/**
 * One skill screen (Сонсгол / Унших / Бичих / Ярих) = one admin exercise
 * category. There is NO fixed sub-category taxonomy — the categories live in the
 * DB and are authored in admin (`/quizzes?standalone=true&category=<skill>`).
 * This screen shows a progress hero + the REAL, DB-authored exercises for the
 * skill, so mobile always matches admin. Tapping an exercise opens it.
 */
const SKILLS: Record<
  string,
  { label: string; en: string; icon: IconName; grad: readonly [string, string]; percent: number }
> = {
  listening: { label: 'Сонсох', en: 'Listening', icon: 'headset', grad: ['#1E5AE0', '#142A6B'], percent: 60 },
  reading: { label: 'Унших', en: 'Reading', icon: 'book', grad: ['#2BA86A', '#14532D'], percent: 75 },
  speaking: { label: 'Ярих', en: 'Speaking', icon: 'mic', grad: ['#D6418F', '#6B1648'], percent: 68 },
  writing: { label: 'Бичих', en: 'Writing', icon: 'create', grad: ['#C9821F', '#5A3410'], percent: 52 },
};

// Row visuals cycle through a small palette so the DB list still looks lively.
const ROW_STYLES: { icon: IconName; tint: TintName }[] = [
  { icon: 'book', tint: 'green' },
  { icon: 'newspaper', tint: 'amber' },
  { icon: 'chatbubbles', tint: 'pink' },
  { icon: 'grid', tint: 'purple' },
  { icon: 'search', tint: 'blue' },
  { icon: 'sparkles', tint: 'teal' },
  { icon: 'flash', tint: 'orange' },
  { icon: 'trophy', tint: 'amber' },
];

export default function SkillScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const skillKey = key ?? 'listening';
  const skill = SKILLS[skillKey] ?? SKILLS.listening;
  const { token } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setItems([]); return; }
    try {
      const r = await getExercises(token, skillKey);
      setItems(r.items);
    } catch (e) {
      console.warn('Exercises load failed:', (e as Error)?.message ?? e);
      setItems([]);
    }
  }, [token, skillKey]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={skill.label} back showBadges={false} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Today's <skill> — progress hero card */}
        <LinearGradient colors={skill.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroLeft}>
            <AppText variant="overline" color="rgba(255,255,255,0.85)">
              ӨНӨӨ ДӨР · {skill.en.toUpperCase()}
            </AppText>
            <AppText variant="display" color={colors.white} style={styles.heroPercent}>
              {skill.percent}%
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">Явц</AppText>
            <ProgressBar
              value={skill.percent / 100}
              color={colors.white}
              track="rgba(255,255,255,0.28)"
              height={8}
              style={styles.heroBar}
            />
          </View>
          {/* Illustration placeholder — drop a 3D PNG here for pixel-match. */}
          <View style={styles.heroArt}>
            <Ionicons name={skill.icon} size={64} color="rgba(255,255,255,0.95)" />
          </View>
        </LinearGradient>

        <AppText variant="h2" style={styles.sectionTitle}>Дасгалууд</AppText>

        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            Энэ төрлийн дасгал алга 🦊
          </AppText>
        ) : (
          <View style={styles.listCard}>
            {items.map((q, i) => {
              const rs = ROW_STYLES[i % ROW_STYLES.length];
              const t = tints[rs.tint];
              return (
                <Pressable
                  key={q.id}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                  onPress={() => router.push(`/quiz/${q.id}`)}
                >
                  <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
                    <Ionicons name={rs.icon} size={20} color={t.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" numberOfLines={1}>{q.title}</AppText>
                    <AppText variant="caption">
                      {q.questions?.length ?? 0} асуулт · {q.xpReward} XP · {q.level.toUpperCase()}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  // Today's <skill> hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  heroLeft: { flex: 1, gap: spacing.xs },
  heroPercent: { fontSize: 48, lineHeight: 52 },
  heroBar: { marginTop: spacing.xs, marginBottom: spacing.sm },
  heroArt: {
    width: 92,
    height: 92,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },

  sectionTitle: { marginBottom: spacing.md },

  // Grouped premium menu
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },

  empty: { marginTop: spacing.xxl },
  pressed: { opacity: 0.85 },
});
