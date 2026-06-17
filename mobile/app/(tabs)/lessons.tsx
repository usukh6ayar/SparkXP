import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { apiRequest } from '../../src/api/client';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { Pill } from '../../src/components/Pill';
import { IconTile } from '../../src/components/IconTile';
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

function LessonCard({ lesson, progress, onPress }: { lesson: LessonItem; progress: number; onPress: () => void }) {
  const locked = lesson.priceSparks > 0;
  const skill = getSkill(lesson.type);
  const lvl = levelColor[lesson.level] ?? levelColor.a1;

  return (
    <Card onPress={onPress} padding="md" style={styles.card}>
      <IconTile icon={skill.icon} bg={skill.tint.bg} fg={skill.tint.fg} size={56} iconSize={26} />

      <View style={styles.info}>
        <AppText variant="h3" numberOfLines={1}>{lesson.title}</AppText>
        {lesson.description ? (
          <AppText variant="caption" numberOfLines={2} style={styles.desc}>{lesson.description}</AppText>
        ) : null}
        <View style={styles.meta}>
          <Pill label={lesson.level.toUpperCase()} bg={lvl.bg} fg={lvl.fg} />
          <Pill label={skill.label} icon={skill.icon} bg={skill.tint.bg} fg={skill.tint.fg} />
        </View>
      </View>

      {/* Right: price+lock (locked) or progress (unlocked) */}
      <View style={styles.right}>
        {locked ? (
          <>
            <View style={styles.priceRow}>
              <Ionicons name="diamond" size={14} color={colors.sparks} />
              <AppText variant="bodyStrong" color={colors.sparks}>{lesson.priceSparks}</AppText>
            </View>
            <Ionicons name="lock-closed" size={16} color={colors.textMuted} style={styles.lock} />
          </>
        ) : progress >= 1 ? (
          <>
            <View style={styles.doneCircle}>
              <Ionicons name="checkmark" size={16} color={colors.white} />
            </View>
            <AppText variant="caption" color={colors.primary} style={styles.pct}>100%</AppText>
          </>
        ) : (
          <>
            <AppText variant="bodyStrong" color={skill.tint.fg}>{Math.round(progress * 100)}%</AppText>
            <ProgressBar value={progress} color={skill.tint.fg} height={5} style={styles.miniBar} />
          </>
        )}
      </View>
    </Card>
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
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  info: { flex: 1, gap: 4 },
  desc: { marginBottom: 2 },
  meta: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  right: { width: 60, alignItems: 'center', justifyContent: 'center', gap: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lock: {},
  doneCircle: {
    width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  pct: {},
  miniBar: { width: 52 },
  empty: { marginTop: spacing.xxl },
});
