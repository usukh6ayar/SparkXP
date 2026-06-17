import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { t } from '../../src/i18n';
import { AppText } from '../../src/components/Text';
import { Avatar } from '../../src/components/Avatar';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius, elevation } from '../../src/theme/theme';

export default function TeacherProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="h1">{t('profile')}</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Gradient hero */}
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Pressable onPress={() => router.push('/avatar')} style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size={92} />
            </View>
            <View style={styles.camBadge}>
              <Ionicons name="camera" size={13} color={colors.white} />
            </View>
          </Pressable>
          <AppText variant="h2" color={colors.white} center style={{ marginTop: spacing.md }}>
            {user?.fullName ?? ''}
          </AppText>
          <View style={styles.teacherBadge}>
            <Ionicons name="school" size={13} color={colors.primary} />
            <AppText variant="label" color={colors.primary}>{t('teacher')}</AppText>
          </View>
        </LinearGradient>

        {/* Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="at-outline" size={18} color={colors.textMuted} />
            <AppText variant="body" color={colors.textSecondary}>
              {user?.username ?? '—'}
            </AppText>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <AppText variant="body" color={colors.textSecondary}>{user?.email ?? ''}</AppText>
          </View>
        </View>

        <Button
          label={t('logout')}
          variant="secondary"
          icon="log-out-outline"
          onPress={logout}
          style={styles.logout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...(elevation.float as object),
  },
  avatarWrap: { position: 'relative' },
  avatarRing: {
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  camBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  teacherBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...(elevation.sm as object),
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border },
  logout: { marginTop: spacing.lg },
});
