import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon } from '../../src/components/AppIcon';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/auth/AuthContext';
import * as lessonsApi from '../../src/api/lessons';
import type { Lesson } from '../../src/api/lessons';
import { getQuizzes, type Quiz } from '../../src/api/quizzes';
import { getWords, type Word } from '../../src/api/words';
import { setLastLesson } from '../../src/lib/lastLesson';
import { alertError, confirm } from '../../src/lib/alerts';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Pill } from '../../src/components/Pill';
import { Button } from '../../src/components/Button';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { CelebrationScreen } from '../../src/components/celebration/CelebrationScreen';
import { celebrationCopy } from '../../src/components/celebration/copy';
import { getSkill } from '../../src/constants/skills';
import { haptics } from '../../src/lib/haptics';
import { showXpToast } from '../../src/lib/xpToast';
import { useReduceMotion } from '../../src/lib/motion';
import { t, tf } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, levelColor, type AppColors } from '../../src/theme/theme';
import { bounded } from '../../src/theme/responsive';
import { checkCelebrations } from '../../src/lib/useCelebrations';

const banner = require('../../assets/home-banner.webp');

/** Replaces the deprecated `allowsFullscreen` prop. Module-level so the object
 *  identity is stable — an inline literal re-sends the prop to native every
 *  render. */
const FULLSCREEN = { enable: true } as const;

/** Nice labels for the 4 lesson-test categories. */
function catLabels(): Record<string, string> {
  return {
    listening: t('catListening'),
    reading: t('catReading'),
    writing: t('catWriting'),
    speaking: t('catSpeaking'),
    fill: t('catFill'),
  };
}

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const reduceMotion = useReduceMotion();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  // Words an admin attached to this lesson (empty for lessons with none).
  const [words, setWords] = useState<Word[]>([]);
  const [done, setDone] = useState(false); // lesson watched → quizzes unlocked
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  /** The full-screen celebration, and the XP the server actually paid out. */
  const [celebrating, setCelebrating] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);

  /** Lets the celebration land the student on the tests it just unlocked. */
  const scrollRef = useRef<ScrollView>(null);

  const doneKey = `lesson_done:${id}`;
  const videoUrl = (lesson?.content as { videoUrl?: string } | undefined)?.videoUrl ?? null;
  // Cover uploaded in admin. Newer lessons keep it on the column, older ones only
  // inside `content` — read both so an authored image always shows.
  const coverUrl =
    lesson?.thumbnailUrl ?? (lesson?.content as { imageUrl?: string } | undefined)?.imageUrl ?? null;
  const player = useVideoPlayer(videoUrl, (p) => { p.loop = false; });

  // Load the real video source once the lesson (and its URL) arrives.
  // `replaceAsync`, not `replace`: on iOS the sync version loads the asset on
  // the main thread, which freezes the UI while the video is fetched.
  useEffect(() => {
    if (videoUrl) player.replaceAsync(videoUrl).catch(() => { /* keep the fallback image */ });
  }, [videoUrl, player]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [l, access, qz, wordList, savedDone] = await Promise.all([
        lessonsApi.getLesson(id, token),
        lessonsApi.checkAccess(id, token),
        getQuizzes(token, { lessonId: id }),
        // Optional section — a failure here must not blank the whole lesson.
        getWords(token, { lessonId: id, limit: 100 }).catch(() => ({ items: [] as Word[] })),
        AsyncStorage.getItem(doneKey),
      ]);
      setLesson(l);
      setHasAccess(access.hasAccess);
      setQuizzes(qz.items);
      setWords(wordList.items);
      setDone(savedDone === '1');
      setLastLesson({ id: l.id, title: l.title, thumbnailUrl: l.thumbnailUrl, type: l.type, level: l.level });
      setError(false);
    } catch (e) {
      console.warn('Lesson load failed:', (e as Error)?.message ?? e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, token, doneKey]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(doneKey).then((v) => setDone(v === '1'));
    }, [doneKey]),
  );

  /**
   * Finish the lesson: unlock the tests, bank the XP, then celebrate.
   *
   * The celebration opens only once `completeLesson` has answered, so the
   * number it announces is the server's — a re-watch pays 0 and must not claim
   * otherwise. If the call fails the celebration still runs, just without XP:
   * the student did the work either way.
   */
  async function markDone() {
    await AsyncStorage.setItem(doneKey, '1');
    setDone(true);
    let xp = 0;
    if (token && id) {
      try {
        const res = await lessonsApi.completeLesson(id, token);
        xp = res.xpAwarded;
        if (xp > 0) showXpToast(xp);
      } catch { /* non-critical */ }
    }
    setEarnedXp(xp);
    setCelebrating(true);
  }

  /** Dismissing releases any trophy/streak queued behind it (never two modals). */
  const closeCelebration = useCallback(() => {
    setCelebrating(false);
    checkCelebrations();
    // The tests mount below the fold — land the student on them.
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 260);
  }, []);

  function unlock() {
    if (!lesson) return;
    if ((user?.sparks ?? 0) < lesson.priceSparks) {
      alertError(
        t('insufficientSparksBody')
          .replace('{have}', String(user?.sparks ?? 0))
          .replace('{need}', String(lesson.priceSparks)),
        t('insufficientSparksTitle'),
      );
      return;
    }
    confirm({
      title: t('unlockConfirmTitle'),
      message: `${lesson.priceSparks} 💎 ${t('unlockConfirmBodySuffix')}`,
      confirmLabel: `${t('unlockLabel')} (${lesson.priceSparks} 💎)`,
      onConfirm: async () => {
        setUnlocking(true);
        try {
          await lessonsApi.unlockLesson(id!, token!);
          setHasAccess(true);
          haptics.success(); // lesson unlocked with sparks
          Alert.alert(t('unlockSuccessTitle'), t('unlockSuccessBody'));
        } catch {
          alertError(t('unlockError'));
        } finally {
          setUnlocking(false);
        }
      },
    });
  }

  // Group the lesson's quizzes by category (the 4 test types).
  function groupByCategory(items: Quiz[]): { category: string; quizzes: Quiz[] }[] {
    const map = new Map<string, Quiz[]>();
    for (const q of items) {
      const cat = q.category?.trim() || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(q);
    }
    return [...map.entries()].map(([category, quizzes]) => ({ category, quizzes }));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('lessonScreenTitle')} back showBadges={false} />
        <View style={styles.container}>
          <View style={styles.head}>
            <Skeleton width={56} height={56} radius={radius.md} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton height={20} width="70%" />
              <Skeleton height={16} width="40%" />
            </View>
          </View>
          <Skeleton height={200} radius={radius.xl} style={{ marginTop: spacing.lg }} />
          <Skeleton height={18} width="30%" style={{ marginTop: spacing.xl, marginBottom: spacing.md }} />
          <Skeleton height={64} radius={radius.md} style={{ marginBottom: spacing.sm }} />
          <Skeleton height={64} radius={radius.md} style={{ marginBottom: spacing.sm }} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !lesson) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('lessonScreenTitle')} back showBadges={false} />
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('lessonLoadError')}
          action={{ label: t('retry'), onPress: load }}
        />
      </SafeAreaView>
    );
  }

  const lvl = levelColor[lesson.level] ?? levelColor.a1;
  const skill = getSkill(lesson.type);
  // `position` is 0 for lessons authored before the admin form had the field —
  // and 0 is not nullish, so a `?? 1` fallback never fired and every lesson read
  // "00". Un-ordered lessons show the skill icon instead of a fake number.
  const num = lesson.position > 0 ? String(lesson.position).padStart(2, '0') : null;
  const CAT_LABELS = catLabels();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('lessonScreenTitle')} back showBadges={false} />
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.container, bounded]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.head}>
          <View style={[styles.numBadge, { backgroundColor: skill.tint.bg }]}>
            {num ? (
              <AppText variant="h2" color={skill.tint.fg}>{num}</AppText>
            ) : (
              <AppIcon name={skill.img} size={32} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h2">{lesson.title}</AppText>
            <View style={styles.metaRow}>
              <Pill label={lesson.level.toUpperCase()} bg={lvl.bg} fg={lvl.fg} />
              <Pill label={t(skill.labelKey)} icon={skill.icon} bg={skill.tint.bg} fg={skill.tint.fg} />
            </View>
          </View>
        </View>

        {lesson.description ? (
          <AppText variant="body" color={c.textSecondary} style={styles.desc}>
            {lesson.description}
          </AppText>
        ) : null}

        {!hasAccess ? (
          <View style={styles.lockedBox}>
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed" size={28} color={c.primary} />
            </View>
            <AppText variant="h3" style={styles.lockedTitle}>{t('lessonLocked')}</AppText>
            <AppText variant="body" color={c.textSecondary} center>
              {t('lessonLockedBodyPrefix')} {lesson.priceSparks} {t('lessonLockedBodySuffix')}
            </AppText>
            <View style={styles.balance}>
              <AppIcon name="sparks" size={16} />
              <AppText variant="bodyStrong" color={c.sparks}>{t('balanceLabel')}: {user?.sparks ?? 0}</AppText>
            </View>
            <Button
              label={unlocking ? t('unlocking') : `${t('unlockLabel')} · ${lesson.priceSparks} 💎`}
              icon="lock-open"
              onPress={unlock}
              disabled={unlocking}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : (
          <>
            {/* Video */}
            {videoUrl ? (
              <VideoView
                player={player}
                style={styles.video}
                nativeControls
                fullscreenOptions={FULLSCREEN}
                contentFit="cover"
              />
            ) : coverUrl ? (
              /* No video, but the author uploaded a cover — show THAT, not the
                 generic bundled banner (the uploaded image otherwise appeared
                 nowhere in the app). */
              <View style={styles.video}>
                <Image source={{ uri: coverUrl }} style={styles.videoImg} resizeMode="cover" />
              </View>
            ) : (
              <View style={styles.video}>
                <Image source={banner} style={styles.videoImg} resizeMode="cover" />
                <View style={styles.videoScrim} />
                <View style={styles.noVideo}>
                  <Ionicons name="videocam-off" size={22} color={c.white} />
                  <AppText variant="caption" color={c.white}>{t('videoUnavailable')}</AppText>
                </View>
              </View>
            )}

            {/* Lesson vocabulary — the words an admin attached to this lesson.
                Rendered only when there are any, so lessons without a word list
                don't grow an empty section. */}
            {words.length > 0 ? (
              <>
                <View style={styles.quizHead}>
                  <AppText variant="h2">{t('lessonWords')}</AppText>
                  <AppText variant="caption" color={c.textMuted}>{words.length}</AppText>
                </View>
                <View style={styles.wordCard}>
                  {words.map((w, i) => (
                    <View key={w.id} style={[styles.wordRow, i > 0 && styles.wordRowBorder]}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>{w.english}</AppText>
                        {w.exampleSentence ? (
                          <AppText variant="caption" color={c.textMuted} numberOfLines={1}>
                            {w.exampleSentence}
                          </AppText>
                        ) : null}
                      </View>
                      <AppText variant="body" color={c.textSecondary} numberOfLines={1} style={styles.wordMn}>
                        {w.mongolian}
                      </AppText>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* Tests — unlocked once the lesson is marked watched */}
            <View style={styles.quizHead}>
              <AppText variant="h2">{t('testsHeading')}</AppText>
              {!done ? <Ionicons name="lock-closed" size={16} color={c.textMuted} /> : null}
            </View>

            {!done ? (
              <View style={styles.quizLocked}>
                <View style={styles.lockedIcon}>
                  <Ionicons name="play-circle" size={28} color={c.primary} />
                </View>
                <AppText variant="bodyStrong" center>{t('watchLessonFirst')}</AppText>
                <AppText variant="caption" center color={c.textSecondary} style={{ marginTop: 2 }}>
                  {t('watchLessonFirstHint')}
                </AppText>
                {/* Say how many tests are waiting — otherwise a locked, silent
                    section looks exactly like "my tests never arrived". */}
                {quizzes.length > 0 ? (
                  <AppText variant="caption" center color={c.primary} style={{ marginTop: 6 }}>
                    {tf('testsReadyCount', { n: quizzes.length })}
                  </AppText>
                ) : null}
                <Button label={t('lessonWatched')} icon="checkmark" onPress={markDone} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
              </View>
            ) : quizzes.length === 0 ? (
              <View style={styles.quizEmpty}>
                <AppText variant="body" center color={c.textMuted}>{t('noLessonQuizzes')}</AppText>
              </View>
            ) : (
              groupByCategory(quizzes).map((group) => (
                <View key={group.category} style={styles.catGroup}>
                  <AppText variant="overline" color={c.textSecondary} style={styles.catLabel}>
                    {(CAT_LABELS[group.category] ?? group.category).toUpperCase()}
                  </AppText>
                  {group.quizzes.map((q, i) => (
                    <Animated.View
                      key={q.id}
                      entering={reduceMotion ? undefined : FadeInDown.delay(i * 60).springify()}
                    >
                      <Pressable
                        style={({ pressed }) => [styles.quizRow, pressed && styles.quizRowPressed]}
                        onPress={() => { haptics.tap(); router.push(`/quiz/${q.id}`); }}
                      >
                        <View style={styles.quizIcon}>
                          <Ionicons name="help-circle" size={20} color={c.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText variant="bodyStrong" numberOfLines={1}>{q.title}</AppText>
                          <AppText variant="caption">{tf('questionCount', { n: q.questions?.length ?? 0 })} · {q.xpReward} XP</AppText>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={c.borderStrong} />
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              ))
            )}
          </>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* The shared completion celebration — a different world every time. */}
      <CelebrationScreen
        visible={celebrating}
        {...celebrationCopy('lesson')}
        xp={earnedXp}
        stats={[
          {
            icon: 'clipboard-outline',
            label: t('celebrationStatTests'),
            value: String(quizzes.length),
            color: c.sparks,
          },
          {
            icon: 'ribbon-outline',
            label: t('levelLabel'),
            value: lesson.level.toUpperCase(),
            color: c.success,
          },
        ]}
        primary={{ label: t('testsHeading'), onPress: closeCelebration }}
        secondary={{ label: t('close'), onPress: closeCelebration }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  numBadge: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  desc: { marginTop: spacing.md },

  // Video
  // 16:9 video keeps its natural shape on every phone width (was fixed 200).
  video: { aspectRatio: 16 / 9, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.lg, backgroundColor: c.navy },
  videoImg: { width: '100%', height: '100%' },
  videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,16,48,0.35)' },
  noVideo: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 6 },

  // Tests
  quizHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  quizLocked: {
    backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: c.border,
  },
  quizEmpty: { backgroundColor: c.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg },

  // Lesson vocabulary list
  wordCard: {
    backgroundColor: c.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border, overflow: 'hidden',
  },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  wordRowBorder: { borderTopWidth: 1, borderTopColor: c.border },
  wordMn: { maxWidth: '45%', textAlign: 'right' },
  catGroup: { marginBottom: spacing.md },
  catLabel: { marginBottom: spacing.sm },
  quizRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: c.border,
  },
  quizRowPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  quizIcon: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },

  // Locked
  lockedBox: {
    backgroundColor: c.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center',
    marginTop: spacing.lg, borderWidth: 1, borderColor: c.border,
  },
  lockedIcon: {
    width: 56, height: 56, borderRadius: radius.full, backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  lockedTitle: { marginBottom: spacing.xs },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
});
