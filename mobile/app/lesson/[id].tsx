import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/auth/AuthContext';
import * as lessonsApi from '../../src/api/lessons';
import type { Lesson } from '../../src/api/lessons';
import { getQuizzes, type Quiz } from '../../src/api/quizzes';
import { setLastLesson } from '../../src/lib/lastLesson';
import { alertError, confirm } from '../../src/lib/alerts';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Pill } from '../../src/components/Pill';
import { Button } from '../../src/components/Button';
import { Skeleton } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { getSkill } from '../../src/constants/skills';
import { t } from '../../src/i18n';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, levelColor, type AppColors } from '../../src/theme/theme';

const banner = require('../../assets/home-banner.png');

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

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [done, setDone] = useState(false); // lesson watched → quizzes unlocked
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  const doneKey = `lesson_done:${id}`;
  const videoUrl = (lesson?.content as { videoUrl?: string } | undefined)?.videoUrl ?? null;
  const player = useVideoPlayer(videoUrl, (p) => { p.loop = false; });

  // Load the real video source once the lesson (and its URL) arrives.
  useEffect(() => {
    if (videoUrl) { try { player.replace(videoUrl); } catch { /* ignore */ } }
  }, [videoUrl, player]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [l, access, qz, savedDone] = await Promise.all([
        lessonsApi.getLesson(id, token),
        lessonsApi.checkAccess(id, token),
        getQuizzes(token, { lessonId: id }),
        AsyncStorage.getItem(doneKey),
      ]);
      setLesson(l);
      setHasAccess(access.hasAccess);
      setQuizzes(qz.items);
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

  async function markDone() {
    await AsyncStorage.setItem(doneKey, '1');
    setDone(true);
    if (token && id) {
      try {
        const res = await lessonsApi.completeLesson(id, token);
        if (res.xpAwarded > 0) Alert.alert(t('lessonCompleteTitle'), `${t('lessonCompletePrefix')} +${res.xpAwarded} XP ${t('lessonCompleteSuffix')}`);
      } catch { /* non-critical */ }
    }
  }

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
        <TopBar back />
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
        <TopBar back />
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
  const num = String(lesson.position ?? 1).padStart(2, '0');
  const CAT_LABELS = catLabels();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar back />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.head}>
          <View style={[styles.numBadge, { backgroundColor: skill.tint.bg }]}>
            <AppText variant="h2" color={skill.tint.fg}>{num}</AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h2">{lesson.title}</AppText>
            <View style={styles.metaRow}>
              <Pill label={lesson.level.toUpperCase()} bg={lvl.bg} fg={lvl.fg} />
              <Pill label={skill.label} icon={skill.icon} bg={skill.tint.bg} fg={skill.tint.fg} />
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
              <Ionicons name="diamond" size={15} color={c.sparks} />
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
                allowsFullscreen
                contentFit="cover"
              />
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
                  {group.quizzes.map((q) => (
                    <Pressable
                      key={q.id}
                      style={({ pressed }) => [styles.quizRow, pressed && styles.quizRowPressed]}
                      onPress={() => router.push(`/quiz/${q.id}`)}
                    >
                      <View style={styles.quizIcon}>
                        <Ionicons name="help-circle" size={20} color={c.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>{q.title}</AppText>
                        <AppText variant="caption">{q.questions?.length ?? 0} асуулт · {q.xpReward} XP</AppText>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={c.borderStrong} />
                    </Pressable>
                  ))}
                </View>
              ))
            )}
          </>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
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
  video: { height: 200, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.lg, backgroundColor: c.navy },
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
