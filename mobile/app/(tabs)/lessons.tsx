import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { apiRequest } from '../../src/api/client';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Loading } from '../../src/components/Loading';
import { SKILL, getSkill } from '../../src/constants/skills';
import { colors, spacing, radius, levelColor } from '../../src/theme/theme';

interface LessonItem {
  id: string;
  title: string;
  description: string | null;
  level: string;
  type: string;
  priceSparks: number;
  thumbnailUrl: string | null;
  content?: { xp?: number; minutes?: number } & Record<string, unknown>;
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

// TODO: бодит явц (backend lesson-completion tracking) ороогүй — түр placeholder.
const MOCK_PROGRESS = [1, 0.75, 0, 0.4, 0, 0.2];

export default function LessonsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const [level, setLevel] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Plain query string — React Native's URLSearchParams is unreliable.
    let url = '/lessons?limit=50&isPublished=true';
    if (type) url += `&type=${type}`;
    if (level) url += `&level=${level.toLowerCase()}`;
    try {
      const r = await apiRequest<{ items: LessonItem[] }>(url, { token });
      setLessons(r.items);
    } catch (e) {
      console.warn('Lessons load failed:', (e as Error)?.message ?? e);
      setLessons([]);
    }
  }, [token, type, level]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const title = type ? SKILL[type]?.label ?? 'Хичээлүүд' : 'Хичээлүүд';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={title} back={!!type} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <AppText variant="caption" style={styles.subtitle}>
          Сонголт хийж, хичээлээ үргэлжлүүлээрэй.
        </AppText>

        {/* Level filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip label="Бүх түвшин" active={level === null} onPress={() => setLevel(null)} />
          {LEVELS.map((lv) => (
            <FilterChip key={lv} label={lv} active={level === lv} onPress={() => setLevel(lv)} />
          ))}
        </ScrollView>

        {loading ? (
          <Loading />
        ) : lessons.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            Энэ түвшний хичээл алга 🦊
          </AppText>
        ) : (
          lessons.map((l, i) => (
            <LessonCard key={l.id} lesson={l} progress={MOCK_PROGRESS[i % MOCK_PROGRESS.length]} onPress={() => router.push(`/lesson/${l.id}`)} />
          ))
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <AppText variant="label" color={active ? colors.white : colors.textSecondary}>{label}</AppText>
    </Pressable>
  );
}

/** Full-width image-banner card: thumbnail bg, level badge, title, progress. */
function LessonCard({ lesson, progress, onPress }: { lesson: LessonItem; progress: number; onPress: () => void }) {
  const skill = getSkill(lesson.type);
  const lvl = levelColor[lesson.level] ?? levelColor.a1;
  const pct = Math.round(progress * 100);
  const xp = lesson.content?.xp;
  const minutes = lesson.content?.minutes;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && styles.bannerPressed]}
    >
      {/* Background: thumbnail image, or a skill-colored gradient fallback */}
      {lesson.thumbnailUrl ? (
        <ImageBackground
          source={{ uri: lesson.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[skill.tint.fg, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <Ionicons name={skill.icon} size={90} color="rgba(255,255,255,0.18)" style={styles.bgIcon} />
        </LinearGradient>
      )}

      {/* Left-to-right dark scrim so overlaid text stays legible */}
      <LinearGradient
        colors={['rgba(18,10,40,0.82)', 'rgba(18,10,40,0.32)', 'rgba(18,10,40,0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.bannerContent}>
        <View style={[styles.levelBadge, { backgroundColor: lvl.fg }]}>
          <AppText variant="overline" color={colors.white}>{lesson.level.toUpperCase()}</AppText>
        </View>
        <View style={{ flex: 1 }} />
        <AppText variant="h2" color={colors.white} numberOfLines={1}>{lesson.title}</AppText>
        {lesson.description ? (
          <AppText variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1} style={styles.bannerDesc}>
            {lesson.description}
          </AppText>
        ) : null}

        <View style={styles.bannerProgress}>
          <AppText variant="label" color={colors.white}>{pct}%</AppText>
          <ProgressBar
            value={progress}
            color={progress >= 1 ? colors.success : colors.white}
            track="rgba(255,255,255,0.3)"
            height={6}
            style={{ flex: 1 }}
          />
        </View>

        {xp != null || minutes != null ? (
          <View style={styles.bannerMeta}>
            {xp != null ? (
              <View style={styles.metaItem}>
                <Ionicons name="flash" size={13} color={colors.xp} />
                <AppText variant="caption" color={colors.white}>{xp} XP</AppText>
              </View>
            ) : null}
            {minutes != null ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.85)" />
                <AppText variant="caption" color="rgba(255,255,255,0.85)">{minutes} мин</AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  subtitle: { marginBottom: spacing.md },
  filterRow: { gap: spacing.sm, paddingBottom: spacing.lg, paddingRight: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  // Image-banner lesson card
  banner: {
    height: 168,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  bannerPressed: { opacity: 0.92 },
  bgIcon: { position: 'absolute', right: 16, bottom: 12 },
  bannerContent: { flex: 1, padding: spacing.lg },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  bannerDesc: { marginTop: 2 },
  bannerProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  bannerMeta: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { marginTop: spacing.xxl },
});
