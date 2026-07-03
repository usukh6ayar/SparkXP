import { useEffect, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { parseInviteCode, stashPendingReferral } from '../../src/lib/referralLink';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { TopBar } from '../../src/components/TopBar';
import { t } from '../../src/i18n';
import { spacing, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/**
 * Deep-link target: `englishxp://invite/CODE`.
 * - Logged out → stash the code and send them to register, where the code is
 *   applied so both sides get the referral XP after email verification.
 * - Logged in → can't be referred (only new users), so show a friendly note.
 * The code is stashed to secure storage so it survives even if the auth gate
 * bounces a logged-out user through onboarding/login first.
 */
export default function InviteWithCodeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { code } = useLocalSearchParams<{ code: string }>();
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const parsed = code ? parseInviteCode(code) : null;
    if (!parsed) return;
    // Only a not-yet-registered user can redeem an invite.
    if (!token) {
      stashPendingReferral(parsed).finally(() => router.replace('/(auth)/register'));
    }
  }, [loading, token, code]);

  // Logged-in users can't be referred — explain instead of redirecting.
  if (!loading && token) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar title={t('inviteFriends')} back showBadges={false} />
        <View style={styles.center}>
          <Ionicons name="people-circle-outline" size={72} color={colors.primary} />
          <AppText variant="h2" center style={styles.title}>{t('inviteAlreadyTitle')}</AppText>
          <AppText variant="body" center color={colors.textSecondary}>{t('inviteAlreadyBody')}</AppText>
          <Button label={t('inviteFriends')} onPress={() => router.replace('/invite')} style={styles.btn} />
        </View>
      </SafeAreaView>
    );
  }

  // Logged out (or still restoring) → brief spinner while we redirect to register.
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  title: { marginTop: spacing.sm },
  btn: { marginTop: spacing.lg, alignSelf: 'stretch' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
