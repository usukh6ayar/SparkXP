import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getExercises, type Quiz } from '../../src/api/quizzes';
import { loadCompletedExercises } from '../../src/lib/exerciseProgress';
import { TopBar } from '../../src/components/TopBar';
import { ProgressHero } from '../../src/components/ProgressHero';
import { CategoryBrowser, type BrowserItem } from '../../src/components/CategoryBrowser';
import { IELTS_MODULES } from '../../src/constants/ielts';
import { t, tf, type TranslationKey } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';
import { haptics } from '../../src/lib/haptics';
import { skillGradients, type AppColors } from '../../src/theme/theme';

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
  { catKey: TranslationKey; icon: IconName; grad: readonly [string, string] }
> = {
  listening: { catKey: 'catListening', icon: 'headset', grad: skillGradients.listening },
  reading: { catKey: 'catReading', icon: 'book', grad: skillGradients.reading },
  speaking: { catKey: 'catSpeaking', icon: 'mic', grad: skillGradients.speaking },
  writing: { catKey: 'catWriting', icon: 'create', grad: skillGradients.writing },
  grammar: { catKey: 'catGrammar', icon: 'book', grad: skillGradients.grammar },
  fill: { catKey: 'catFill', icon: 'extension-puzzle', grad: skillGradients.fill },
  // IELTS Listening/Reading practice sets are quizzes too (category
  // `ielts_<module>`), so they browse through this very screen — the runner then
  // adds the passage/audio and reports a band.
  ...Object.fromEntries(
    IELTS_MODULES.filter((m) => m.auto).map((m) => [
      m.category,
      { catKey: m.labelKey, icon: m.icon, grad: m.grad },
    ]),
  ),
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
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setItems([]); return; }
    try {
      const [r, done] = await Promise.all([getExercises(token, skillKey), loadCompletedExercises()]);
      setItems(r.items);
      setCompleted(done);
      setError(false);
    } catch (e) {
      console.warn('Exercises load failed:', (e as Error)?.message ?? e);
      setItems([]);
      setError(true);
    }
  }, [token, skillKey]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Refresh completion when returning from a quiz (checkmarks update live).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCompletedExercises().then((done) => { if (active) setCompleted(done); });
      return () => { active = false; };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    await load();
    setRefreshing(false);
  }, [load]);

  // Map exercises → browser rows, bucketed by сэдэв (topic).
  const rows: BrowserItem[] = useMemo(
    () =>
      items.map((q) => ({
        id: q.id,
        title: q.title,
        subtitle: `${tf('questionCount', { n: q.questions?.length ?? 0 })} · ${q.xpReward} XP · ${q.level.toUpperCase()}`,
        category: q.topic,
      })),
    [items],
  );

  // Real progress: how many of this skill's exercises the user has passed.
  const doneCount = useMemo(() => items.filter((q) => completed.has(q.id)).length, [items, completed]);

  const hero = (
    <ProgressHero
      eyebrow={t(skill.catKey)}
      done={doneCount}
      total={items.length}
      gradient={skill.grad}
      icon={skill.icon}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        title={selectedCat ?? t(skill.catKey)}
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
        error={error}
        onRetry={load}
        selectedCat={selectedCat}
        onSelectCat={setSelectedCat}
        onOpen={(id) => router.push(`/quiz/${id}`)}
        // Hero only on the сэдэв list (level 1), so level 2 is a clean list.
        hero={selectedCat === null ? hero : undefined}
        emptyText={t('noSkillExercises')}
        completedIds={completed}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
  });
