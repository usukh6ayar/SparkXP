import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import * as lessonsApi from '../../src/api/lessons';
import type { Lesson } from '../../src/api/lessons';
import { TopBar } from '../../src/components/TopBar';
import { Pill } from '../../src/components/Pill';
import { Button } from '../../src/components/Button';
import { Loading } from '../../src/components/Loading';
import { colors, spacing, radius, fontSize, levelColor } from '../../src/theme/theme';

type UnitState = 'done' | 'current' | 'locked';
interface Unit {
  n: number; icon: string; title: string; sub: string; tag: string; state: UnitState;
}

// Standard lesson activity path (presentational; per-unit progress isn't tracked yet).
const UNITS: Unit[] = [
  { n: 1, icon: '📖', title: 'Шинэ үгс', sub: 'Шинэ үг сурцгаая.', tag: '5 үг', state: 'done' },
  { n: 2, icon: '🎧', title: 'Сонсож ойлгох', sub: 'Сонсож, зөв хариулцгаая.', tag: 'Дасгал', state: 'done' },
  { n: 3, icon: '✏️', title: 'Бичиж дадлага хийх', sub: 'Зөв бичиж сурцгаая.', tag: 'Дасгал', state: 'current' },
  { n: 4, icon: '🗣️', title: 'Ярианы дадлага', sub: 'Хичээлийн тухай ярилцъя.', tag: 'Яриа', state: 'locked' },
];

const STATE_COLOR: Record<UnitState, string> = {
  done: colors.success,
  current: colors.primary,
  locked: colors.textMuted,
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
    (async () => {
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
    })();
  }, [id]);

  function unlock() {
    if (!lesson) return;
    if ((user?.sparks ?? 0) < lesson.priceSparks) {
      Alert.alert('Spark хүрэлцэхгүй', `Танд ${user?.sparks ?? 0} ✨ байна. Энэ хичээлд ${lesson.priceSparks} ✨ шаардлагатай.`);
      return;
    }
    Alert.alert('Хичээл нээх үү?', `${lesson.priceSparks} ✨ Очирхон зарцуулна`, [
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
    ]);
  }

  if (loading) return <Loading />;
  if (!lesson) return null;

  const lvl = levelColor[lesson.level] ?? levelColor.a1;
  const soon = () => Alert.alert('Тун удахгүй', 'Энэ хэсэг удахгүй нэмэгдэнэ. 🦊');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar back streak={5} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Lesson header */}
        <View style={styles.head}>
          <View style={styles.thumb}><Text style={styles.thumbEmoji}>🦊</Text></View>
          <Text style={styles.title}>{lesson.title}</Text>
        </View>
        <View style={styles.metaRow}>
          <Pill label={lesson.level.toUpperCase()} bg={lvl.bg} fg={lvl.fg} />
          <Text style={styles.metaText}>{UNITS.length} хичээл</Text>
        </View>

        {/* Pager */}
        <View style={styles.pager}>
          <Text style={styles.pagerArrow}>‹</Text>
          <Text style={styles.pagerText}>1 / 1</Text>
          <Text style={[styles.pagerArrow, { opacity: 0.4 }]}>›</Text>
        </View>

        {!hasAccess ? (
          /* Locked — preserve unlock logic */
          <View style={styles.lockedBox}>
            <Text style={styles.lockedEmoji}>🔒</Text>
            <Text style={styles.lockedTitle}>Хичээл түгжигдсэн</Text>
            <Text style={styles.lockedSub}>Нээхийн тулд {lesson.priceSparks} ✨ Очирхон зарцуулна.</Text>
            <Text style={styles.balance}>Таны үлдэгдэл: {user?.sparks ?? 0} ✨</Text>
            <Button
              label={unlocking ? 'Нээж байна...' : `Нээх  ${lesson.priceSparks} ✨`}
              onPress={unlock}
              disabled={unlocking}
              style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
            />
          </View>
        ) : (
          <>
            {/* Unit path */}
            {UNITS.map((u, i) => (
              <View key={u.n} style={styles.unitRow}>
                <View style={styles.rail}>
                  <View style={[styles.node, { backgroundColor: STATE_COLOR[u.state] }]}>
                    <Text style={styles.nodeText}>{u.n}</Text>
                  </View>
                  {i < UNITS.length - 1 && <View style={styles.connector} />}
                </View>

                <Pressable
                  style={[
                    styles.unitCard,
                    u.state === 'current' && styles.unitCurrent,
                    u.state === 'locked' && styles.unitLocked,
                  ]}
                  onPress={soon}
                >
                  <Text style={styles.unitIcon}>{u.state === 'locked' ? '🔒' : u.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unitTitle}>{u.title}</Text>
                    <Text style={styles.unitSub}>{u.sub}</Text>
                    <Pill label={u.tag} bg={colors.surface} fg={colors.textMuted} />
                  </View>
                  <Text style={[styles.unitMark, { color: STATE_COLOR[u.state] }]}>
                    {u.state === 'done' ? '✓' : u.state === 'current' ? '→' : '🔒'}
                  </Text>
                </Pressable>
              </View>
            ))}

            {/* Fox banner */}
            <View style={styles.banner}>
              <Text style={styles.bannerFox}>🦊</Text>
              <Text style={styles.bannerText}>
                Тест өгөх эсвэл{'\n'}
                <Text style={{ color: colors.primary, fontWeight: '800' }}>дараагийн хичээл</Text>
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Button label="Буцах" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
              <Button label="Тест өгөх" onPress={soon} style={{ flex: 1 }} />
            </View>
          </>
        )}
        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 30 },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.navy, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  metaText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginVertical: spacing.lg },
  pagerArrow: { fontSize: 28, color: colors.navy, fontWeight: '700' },
  pagerText: { fontSize: fontSize.md, fontWeight: '800', color: colors.navy },
  // Unit path
  unitRow: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 40, alignItems: 'center' },
  node: {
    width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.white,
  },
  nodeText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  connector: { flex: 1, width: 3, backgroundColor: colors.border, marginVertical: 2 },
  unitCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 2, borderColor: 'transparent',
  },
  unitCurrent: { backgroundColor: '#FFF6EC', borderColor: colors.primary },
  unitLocked: { opacity: 0.6 },
  unitIcon: { fontSize: 28 },
  unitTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.navy },
  unitSub: { fontSize: fontSize.sm, color: colors.textMuted, marginVertical: 2 },
  unitMark: { fontSize: fontSize.lg, fontWeight: '800' },
  // Fox banner
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.cream, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg,
  },
  bannerFox: { fontSize: 44 },
  bannerText: { fontSize: fontSize.md, fontWeight: '700', color: colors.navy, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.md },
  // Locked
  lockedBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center' },
  lockedEmoji: { fontSize: 48, marginBottom: spacing.md },
  lockedTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.navy, marginBottom: spacing.sm },
  lockedSub: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  balance: { marginTop: spacing.sm, color: colors.sparks, fontWeight: '700', fontSize: fontSize.md },
});
