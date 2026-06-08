import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as lessonsApi from '../../src/api/lessons';
import type { Lesson } from '../../src/api/lessons';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, fontSize } from '../../src/theme/theme';

const LEVEL_COLOR: Record<string, string> = {
  a1: '#16A34A', a2: '#2563EB', b1: '#D97706',
  b2: '#EA580C', c1: '#9333EA', c2: '#DC2626',
};

const TYPE_LABEL: Record<string, string> = {
  vocabulary: '📚 Үгсийн сан',
  grammar: '✏️ Дүрэм',
  listening: '🎧 Сонсгол',
};

export default function LessonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [l, access] = await Promise.all([
          lessonsApi.getLesson(id!, token!),
          lessonsApi.checkAccess(id!, token!),
        ]);
        setLesson(l);
        setHasAccess(access.hasAccess);
      } catch {
        Alert.alert('Алдаа', 'Хичээл ачаалахад алдаа гарлаа.');
        router.back();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function unlock() {
    if (!lesson) return;
    if ((user?.sparks ?? 0) < lesson.priceSparks) {
      Alert.alert(
        'Spark хүрэлцэхгүй',
        `Танд ${user?.sparks ?? 0} ✨ байна. Энэ хичээлд ${lesson.priceSparks} ✨ шаардлагатай.`,
      );
      return;
    }
    Alert.alert(
      'Хичээл нээх үү?',
      `${lesson.priceSparks} ✨ Очирхон зарцуулна`,
      [
        { text: 'Болих' },
        {
          text: `Нээх (${lesson.priceSparks} ✨)`,
          onPress: async () => {
            setUnlocking(true);
            try {
              await lessonsApi.unlockLesson(id!, token!);
              setHasAccess(true);
              Alert.alert('✅ Амжилттай', 'Хичээл нээгдлээ!');
            } catch {
              Alert.alert('Алдаа', 'Нээхэд алдаа гарлаа.');
            } finally {
              setUnlocking(false);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!lesson) return null;

  const levelColor = LEVEL_COLOR[lesson.level] ?? colors.primary;
  const typeLabel = TYPE_LABEL[lesson.type] ?? lesson.type;
  const isFree = lesson.priceSparks === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Back */}
        <Button
          label="← Буцах"
          variant="secondary"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
        />

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: levelColor + '20' }]}>
            <Text style={[styles.badgeText, { color: levelColor }]}>
              {lesson.level.toUpperCase()}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeLabel}</Text>
          </View>
          {isFree ? (
            <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
              <Text style={[styles.badgeText, { color: '#16A34A' }]}>Үнэгүй</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.cream }]}>
              <Text style={[styles.badgeText, { color: colors.sparks }]}>
                {lesson.priceSparks} ✨
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{lesson.title}</Text>
        {lesson.description && (
          <Text style={styles.description}>{lesson.description}</Text>
        )}

        {/* Locked state */}
        {!hasAccess && (
          <View style={styles.lockedBox}>
            <Text style={styles.lockedEmoji}>🔒</Text>
            <Text style={styles.lockedTitle}>Хичээл түгжигдсэн</Text>
            <Text style={styles.lockedSub}>
              Энэ хичээлийг нээхийн тулд {lesson.priceSparks} ✨ Очирхон зарцуулна.
            </Text>
            <Text style={styles.myBalance}>Таны үлдэгдэл: {user?.sparks ?? 0} ✨</Text>
            <Button
              label={unlocking ? 'Нээж байна...' : `Нээх  ${lesson.priceSparks} ✨`}
              onPress={unlock}
              disabled={unlocking}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}

        {/* Unlocked content */}
        {hasAccess && (
          <View style={styles.contentBox}>
            <Text style={styles.contentTitle}>📖 Агуулга</Text>
            {lesson.content?.notes ? (
              <Text style={styles.contentText}>{String(lesson.content.notes)}</Text>
            ) : (
              <Text style={styles.contentPlaceholder}>
                Хичээлийн агуулга удахгүй нэмэгдэнэ.
              </Text>
            )}
          </View>
        )}

        {/* Сорил button */}
        {hasAccess && (
          <Button
            label="📝 Сорил өгөх"
            onPress={() => {
              // Lesson's quiz: navigate using lessonId filter via quizzes list
              // For MVP, this would typically pass a quizId. Placeholder for now.
              Alert.alert('Тун удахгүй', 'Сорил удахгүй нэмэгдэнэ.');
            }}
            style={{ marginTop: spacing.lg }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  container: { padding: spacing.lg },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy, marginBottom: spacing.sm },
  description: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.lg },
  lockedBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  lockedEmoji: { fontSize: 48, marginBottom: spacing.md },
  lockedTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.navy, marginBottom: spacing.sm },
  lockedSub: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  myBalance: { marginTop: spacing.sm, color: colors.sparks, fontWeight: '700', fontSize: fontSize.md },
  contentBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  contentTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm },
  contentText: { fontSize: fontSize.md, color: colors.text, lineHeight: 24 },
  contentPlaceholder: { fontSize: fontSize.md, color: colors.textMuted, fontStyle: 'italic' },
});
