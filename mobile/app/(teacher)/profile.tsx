import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { t } from '../../src/i18n';
import { AppText } from '../../src/components/Text';
import { Pill } from '../../src/components/Pill';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

export default function TeacherProfileScreen() {
  const { user, logout } = useAuth();
  const initial = user?.fullName?.trim().charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="h1">{t('profile')}</AppText>
      </View>

      <View style={styles.body}>
        <View style={styles.avatar}>
          <AppText variant="display" color={colors.primary}>{initial}</AppText>
        </View>
        <AppText variant="h2" center style={{ marginTop: spacing.md }}>
          {user?.fullName ?? ''}
        </AppText>
        <Pill label={t('teacher')} icon="school" bg={tints.purple.bg} fg={tints.purple.fg} />

        <Card variant="raised" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <AppText variant="body" color={colors.textSecondary}>{user?.email ?? ''}</AppText>
          </View>
        </Card>

        <Button
          label={t('logout')}
          variant="secondary"
          icon="log-out-outline"
          onPress={logout}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.md },
  body: { alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  infoCard: { alignSelf: 'stretch', marginTop: spacing.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
