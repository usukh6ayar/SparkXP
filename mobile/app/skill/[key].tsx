import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getExercises, type Quiz } from '../../src/api/quizzes';
import { getReadingList, type ReadingPassage } from '../../src/api/reading';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Card } from '../../src/components/Card';
import { Loading } from '../../src/components/Loading';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** The 4 exercise (Дасгал) skills. */
const SKILLS: Record<string, { label: string; sub: string; icon: IconName; tint: { bg: string; fg: string } }> = {
  listening: { label: 'Сонсгол', sub: 'Сонсох дасгалууд', icon: 'headset', tint: tints.purple },
  reading: { label: 'Унших', sub: 'Унших дасгалууд', icon: 'book', tint: tints.green },
  writing: { label: 'Бичих', sub: 'Бичих дасгалууд', icon: 'create', tint: tints.blue },
  speaking: { label: 'Ярих', sub: 'Ярих дасгалууд', icon: 'mic', tint: tints.coral },
};

export default function SkillScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const skillKey = key ?? 'listening';
  const skill = SKILLS[skillKey] ?? SKILLS.listening;
  const isSpeaking = skillKey === 'speaking';
  // Унших = админ дахь "Унших материал" (ReadingPassage), бусад нь дасгал (quiz).
  const isReading = skillKey === 'reading';
  const { token } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Quiz[]>([]);
  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  // Сонгосон сэдэв (category) шүүлтүүр — зөвхөн Унших дээр. 'all' = бүгд.
  const [cat, setCat] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ачаалсан материалд бодитоор байгаа сэдвүүд (хоосон сэдэвтэйг алгасна).
  const categories = [...new Set(passages.map((p) => p.category).filter(Boolean))] as string[];
  const shownPassages = cat === 'all' ? passages : passages.filter((p) => p.category === cat);

  const load = useCallback(async () => {
    if (!token || isSpeaking) { setItems([]); setPassages([]); return; }
    try {
      if (isReading) {
        const r = await getReadingList(token);
        setPassages(r.items);
      } else {
        const r = await getExercises(token, skillKey);
        setItems(r.items);
      }
    } catch (e) {
      console.warn('Skill load failed:', (e as Error)?.message ?? e);
      setItems([]); setPassages([]);
    }
  }, [token, skillKey, isSpeaking, isReading]);

  const count = isReading ? shownPassages.length : items.length;

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={skill.label} back />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <LinearGradient colors={[skill.tint.fg, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={skill.icon} size={26} color={skill.tint.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h2" color={colors.white}>{skill.label}</AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.9)">{skill.sub}</AppText>
          </View>
          <View style={{ alignItems: 'center' }}>
            <AppText variant="h2" color={colors.white}>{count}</AppText>
            <AppText variant="overline" color="rgba(255,255,255,0.85)">{isReading ? 'МАТЕРИАЛ' : 'ДАСГАЛ'}</AppText>
          </View>
        </LinearGradient>

        {/* Сэдэв (category) шүүлтүүр — материалд сэдэв байгаа үед л харуулна. */}
        {isReading && !loading && categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {['all', ...categories].map((c) => {
              const active = cat === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={[styles.catChip, active && { backgroundColor: skill.tint.fg, borderColor: skill.tint.fg }]}
                >
                  <AppText variant="caption" color={active ? colors.white : colors.textMuted}>
                    {c === 'all' ? 'Бүгд' : c}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {isSpeaking ? (
          <View style={styles.soon}>
            <Ionicons name="mic" size={40} color={colors.textMuted} />
            <AppText variant="body" color={colors.textMuted} center style={{ marginTop: spacing.sm }}>
              Ярих дасгал тун удахгүй 🎤
            </AppText>
          </View>
        ) : loading ? (
          <Loading />
        ) : isReading ? (
          shownPassages.length === 0 ? (
            <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
              Унших материал алга 🦊
            </AppText>
          ) : (
            shownPassages.map((p) => (
              <Card key={p.id} variant="raised" onPress={() => router.push(`/reading/${p.id}`)} padding="md" style={styles.row}>
                <View style={[styles.icon, { backgroundColor: skill.tint.bg }]}>
                  <Ionicons name={skill.icon} size={20} color={skill.tint.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3" numberOfLines={2}>{p.title}</AppText>
                  <AppText variant="caption">{p.wordCount} үг · {p.sentences?.length ?? 0} өгүүлбэр · {p.cefr.toUpperCase()}</AppText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
              </Card>
            ))
          )
        ) : items.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            Энэ төрлийн дасгал алга 🦊
          </AppText>
        ) : (
          items.map((q) => (
            <Card key={q.id} variant="raised" onPress={() => router.push(`/quiz/${q.id}`)} padding="md" style={styles.row}>
              <View style={[styles.icon, { backgroundColor: skill.tint.bg }]}>
                <Ionicons name={skill.icon} size={20} color={skill.tint.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3" numberOfLines={2}>{q.title}</AppText>
                <AppText variant="caption">{q.questions?.length ?? 0} асуулт · {q.xpReward} XP · {q.level.toUpperCase()}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
            </Card>
          ))
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg,
  },
  heroIcon: {
    width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  catRow: { gap: spacing.sm, paddingBottom: spacing.md },
  catChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  soon: { alignItems: 'center', paddingVertical: spacing.xxl },
  empty: { marginTop: spacing.xxl },
});
