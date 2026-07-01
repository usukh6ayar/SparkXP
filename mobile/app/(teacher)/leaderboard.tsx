import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getLeaderboard, type Period, type LeaderboardResult } from '../../src/api/leaderboard';
import { AppText } from '../../src/components/Text';
import { PeriodTabs } from '../../src/components/PeriodTabs';
import { LeaderboardRow } from '../../src/components/LeaderboardRow';
import { PERIODS } from '../../src/constants/leaderboard';
import { colors, spacing } from '../../src/theme/theme';

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

      <PeriodTabs value={period} options={PERIODS} onChange={setPeriod} style={styles.tabs} />

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
          {data.entries.map((e) => (
            <LeaderboardRow
              key={e.userId}
              rank={e.rank}
              name={e.fullName}
              username={e.username}
              avatarUrl={e.avatarUrl}
              xp={e.xp}
            />
          ))}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: 2 },
  tabs: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg },
  empty: { alignItems: 'center', marginTop: spacing.xxxl, paddingHorizontal: spacing.xl },
});
