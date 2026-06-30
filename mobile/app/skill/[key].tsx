import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getExercises, type Quiz } from '../../src/api/quizzes';
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
  const { token } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || isSpeaking) { setItems([]); return; }
    try {
      const r = await getExercises(token, skillKey);
      setItems(r.items);
    } catch (e) {
      console.warn('Exercises load failed:', (e as Error)?.message ?? e);
      setItems([]);
    }
  }, [token, skillKey, isSpeaking]);

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
            <AppText variant="h2" color={colors.white}>{items.length}</AppText>
            <AppText variant="overline" color="rgba(255,255,255,0.85)">ДАСГАЛ</AppText>
          </View>
        </LinearGradient>

        {isSpeaking ? (
          <View style={styles.soon}>
            <Ionicons name="mic" size={40} color={colors.textMuted} />
            <AppText variant="body" color={colors.textMuted} center style={{ marginTop: spacing.sm }}>
              Ярих дасгал тун удахгүй 🎤
            </AppText>
          </View>
        ) : loading ? (
          <Loading />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  soon: { alignItems: 'center', paddingVertical: spacing.xxl },
  empty: { marginTop: spacing.xxl },
});
