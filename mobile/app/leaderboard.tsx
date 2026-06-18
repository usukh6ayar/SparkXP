import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import {
  getLeaderboard,
  type Period,
  type Scope,
  type LeaderboardEntry,
  type LeaderboardResult,
} from '../src/api/leaderboard';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { Avatar } from '../src/components/Avatar';
import { Loading } from '../src/components/Loading';
import { colors, spacing, radius } from '../src/theme/theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'weekly', label: 'Долоо хоног' },
  { key: 'monthly', label: 'Сар' },
  { key: 'all_time', label: 'Бүх цаг' },
];
const SCOPES: { key: Scope; label: string }[] = [
  { key: 'teacher', label: 'Анги' },
  { key: 'global', label: 'Глобал' },
  { key: 'province', label: 'Аймаг' },
  { key: 'district', label: 'Дүүрэг' },
];
const MEDAL = [colors.sparks, '#A9B4C7', '#CD7F4D']; // gold, silver, bronze

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

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="Тэргүүлэгчид" back />

      {/* Period segmented control */}
      <View style={styles.tabs}>
        {PERIODS.map((p) => {
          const active = period === p.key;
          return (
            <Pressable
              key={p.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setPeriod(p.key)}
            >
              <AppText variant="label" color={active ? colors.white : colors.textSecondary}>{p.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Scope chips */}
      <View style={styles.chips}>
        {SCOPES.map((s) => {
          const active = scope === s.key;
          return (
            <Pressable
              key={s.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setScope(s.key)}
            >
              <AppText variant="label" color={active ? colors.white : colors.textSecondary}>{s.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* My standing */}
          <View style={styles.meCard}>
            <View style={styles.meRankWrap}>
              <AppText variant="h3" color={colors.sparks}>{data?.me?.rank ? `#${data.me.rank}` : '—'}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={colors.textOnDarkMuted}>Таны байр</AppText>
              <AppText variant="h3" color={colors.white} numberOfLines={1}>{user?.fullName}</AppText>
            </View>
            <View style={styles.meXp}>
              <Ionicons name="flash" size={14} color={colors.xp} />
              <AppText variant="bodyStrong" color={colors.white}>{data?.me?.xp ?? 0}</AppText>
            </View>
          </View>

          {!data || data.entries.length === 0 ? (
            <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
              Энэ хугацаанд дата алга 🦊
            </AppText>
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
  const medalColor = entry.rank <= 3 ? MEDAL[entry.rank - 1] : null;
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <View style={[styles.rankBadge, medalColor ? { backgroundColor: medalColor } : styles.rankPlain]}>
        <AppText variant="label" color={medalColor ? colors.white : colors.textSecondary}>{entry.rank}</AppText>
      </View>
      <Avatar avatarUrl={entry.avatarUrl} name={entry.fullName} size={36} />
      <View style={styles.name}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {entry.fullName}{isMe ? ' (Та)' : ''}
        </AppText>
        {entry.username ? (
          <AppText variant="caption" numberOfLines={1}>@{entry.username}</AppText>
        ) : null}
      </View>
      <View style={styles.xp}>
        <Ionicons name="flash" size={13} color={colors.xp} />
        <AppText variant="bodyStrong" color={colors.primary}>{entry.xp}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginVertical: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.navy },
  list: { paddingHorizontal: spacing.lg },
  meCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  meRankWrap: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  meXp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  rowMe: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rankBadge: { width: 28, height: 28, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  rankPlain: { backgroundColor: colors.surfaceAlt },
  avatar: {
    width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { flex: 1 },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { marginTop: spacing.xxl },
});
