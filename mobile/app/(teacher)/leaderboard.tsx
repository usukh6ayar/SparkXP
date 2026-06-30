import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getLeaderboard, type Period, type LeaderboardResult } from '../../src/api/leaderboard';
import { AppText } from '../../src/components/Text';
import { Avatar } from '../../src/components/Avatar';
import { t } from '../../src/i18n';
import { colors, spacing, radius } from '../../src/theme/theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'weekly', label: 'Долоо хоног' },
  { key: 'monthly', label: 'Сар' },
  { key: 'all_time', label: 'Бүх цаг' },
];
const MEDAL = [colors.sparks, '#A9B4C7', '#CD7F4D'];

export default function TeacherLeaderboardScreen() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await getLeaderboard(token, period, 'teacher'));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="h1">Сурагчдын чансаа</AppText>
        <AppText variant="caption">Таны бүх ангийн сурагчид (XP-ээр)</AppText>
      </View>

      <View style={styles.tabs}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <Pressable
              key={p.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setPeriod(p.key)}
            >
              <AppText variant="label" color={active ? colors.white : colors.textSecondary}>
                {p.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : !data || data.entries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={56} color={colors.textMuted} />
          <AppText variant="body" center color={colors.textSecondary} style={{ marginTop: spacing.md }}>
            Энэ хугацаанд дата алга 🦊
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
        >
          {data.entries.map((e) => {
            const medal = e.rank <= 3 ? MEDAL[e.rank - 1] : null;
            return (
              <View key={e.userId} style={styles.row}>
                <View style={[styles.rankBadge, medal ? { backgroundColor: medal } : styles.rankPlain]}>
                  <AppText variant="label" color={medal ? colors.white : colors.textSecondary}>{e.rank}</AppText>
                </View>
                <Avatar avatarUrl={e.avatarUrl} name={e.fullName} size={36} />
                <View style={styles.name}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{e.fullName}</AppText>
                  {e.username ? <AppText variant="caption" numberOfLines={1}>@{e.username}</AppText> : null}
                </View>
                <View style={styles.xp}>
                  <Ionicons name="flash" size={13} color={colors.xp} />
                  <AppText variant="bodyStrong" color={colors.primary}>{e.xp}</AppText>
                </View>
              </View>
            );
          })}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: 2 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  list: { paddingHorizontal: spacing.lg },
  empty: { alignItems: 'center', marginTop: spacing.xxxl, paddingHorizontal: spacing.xl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  rankBadge: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  rankPlain: { backgroundColor: colors.surfaceAlt },
  name: { flex: 1 },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
