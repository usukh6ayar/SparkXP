import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { TopBar } from '../../src/components/TopBar';
import { StatCard } from '../../src/components/StatCard';
import { colors, spacing, radius, fontSize, tints } from '../../src/theme/theme';

const CATS: { icon: string; label: string; route: Href; tint: { bg: string; fg: string } }[] = [
  { icon: '📖', label: 'Хичээл', route: '/(tabs)/lessons', tint: tints.green },
  { icon: '🃏', label: 'Үг давтах', route: '/swipe', tint: tints.amber },
  { icon: '🏆', label: 'Сорил', route: '/(tabs)/soril', tint: tints.blue },
  { icon: '🦊', label: 'AI Найз', route: '/(tabs)/chat', tint: tints.purple },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar streak={5} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.hello}>Сайн уу, {firstName}! 👋</Text>
        <Text style={styles.sub}>Өнөөдөр юу сурах вэ?</Text>

        <View style={styles.statsRow}>
          <StatCard icon="⚡" label="XP" value={user?.xp ?? 0} color={colors.xp} bg={colors.primarySoft} />
          <StatCard icon="🪙" label="Очирхон" value={user?.sparks ?? 0} color={colors.sparks} bg={colors.cream} />
        </View>

        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>Өнөөдрийн зорилго 🎯</Text>
          <Text style={styles.goalSub}>Үгсээ давтаж XP цуглуул! 🦊</Text>
          <Pressable style={styles.goalBtn} onPress={() => router.push('/swipe')}>
            <Text style={styles.goalBtnText}>Үг давтах</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Ангилал</Text>
        <View style={styles.grid}>
          {CATS.map((c) => (
            <Pressable
              key={c.label}
              style={[styles.cat, { backgroundColor: c.tint.bg }]}
              onPress={() => router.push(c.route)}
            >
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text style={[styles.catLabel, { color: c.tint.fg }]}>{c.label}</Text>
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
  container: { paddingHorizontal: spacing.lg },
  hello: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.navy },
  sub: { fontSize: fontSize.md, color: colors.textMuted, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  goalCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  goalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.white },
  goalSub: { fontSize: fontSize.md, color: '#C7CEDF', marginTop: spacing.xs },
  goalBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  goalBtnText: { color: colors.white, fontWeight: '800', fontSize: fontSize.md },
  section: { fontSize: fontSize.lg, fontWeight: '800', color: colors.navy, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cat: {
    width: '48%',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  catIcon: { fontSize: 40 },
  catLabel: { fontSize: fontSize.md, fontWeight: '800', marginTop: spacing.sm },
});
