import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getExercises, type Quiz } from '../../src/api/quizzes';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Loading } from '../../src/components/Loading';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type TintName = keyof typeof tints;

/**
 * Exercises (Дасгал) of one skill — the real, DB-authored standalone quizzes.
 * Reached from a skill screen's sub-category. The `title` param is the chosen
 * sub-category's name (header only); once the backend tags exercises by
 * sub-category this screen can also filter by it.
 */
const ROW_STYLES: { icon: IconName; tint: TintName }[] = [
  { icon: 'book', tint: 'green' },
  { icon: 'newspaper', tint: 'amber' },
  { icon: 'chatbubbles', tint: 'pink' },
  { icon: 'grid', tint: 'purple' },
  { icon: 'search', tint: 'blue' },
  { icon: 'sparkles', tint: 'teal' },
  { icon: 'flash', tint: 'orange' },
  { icon: 'trophy', tint: 'amber' },
];

export default function ExercisesScreen() {
  const { key, title } = useLocalSearchParams<{ key: string; title?: string }>();
  const skillKey = key ?? 'listening';
  const { token } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setItems([]); return; }
    try {
      const r = await getExercises(token, skillKey);
      setItems(r.items);
    } catch (e) {
      console.warn('Exercises load failed:', (e as Error)?.message ?? e);
      setItems([]);
    }
  }, [token, skillKey]);

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
      <TopBar title={title ?? 'Дасгал'} back showBadges={false} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            Энэ төрлийн дасгал алга 🦊
          </AppText>
        ) : (
          <View style={styles.listCard}>
            {items.map((q, i) => {
              const rs = ROW_STYLES[i % ROW_STYLES.length];
              const t = tints[rs.tint];
              return (
                <Pressable
                  key={q.id}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                  onPress={() => router.push(`/quiz/${q.id}`)}
                >
                  <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
                    <Ionicons name={rs.icon} size={20} color={t.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" numberOfLines={1}>{q.title}</AppText>
                    <AppText variant="caption">
                      {q.questions?.length ?? 0} асуулт · {q.xpReward} XP · {q.level.toUpperCase()}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
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
  empty: { marginTop: spacing.xxl },
});
