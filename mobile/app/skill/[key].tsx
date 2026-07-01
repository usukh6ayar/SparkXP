import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getExercises, type Quiz } from '../../src/api/quizzes';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { ProgressBar } from '../../src/components/ProgressBar';
import { CategoryBrowser, type BrowserItem } from '../../src/components/CategoryBrowser';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * One skill screen (Сонсгол / Бичих / Ярих) = one admin exercise category.
 * Exercises are DB-authored (`/quizzes?standalone=true&category=<skill>`) and
 * grouped by their сэдэв (`topic`) — a two-level browse (сэдэв → exercises) that
 * always matches whatever admin created. (Унших/reading has its own screen
 * because it is passages, not quizzes.)
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

export default function SkillScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const skillKey = key ?? 'listening';
  const skill = SKILLS[skillKey] ?? SKILLS.listening;
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();

  const [items, setItems] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

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

  // Map exercises → browser rows, bucketed by сэдэв (topic).
  const rows: BrowserItem[] = useMemo(
    () =>
      items.map((q) => ({
        id: q.id,
        title: q.title,
        subtitle: `${q.questions?.length ?? 0} асуулт · ${q.xpReward} XP · ${q.level.toUpperCase()}`,
        category: q.topic,
      })),
    [items],
  );

  const hero = (
    <LinearGradient colors={skill.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heroLeft}>
        <AppText variant="overline" color="rgba(255,255,255,0.85)">
          ӨНӨӨ ДӨР · {skill.en.toUpperCase()}
        </AppText>
        <AppText variant="display" color={c.white} style={styles.heroPercent}>
          {skill.percent}%
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.9)">Явц</AppText>
        <ProgressBar
          value={skill.percent / 100}
          color={c.white}
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
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        title={selectedCat ?? skill.label}
        back
        showBadges={false}
        // Inside a сэдэв, Back returns to the сэдэв list, not off-screen.
        onBack={selectedCat ? () => setSelectedCat(null) : undefined}
      />
      <CategoryBrowser
        items={rows}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        selectedCat={selectedCat}
        onSelectCat={setSelectedCat}
        onOpen={(id) => router.push(`/quiz/${id}`)}
        // Hero only on the сэдэв list (level 1), so level 2 is a clean list.
        hero={selectedCat === null ? hero : undefined}
        emptyText="Энэ төрлийн дасгал алга 🦊"
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },

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
  });
