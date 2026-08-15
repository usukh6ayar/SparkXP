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
import {
  IELTS_MODULES,
  displayTopic,
  groupSections,
  ieltsModuleOf,
  isIeltsCategory,
} from '../../src/constants/ielts';
import { SORIL_CATEGORY } from '../../src/constants/soril';
import { quizSkill } from '../../src/constants/quizSkill';
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
  // IELTS-ийн 4 модуль бүгд quiz (category `ielts_<module>`) тул яг энэ
  // дэлгэцээр жагсаана; нээхэд шалгалтын тоглуулагч эх материал/Part/band-ыг
  // нэмнэ. (Writing/Speaking-ийг ч оруулсан — тэд урьд нь Part бүтэцгүй
  // тусдаа дэлгэцтэй байв.)
  ...Object.fromEntries(
    IELTS_MODULES.map((m) => [
      m.category,
      { catKey: m.labelKey, icon: m.icon, grad: m.grad },
    ]),
  ),
};

/** How many exam parts a practice set is split into. */
function countParts(quiz: Quiz): number {
  return groupSections(quiz.questions ?? []).length;
}

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

  const load = useCallback(async () => {
    if (!token) { setItems([]); return; }
    try {
      /*
       * Админы **Сорил** хуудсаар үүсгэсэн контент нь `category: 'soril'`,
       * ур чадвар нь `quizType`-д (listening · grammar · fill) байдаг.
       *
       * ⚠️ Тэдгээрийг ЭНД нийлүүлнэ — өөрөөр хэлбэл «Сонсгол» дэлгэц нь
       * Дасгал хуудасны сонсголын дасгал ба Сорил хуудасны сонсголын сорил
       * хоёуланг нэг жагсаалтад харуулна. Урьд нь Сорилын контент өөрийн
       * тусдаа дэлгэцтэй байсан нь сурагчид нэмэлт алхам, нэмэлт ойлголт
       * үүсгэдэг байв — нэг ур чадвар = нэг жагсаалт байх нь ойлгомжтой.
       */
      const [own, soril, done] = await Promise.all([
        getExercises(token, skillKey),
        getExercises(token, SORIL_CATEGORY).catch(() => ({ items: [] as Quiz[] })),
        loadCompletedExercises(),
      ]);
      // Ур чадварыг `quizSkill()` шийднэ — `category` ба `quizType` хоёрын аль
      // нэгэнд байж болно (`src/constants/quizSkill.ts`). Гүйцэтгэгч дэлгэц ч
      // яг үүнийг ашигладаг тул жагсаалт ба нээгдэх зан төлөв **үргэлж нийцнэ**.
      const extra = soril.items.filter((q) => quizSkill(q) === skillKey);
      setItems([...own.items, ...extra]);
      setCompleted(done);
      setError(false);
    } catch (e) {
      console.warn('Exercises load failed:', (e as Error)?.message ?? e);
      setItems([]);
      setError(true);
    }
  }, [token, skillKey]);

  // Speaking is a dedicated pronunciation drill, not a quiz list — send any
  // `/skill/speaking` link there so old entry points keep working.
  useEffect(() => {
    if (skillKey === 'speaking') router.replace('/speaking');
  }, [skillKey, router]);

  useEffect(() => {
    if (skillKey === 'speaking') return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, skillKey]);

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

  const isIelts = isIeltsCategory(skillKey);

  // Map exercises → browser rows, bucketed by сэдэв (topic).
  const rows: BrowserItem[] = useMemo(
    () =>
      items.map((q) => {
        const questionCount = q.questions?.length ?? 0;
        /*
         * ⚠️ **IELTS-д CEFR түвшин байхгүй.** Жинхэнэ шалгалт бүх шалгуулагчид
         * ижил — «B1-ийн Listening» гэж үгүй, ялгаа нь зөвхөн хэдийг зөв
         * бөглөснөөс гарах band. Тиймээс IELTS мөрөнд түвшин огт харуулахгүй,
         * оронд нь **бүтцийг** нь хэлнэ (4 Section г.м.) — тэр нь сурагчид
         * юу хийхээ ойлгоход хэрэгтэй цорын ганц мэдээлэл.
         */
        const parts = isIelts ? countParts(q) : 0;
        const meta = [
          tf('questionCount', { n: questionCount }),
          parts > 1 ? `${parts} ${ieltsModuleOf(q.category)?.partLabel ?? 'Section'}` : null,
          `${q.xpReward} XP`,
          isIelts ? null : q.level.toUpperCase(),
        ].filter(Boolean);

        return {
          id: q.id,
          title: q.title,
          subtitle: meta.join(' · '),
          /*
           * Бүлгийн нэр: админы бичсэн **сэдэв**, байхгүй бол **түвшин** (A1,
           * B2…) — IELTS-д түвшин утгагүй тул тэнд зөвхөн сэдэв.
           *
           * ⚠️ Сорил хуудсаар үүсгэсэн контентод `topic` байдаггүй тул урьд нь
           * бүгд «Бусад» гэсэн ганц овоонд унаж, 10+ дасгал ялгаагүй нэг бүлэг
           * болдог байв. Түвшин нь мөр бүрд байдаг ба сурагчид шууд утга
           * учиртай — өөрийн түвшнээ сонгоод ороход хангалттай.
           */
          category: displayTopic(q.topic) || (isIelts ? null : q.level.toUpperCase()),
        };
      }),
    [items, isIelts],
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
        title={t(skill.catKey)}
        back
        showBadges={false}
      />
      <CategoryBrowser
        items={rows}
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        error={error}
        onRetry={load}
        // IELTS sets open in the exam player (parts, answer sheet, band), not
        // the one-question-at-a-time drill runner every other skill uses.
        onOpen={(id) => router.push(isIelts ? `/ielts/test/${id}` : `/quiz/${id}`)}
        hero={hero}
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
