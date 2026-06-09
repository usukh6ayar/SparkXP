import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getStats } from '../../src/api/users';
import { getDue } from '../../src/api/reviews';
import { TopBar } from '../../src/components/TopBar';
import { StatCard } from '../../src/components/StatCard';
import { AppText } from '../../src/components/Text';
import { IconTile } from '../../src/components/IconTile';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const STREAK = 5; // TODO: real streak from backend

const CATS: { icon: IconName; label: string; sub: string; route: Href; tint: { bg: string; fg: string } }[] = [
  { icon: 'book', label: 'Хичээл', sub: 'Шинэ сэдэв', route: '/(tabs)/lessons', tint: tints.green },
  { icon: 'layers', label: 'Үг давтах', sub: 'Картаар сур', route: '/swipe', tint: tints.amber },
  { icon: 'game-controller', label: 'Сорил', sub: 'Тоглоом', route: '/(tabs)/soril', tint: tints.blue },
  { icon: 'chatbubble-ellipses', label: 'AI Найз', sub: 'Спарктай ярь', route: '/(tabs)/chat', tint: tints.purple },
];

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  const [xp, setXp] = useState(user?.xp ?? 0);
  const [sparks, setSparks] = useState(user?.sparks ?? 0);
  const [due, setDue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [stats, dueList] = await Promise.all([getStats(token), getDue(token)]);
      setXp(stats.xp);
      setSparks(stats.sparks);
      setDue(dueList.length);
    } catch {
      // keep last values
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar streak={STREAK} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting */}
        <AppText variant="h1">Сайн уу, {firstName} 👋</AppText>
        <AppText variant="body" color={colors.textSecondary} style={styles.sub}>
          Өнөөдөр суралцахад бэлэн үү?
        </AppText>

        {/* Daily goal hero */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="flame" size={14} color={colors.streak} />
              <AppText variant="label" color={colors.white}>{STREAK} хоног цуврал</AppText>
            </View>
          </View>
          <AppText variant="h2" color={colors.white} style={styles.heroTitle}>
            {due > 0 ? `${due} үг давтахаар хүлээж байна` : 'Өнөөдрийн зорилго'}
          </AppText>
          <AppText variant="body" color={colors.textOnDarkMuted} style={styles.heroSub}>
            {due > 0
              ? 'Цувралаа таслахгүйн тулд давтаж эхэл.'
              : 'Шинэ үг сурч, XP цуглуулаарай.'}
          </AppText>
          <Button
            label={due > 0 ? 'Давтаж эхлэх' : 'Үг сурах'}
            icon="arrow-forward"
            onPress={() => router.push('/swipe')}
            style={styles.heroBtn}
          />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="flash" label="XP" value={xp} color={colors.xp} bg={tints.orange.bg} />
          <StatCard icon="sparkles" label="Очирхон" value={sparks} color={colors.sparks} bg={colors.cream} />
          <StatCard icon="flame" label="Цуврал" value={STREAK} color={colors.streak} bg={colors.dangerSoft} />
        </View>

        {/* Learning paths */}
        <SectionHeader title="Юу сурах вэ?" style={styles.section} />
        <View style={styles.grid}>
          {CATS.map((c) => (
            <Pressable
              key={c.label}
              style={({ pressed }) => [styles.cat, pressed && styles.catPressed]}
              onPress={() => router.push(c.route)}
            >
              <IconTile icon={c.icon} bg={c.tint.bg} fg={c.tint.fg} size={44} />
              <View style={styles.catText}>
                <AppText variant="h3">{c.label}</AppText>
                <AppText variant="caption">{c.sub}</AppText>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  sub: { marginTop: 2, marginBottom: spacing.lg },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroTop: { flexDirection: 'row', marginBottom: spacing.md },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  heroTitle: { marginBottom: spacing.xs },
  heroSub: { marginBottom: spacing.lg },
  heroBtn: { alignSelf: 'flex-start', paddingHorizontal: spacing.xl },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  section: { marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  cat: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  catPressed: { backgroundColor: colors.surface, transform: [{ scale: 0.99 }] },
  catText: { flex: 1 },
});
