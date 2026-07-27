import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import * as authApi from '../src/api/auth';
import { ApiError } from '../src/api/client';
import { t } from '../src/i18n';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { FormError } from '../src/components/FormError';
import { spacing, radius, tints, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';
import { useColors } from '../src/settings/SettingsContext';

/**
 * Change password for a signed-in user. Reuses the existing email-code reset
 * flow (`forgot-password` → `reset-password`): we send a code to the account's
 * own email, then take the code + a new password. No new backend needed.
 */
export default function ChangePasswordScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const email = user?.email ?? '';

  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setStep('reset');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError(null);
    setBusy(true);
    try {
      await authApi.resetPassword(email, code.trim(), password);
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('changePassword')} back showBadges={false} />
      <ScrollView
        contentContainerStyle={[styles.container, bounded]}
        keyboardShouldPersistTaps="handled"
        // iOS does not resize the window for the keyboard the way Android does,
        // so the lower fields end up hidden behind it. No-op on Android.
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {step === 'done' ? (
          <View style={styles.doneWrap}>
            <Ionicons name="checkmark-circle" size={72} color={colors.success} />
            <AppText variant="h2" center style={{ marginTop: spacing.md }}>{t('passwordChanged')}</AppText>
            <Button label={t('finish')} onPress={() => router.back()} style={styles.button} />
          </View>
        ) : !email ? (
          <AppText variant="body" color={colors.textMuted} center style={{ marginTop: spacing.xl }}>
            {t('noEmailOnAccount')}
          </AppText>
        ) : (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-closed" size={26} color={tints.purple.fg} />
            </View>
            <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
              {step === 'request' ? t('changePasswordSubtitle') : `${t('otpSentTo')} ${email}`}
            </AppText>

            {step === 'request' ? (
              <>
                <View style={styles.emailPill}>
                  <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                  <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{email}</AppText>
                </View>
                <FormError message={error} />
                <Button label={t('sendCode')} onPress={requestCode} loading={busy} style={styles.button} />
              </>
            ) : (
              <>
                <TextField
                  leftIcon="key-outline"
                  placeholder={t('otpCode')}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />
                <TextField
                  leftIcon="lock-closed-outline"
                  placeholder={t('newPassword')}
                  secureToggle
                  value={password}
                  onChangeText={setPassword}
                />
                <FormError message={error} />
                <Button
                  label={t('resetPassword')}
                  onPress={reset}
                  loading={busy}
                  disabled={code.trim().length !== 6 || password.length < 6}
                  style={styles.button}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.md, alignSelf: 'center',
    backgroundColor: tints.purple.bg, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  subtitle: { textAlign: 'center', marginBottom: spacing.xl },
  emailPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  button: { marginTop: spacing.lg },
  doneWrap: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: spacing.sm },
});
