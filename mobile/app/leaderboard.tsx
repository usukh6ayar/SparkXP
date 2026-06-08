import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import {
  getLeaderboard,
  type Period,
  type Scope,
  type LeaderboardEntry,
  type LeaderboardResult,
} from '../src/api/leaderboard';
import { TopBar } from '../src/components/TopBar';
import { Loading } from '../src/components/Loading';
import { colors, spacing, radius, fontSize } from '../src/theme/theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'weekly', label: 'Долоо хоног' },
  { key: 'monthly', label: 'Сар' },
  { key: 'all_time', label: 'Бүх цаг' },
];
const SCOPES: { key: Scope; label: string }[] = [
  { key: 'global', label: 'Глобал' },
  { key: 'province', label: 'Аймаг' },
  { key: 'district', label: 'Дүүрэг' },
];
const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { token, user } = useAuth();
  const [period, setPeriod] = useState<Period>('weekly');
  const [scope, setScope] = useState<Scope>('global');
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await getLeaderboard(token, period, scope));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, period, scope]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="Тэргүүлэгчид" back streak={5} />

      {/* Period tabs */}
      <View style={styles.tabs}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.tab, period === p.key && styles.tabActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Scope chips */}
      <View style={styles.chips}>
        {SCOPES.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.chip, scope === s.key && styles.chipActive]}
            onPress={() => setScope(s.key)}
          >
            <Text style={[styles.chipText, scope === s.key && styles.chipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* My standing */}
          <View style={styles.meCard}>
            <Text style={styles.meRank}>{data?.me?.rank ? `#${data.me.rank}` : '—'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.meLabel}>Таны байр</Text>
              <Text style={styles.meName}>{user?.fullName}</Text>
            </View>
            <Text style={styles.meXp}>⚡ {data?.me?.xp ?? 0}</Text>
          </View>

          {!data || data.entries.length === 0 ? (
            <Text style={styles.empty}>Энэ хугацаанд дата алга 🦊</Text>
          ) : (
            data.entries.map((e) => (
              <Row key={e.userId} entry={e} isMe={e.userId === user?.id} />
            ))
          )}
          <View style={{ height: 110 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const medal = entry.rank <= 3 ? MEDALS[entry.rank - 1] : null;
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={[styles.rank, medal ? styles.rankMedal : null]}>{medal ?? entry.rank}</Text>
      <View style={styles.avatar}><Text style={styles.avatarEmoji}>🦊</Text></View>
      <Text style={styles.name} numberOfLines={1}>
        {entry.fullName}{isMe ? ' (Та)' : ''}
      </Text>
      <Text style={styles.xp}>⚡ {entry.xp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: '700', color: colors.textMuted, fontSize: fontSize.sm },
  tabTextActive: { color: colors.white },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginVertical: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.cream,
  },
  chipActive: { backgroundColor: colors.navy },
  chipText: { fontWeight: '700', color: colors.navy, fontSize: fontSize.sm },
  chipTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  meRank: { fontSize: fontSize.lg, fontWeight: '800', color: colors.sparks, minWidth: 44 },
  meLabel: { color: '#C7CEDF', fontSize: fontSize.sm },
  meName: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  meXp: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rank: { fontSize: fontSize.md, fontWeight: '800', color: colors.textMuted, minWidth: 28, textAlign: 'center' },
  rankMedal: { fontSize: fontSize.lg },
  avatar: {
    width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 20 },
  name: { flex: 1, fontWeight: '700', color: colors.navy, fontSize: fontSize.md },
  xp: { fontWeight: '800', color: colors.primary, fontSize: fontSize.md },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
});
