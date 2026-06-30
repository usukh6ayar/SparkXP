import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { ProgressBar } from '../../src/components/ProgressBar';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type TintName = keyof typeof tints;
type SubCat = { key: string; label: string; icon: IconName; tint: TintName };

/**
 * The 4 exercise (Дасгал) skill screens. Each renders the same template:
 *   header · "Today's <skill>" progress hero · "Сонгох хичээлүүд" sub-category menu.
 * The sub-category menu is a fixed taxonomy (the master design). Tapping a
 * sub-category opens the real, DB-authored exercises for that skill
 * (/exercises/<key>) — content stays in the database. The hero `percent` is a
 * placeholder until the backend tracks per-skill progress (cf. home streak).
 */
const SKILLS: Record<
  string,
  {
    label: string;
    en: string;
    icon: IconName;
    grad: readonly [string, string];
    percent: number; // TODO(data): real progress once completion is tracked
    subcats: SubCat[];
  }
> = {
  listening: {
    label: 'Сонсох', en: 'Listening', icon: 'headset', grad: ['#1E5AE0', '#142A6B'], percent: 60,
    subcats: [
      { key: 'everyday', label: 'Everyday Conversations', icon: 'chatbubbles', tint: 'blue' },
      { key: 'pronunciation', label: 'Pronunciation Listening', icon: 'mic', tint: 'pink' },
      { key: 'songs', label: 'Songs & Lyrics', icon: 'musical-notes', tint: 'purple' },
      { key: 'movies', label: 'Movie Clips', icon: 'film', tint: 'orange' },
      { key: 'podcasts', label: 'Podcasts', icon: 'radio', tint: 'teal' },
      { key: 'news', label: 'News Listening', icon: 'newspaper', tint: 'green' },
      { key: 'travel', label: 'Travel Listening', icon: 'airplane', tint: 'amber' },
      { key: 'challenge', label: 'Listening Challenge', icon: 'trophy', tint: 'amber' },
    ],
  },
  reading: {
    label: 'Унших', en: 'Reading', icon: 'book', grad: ['#2BA86A', '#14532D'], percent: 75,
    subcats: [
      { key: 'short-stories', label: 'Short Stories', icon: 'book', tint: 'green' },
      { key: 'articles', label: 'Daily Articles', icon: 'newspaper', tint: 'amber' },
      { key: 'dialog', label: 'Dialog Reading', icon: 'chatbubbles', tint: 'purple' },
      { key: 'sentence-matching', label: 'Sentence Matching', icon: 'shuffle', tint: 'pink' },
      { key: 'comprehension', label: 'Reading Comprehension', icon: 'search', tint: 'blue' },
      { key: 'vocab-context', label: 'Vocabulary in Context', icon: 'pricetags', tint: 'orange' },
      { key: 'speed', label: 'Speed Reading', icon: 'flash', tint: 'teal' },
      { key: 'challenge', label: 'Reading Challenge', icon: 'trophy', tint: 'amber' },
    ],
  },
  speaking: {
    label: 'Ярих', en: 'Speaking', icon: 'mic', grad: ['#D6418F', '#6B1648'], percent: 68,
    subcats: [
      { key: 'pronunciation', label: 'Pronunciation', icon: 'mic', tint: 'pink' },
      { key: 'shadowing', label: 'Shadowing', icon: 'headset', tint: 'purple' },
      { key: 'conversation', label: 'Conversation Practice', icon: 'chatbubbles', tint: 'blue' },
      { key: 'role-play', label: 'Role Play', icon: 'people', tint: 'orange' },
      { key: 'self-intro', label: 'Self Introduction', icon: 'person', tint: 'teal' },
      { key: 'interview', label: 'Job Interview', icon: 'briefcase', tint: 'green' },
      { key: 'travel', label: 'Travel English', icon: 'airplane', tint: 'amber' },
      { key: 'ai-coach', label: 'AI Speaking Coach', icon: 'sparkles', tint: 'pink' },
      { key: 'challenge', label: 'Speaking Challenge', icon: 'trophy', tint: 'amber' },
    ],
  },
  writing: {
    label: 'Бичих', en: 'Writing', icon: 'create', grad: ['#C9821F', '#5A3410'], percent: 52,
    subcats: [
      { key: 'sentence', label: 'Sentence Builder', icon: 'create', tint: 'green' },
      { key: 'paragraph', label: 'Paragraph Builder', icon: 'document-text', tint: 'purple' },
      { key: 'essay', label: 'Essay Writing', icon: 'newspaper', tint: 'blue' },
      { key: 'email', label: 'Email Writing', icon: 'mail', tint: 'pink' },
      { key: 'story', label: 'Story Writing', icon: 'book', tint: 'orange' },
      { key: 'grammar', label: 'Grammar Correction', icon: 'checkmark-done', tint: 'teal' },
      { key: 'ai-feedback', label: 'AI Writing Feedback', icon: 'sparkles', tint: 'amber' },
      { key: 'challenge', label: 'Writing Challenge', icon: 'trophy', tint: 'amber' },
    ],
  },
};

export default function SkillScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const skillKey = key ?? 'listening';
  const skill = SKILLS[skillKey] ?? SKILLS.listening;
  const router = useRouter();

  // A sub-category opens the skill's exercises (DB-authored). The sub-category
  // label rides along as the screen title; once the backend tags exercises by
  // sub-category it can also filter them.
  const openExercises = (sub?: SubCat) => {
    const title = sub?.label ?? skill.label;
    router.push(`/exercises/${skillKey}?title=${encodeURIComponent(title)}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={skill.label} back showBadges={false} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
            <Pressable style={({ pressed }) => [styles.continueBtn, pressed && styles.pressed]} onPress={() => openExercises()}>
              <AppText variant="bodyStrong" color={skill.grad[1]}>Үргэлжлүүлэх →</AppText>
            </Pressable>
          </View>
          {/* Illustration placeholder — drop a 3D PNG here for pixel-match. */}
          <View style={styles.heroArt}>
            <Ionicons name={skill.icon} size={64} color="rgba(255,255,255,0.95)" />
          </View>
        </LinearGradient>

        <AppText variant="h2" style={styles.sectionTitle}>Сонгох хичээлүүд</AppText>

        <View style={styles.listCard}>
          {skill.subcats.map((s, i) => {
            const t = tints[s.tint];
            return (
              <Pressable
                key={s.key}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                onPress={() => openExercises(s)}
              >
                <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
                  <Ionicons name={s.icon} size={20} color={t.fg} />
                </View>
                <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>{s.label}</AppText>
                <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
              </Pressable>
            );
          })}
        </View>

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
  continueBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
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

  pressed: { opacity: 0.85 },
});
