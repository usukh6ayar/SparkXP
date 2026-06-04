import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { t } from '../../src/i18n';
import { colors, spacing, radius, fontSize } from '../../src/theme/theme';

/**
 * Home (M0 placeholder). Shows the logged-in user + their XP/Sparks and a
 * logout button — enough to prove the session works. The real dashboard (#M2)
 * will pull live stats from GET /api/users/me/stats.
 */
export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>
        {t('welcome')}, {user?.fullName} 👋
      </Text>

      <View style={styles.statsRow}>
        <Stat label={t('xp')} value={user?.xp ?? 0} color={colors.xp} />
        <Stat label={t('sparks')} value={user?.sparks ?? 0} color={colors.sparks} />
      </View>

      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>{t('logout')}</Text>
      </Pressable>
    </View>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.stat, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  welcome: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  stat: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  logout: {
    marginTop: 'auto',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
