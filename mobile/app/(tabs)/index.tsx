import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthContext';
import { t } from '../../src/i18n';
import { colors, spacing, radius, fontSize } from '../../src/theme/theme';
import { Button } from '../../src/components/Button';
import { StatCard } from '../../src/components/StatCard';

/**
 * Home / Dashboard. XP + Sparks come from the auth session for now; M2 will
 * pull live stats from GET /api/users/me/stats and the real review count.
 */
export default function HomeScreen() {
  const { user, logout } = useAuth();

  const comingSoon = () =>
    Alert.alert('Тун удахгүй', 'Энэ хэсэг удахгүй нэмэгдэнэ.');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>{t('greeting')} 👋</Text>
            <Text style={styles.name}>{user?.fullName}</Text>
          </View>
          <Pressable onPress={logout} style={styles.logoutBtn} hitSlop={8}>
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon="⚡" label={t('xp')} value={user?.xp ?? 0} color={colors.xp} bg={colors.primarySoft} />
          <StatCard icon="✨" label={t('sparks')} value={user?.sparks ?? 0} color={colors.sparks} bg={colors.cream} />
        </View>

        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>{t('todayGoal')}</Text>
          <Text style={styles.goalSub}>Үгсээ давтаж XP цуглуул! 🦊</Text>
          <Button label={t('reviewWords')} onPress={comingSoon} style={{ marginTop: spacing.md }} />
        </View>

        <Button label={t('startLearning')} variant="secondary" onPress={comingSoon} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  hello: { fontSize: fontSize.md, color: colors.textMuted },
  name: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  logoutBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.textMuted, fontWeight: '600', fontSize: fontSize.sm },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  goalCard: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  goalTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.white },
  goalSub: { fontSize: fontSize.md, color: '#C7CEDF', marginTop: spacing.xs },
});
