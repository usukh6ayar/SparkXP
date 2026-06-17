import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

interface Segment { title: string; time: string; locked?: boolean }

// Видеоны бүлгүүд — `content.segments` байхгүй үед placeholder (admin бөглөнө).
const MOCK_SEGMENTS: Segment[] = [
  { title: 'Мэндчилгээний үгс', time: '02:15', locked: false },
  { title: 'Танилцах хэллэгүүд', time: '01:45', locked: true },
  { title: 'Гарын үг ашиглалт', time: '01:30', locked: true },
  { title: 'Жишээ яриа', time: '01:15', locked: true },
];
const DEFAULT_TIP = 'Хүмүүстэй уулзах үед эелдэг мэндлэх нь сайн харилцааны эхлэл болдог.';

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
        // Remember as the "Continue" lesson on Home.
        setLastLesson({ id: l.id, title: l.title, thumbnailUrl: l.thumbnailUrl, type: l.type, level: l.level });
      } catch {
        Alert.alert('Алдаа', 'Хичээл ачаалахад алдаа гарлаа.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Re-read the watched flag when returning to the screen (e.g. after a quiz).
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(doneKey).then((v) => setDone(v === '1'));
    }, [doneKey]),
  );

  async function markDone() {
    await AsyncStorage.setItem(doneKey, '1');
    setDone(true);
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

  const soon = () => Alert.alert('Тун удахгүй', 'Видео тоглуулагч удахгүй нэмэгдэнэ. 🦊');

  // Group the lesson's quizzes by category for the unlocked quiz list.
  function groupByCategory(items: Quiz[]): { category: string; quizzes: Quiz[] }[] {
    const map = new Map<string, Quiz[]>();
    for (const q of items) {
      const cat = q.category?.trim() || 'Сорил';
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

  const content = lesson.content as { duration?: string; segments?: Segment[]; tip?: string };
  const duration = content?.duration ?? '06:45';
  const segments = content?.segments?.length ? content.segments : MOCK_SEGMENTS;
  const tip = content?.tip ?? DEFAULT_TIP;

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
          /* Locked — unlock flow preserved */
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
            {/* Video player (placeholder) */}
            <Pressable style={styles.video} onPress={soon}>
              <Image source={banner} style={styles.videoImg} resizeMode="cover" />
              <View style={styles.videoScrim} />
              <View style={styles.playBig}>
                <Ionicons name="play" size={26} color={colors.white} style={{ marginLeft: 3 }} />
              </View>
              <View style={styles.videoBar}>
                <Ionicons name="play" size={16} color={colors.white} />
                <AppText variant="caption" color={colors.white}>{segments[0].time}</AppText>
                <View style={styles.scrubTrack}>
                  <View style={styles.scrubFill} />
                  <View style={styles.scrubThumb} />
                </View>
                <AppText variant="caption" color={colors.white}>{duration}</AppText>
                <Ionicons name="scan-outline" size={16} color={colors.white} />
              </View>
            </Pressable>

            {/* Segments */}
            <AppText variant="h2" style={styles.section}>Хичээлийн агуулга</AppText>
            {segments.map((s, i) => {
              const active = i === 0;
              return (
                <Pressable
                  key={i}
                  style={[styles.segRow, active && styles.segActive]}
                  onPress={active ? soon : undefined}
                >
                  <AppText variant="bodyStrong" color={active ? colors.primary : colors.text} style={styles.segTitle} numberOfLines={1}>
                    {i + 1}. {s.title}
                  </AppText>
                  <AppText variant="caption" style={styles.segTime}>{s.time}</AppText>
                  <Ionicons
                    name={s.locked ? 'lock-closed' : 'checkmark-circle'}
                    size={18}
                    color={s.locked ? colors.textMuted : colors.primary}
                  />
                </Pressable>
              );
            })}

            {/* Tip */}
            <View style={styles.tip}>
              <View style={styles.tipIcon}>
                <Ionicons name="bulb" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3" style={styles.tipTitle}>Санамж</AppText>
                <AppText variant="caption" color={colors.textSecondary}>{tip}</AppText>
              </View>
            </View>

            {/* Quizzes — unlocked once the lesson is marked watched */}
            <View style={styles.quizHead}>
              <AppText variant="h2">Сорил</AppText>
              {!done ? <Ionicons name="lock-closed" size={16} color={colors.textMuted} /> : null}
            </View>

            {!done ? (
              <View style={styles.quizLocked}>
                <View style={styles.lockedIcon}>
                  <Ionicons name="play-circle" size={28} color={colors.primary} />
                </View>
                <AppText variant="bodyStrong" center>Хичээлээ үзэж дуусга</AppText>
                <AppText variant="caption" center color={colors.textSecondary} style={{ marginTop: 2 }}>
                  Дуусгасны дараа сорилууд нээгдэнэ.
                </AppText>
                <Button label="Хичээл үзсэн ✓" icon="checkmark" onPress={markDone} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
              </View>
            ) : quizzes.length === 0 ? (
              <View style={styles.quizEmpty}>
                <AppText variant="body" center color={colors.textMuted}>Энэ хичээлд сорил алга 🦊</AppText>
              </View>
            ) : (
              groupByCategory(quizzes).map((group) => (
                <View key={group.category} style={styles.catGroup}>
                  <AppText variant="overline" color={colors.textSecondary} style={styles.catLabel}>
                    {group.category.toUpperCase()}
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
  video: {
    height: 200, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.lg, backgroundColor: colors.navy,
  },
  videoImg: { width: '100%', height: '100%' },
  videoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,16,48,0.18)' },
  playBig: {
    position: 'absolute', top: '50%', left: '50%', width: 56, height: 56, marginLeft: -28, marginTop: -28,
    borderRadius: radius.full, backgroundColor: 'rgba(124,92,252,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  videoBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: 'rgba(20,16,48,0.45)',
  },
  scrubTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center' },
  scrubFill: { width: '35%', height: 4, borderRadius: 2, backgroundColor: colors.white },
  scrubThumb: { position: 'absolute', left: '35%', width: 11, height: 11, borderRadius: 6, backgroundColor: colors.white },

  // Segments
  section: { marginTop: spacing.xl, marginBottom: spacing.md },
  segRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  segActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  segTitle: { flex: 1 },
  segTime: { },

  // Tip
  tip: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md,
  },
  tipIcon: {
    width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  tipTitle: { marginBottom: 2 },
  cta: { marginTop: spacing.lg },

  // Quizzes
  quizHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.md },
  quizLocked: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  quizEmpty: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg,
  },
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
