import { useEffect, useState, useCallback } from 'react';
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
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Pill } from '../../src/components/Pill';
import { Button } from '../../src/components/Button';
import { Loading } from '../../src/components/Loading';
import { getSkill } from '../../src/constants/skills';
import { colors, spacing, radius, levelColor } from '../../src/theme/theme';

const banner = require('../../assets/home-banner.png');

/** Nice labels for the 4 lesson-test categories. */
const CAT_LABELS: Record<string, string> = {
  listening: 'Сонсгол', reading: 'Унших', writing: 'Бичих', speaking: 'Ярих', fill: 'Нөхөх',
};

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [done, setDone] = useState(false); // lesson watched → quizzes unlocked
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  const doneKey = `lesson_done:${id}`;
  const videoUrl = (lesson?.content as { videoUrl?: string } | undefined)?.videoUrl ?? null;
  const player = useVideoPlayer(videoUrl, (p) => { p.loop = false; });

  // Load the real video source once the lesson (and its URL) arrives.
  useEffect(() => {
    if (videoUrl) { try { player.replace(videoUrl); } catch { /* ignore */ } }
  }, [videoUrl, player]);

  useEffect(() => {
    (async () => {
      try {
        const [l, access, qz, savedDone] = await Promise.all([
          lessonsApi.getLesson(id!, token!),
          lessonsApi.checkAccess(id!, token!),
          getQuizzes(token!, { lessonId: id }),
          AsyncStorage.getItem(doneKey),
        ]);
        setLesson(l);
        setHasAccess(access.hasAccess);
        setQuizzes(qz.items);
        setDone(savedDone === '1');
        setLastLesson({ id: l.id, title: l.title, thumbnailUrl: l.thumbnailUrl, type: l.type, level: l.level });
      } catch {
        Alert.alert('Алдаа', 'Хичээл ачаалахад алдаа гарлаа.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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
        if (res.xpAwarded > 0) Alert.alert('Бэрхшээлгүй!', `Хичээл дуусгаж +${res.xpAwarded} XP авлаа 🎉`);
      } catch { /* non-critical */ }
    }
  }

  function unlock() {
    if (!lesson) return;
    if ((user?.sparks ?? 0) < lesson.priceSparks) {
      Alert.alert('Очирхон хүрэлцэхгүй', `Танд ${user?.sparks ?? 0} 💎 байна. Энэ хичээлд ${lesson.priceSparks} 💎 шаардлагатай.`);
      return;
    }
    Alert.alert('Хичээл нээх үү?', `${lesson.priceSparks} 💎 Очирхон зарцуулна`, [
      { text: 'Болих' },
      {
        text: `Нээх (${lesson.priceSparks} 💎)`,
        onPress: async () => {
          setUnlocking(true);
          try {
            await lessonsApi.unlockLesson(id!, token!);
            setHasAccess(true);
            Alert.alert('Амжилттай', 'Хичээл нээгдлээ!');
          } catch {
            Alert.alert('Алдаа', 'Нээхэд алдаа гарлаа.');
          } finally {
            setUnlocking(false);
          }
        },
      },
    ]);
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

  if (loading) return <Loading />;
  if (!lesson) return null;

  const lvl = levelColor[lesson.level] ?? levelColor.a1;
  const skill = getSkill(lesson.type);
  const num = String(lesson.position ?? 1).padStart(2, '0');

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
          <AppText variant="body" color={colors.textSecondary} style={styles.desc}>
            {lesson.description}
          </AppText>
        ) : null}

        {!hasAccess ? (
          <View style={styles.lockedBox}>
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed" size={28} color={colors.primary} />
            </View>
            <AppText variant="h3" style={styles.lockedTitle}>Хичээл түгжээтэй</AppText>
            <AppText variant="body" color={colors.textSecondary} center>
              Нээхийн тулд {lesson.priceSparks} 💎 Очирхон зарцуулна.
            </AppText>
            <View style={styles.balance}>
              <Ionicons name="diamond" size={15} color={colors.sparks} />
              <AppText variant="bodyStrong" color={colors.sparks}>Үлдэгдэл: {user?.sparks ?? 0}</AppText>
            </View>
            <Button
              label={unlocking ? 'Нээж байна...' : `Нээх · ${lesson.priceSparks} 💎`}
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
                  <Ionicons name="videocam-off" size={22} color={colors.white} />
                  <AppText variant="caption" color={colors.white}>Видео одоохондоо алга</AppText>
                </View>
              </View>
            )}

            {/* Tests — unlocked once the lesson is marked watched */}
            <View style={styles.quizHead}>
              <AppText variant="h2">Тест даалгавар</AppText>
              {!done ? <Ionicons name="lock-closed" size={16} color={colors.textMuted} /> : null}
            </View>

            {!done ? (
              <View style={styles.quizLocked}>
                <View style={styles.lockedIcon}>
                  <Ionicons name="play-circle" size={28} color={colors.primary} />
                </View>
                <AppText variant="bodyStrong" center>Хичээлээ үзэж дуусга</AppText>
                <AppText variant="caption" center color={colors.textSecondary} style={{ marginTop: 2 }}>
                  Дуусгасны дараа тестүүд нээгдэнэ.
                </AppText>
                <Button label="Хичээл үзсэн ✓" icon="checkmark" onPress={markDone} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
              </View>
            ) : quizzes.length === 0 ? (
              <View style={styles.quizEmpty}>
                <AppText variant="body" center color={colors.textMuted}>Энэ хичээлд тест алга 🦊</AppText>
              </View>
            ) : (
              groupByCategory(quizzes).map((group) => (
                <View key={group.category} style={styles.catGroup}>
                  <AppText variant="overline" color={colors.textSecondary} style={styles.catLabel}>
                    {(CAT_LABELS[group.category] ?? group.category).toUpperCase()}
                  </AppText>
                  {group.quizzes.map((q) => (
                    <Pressable
                      key={q.id}
                      style={({ pressed }) => [styles.quizRow, pressed && styles.quizRowPressed]}
                      onPress={() => router.push(`/quiz/${q.id}`)}
                    >
                      <View style={styles.quizIcon}>
                        <Ionicons name="help-circle" size={20} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="bodyStrong" numberOfLines={1}>{q.title}</AppText>
                        <AppText variant="caption">{q.questions?.length ?? 0} асуулт · {q.xpReward} XP</AppText>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  numBadge: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  desc: { marginTop: spacing.md },

  // Video
  video: { height: 200, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.lg, backgroundColor: colors.navy },
  videoImg: { width: '100%', height: '100%' },
  videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,16,48,0.35)' },
  noVideo: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 6 },

  // Tests
  quizHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  quizLocked: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  quizEmpty: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg },
  catGroup: { marginBottom: spacing.md },
  catLabel: { marginBottom: spacing.sm },
  quizRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  quizRowPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  quizIcon: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },

  // Locked
  lockedBox: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center',
    marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  lockedIcon: {
    width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  lockedTitle: { marginBottom: spacing.xs },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
});
