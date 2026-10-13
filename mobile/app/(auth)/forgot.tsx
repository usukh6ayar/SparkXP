import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as authApi from '../../src/api/auth';
import * as phoneApi from '../../src/api/phone';
import { useAuth } from '../../src/auth/AuthContext';
import { usePhoneVerification } from '../../src/lib/usePhoneVerification';
import { t } from '../../src/i18n';
import { spacing, radius } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ActionButton } from '../../src/components/ActionButton';
import { FormError } from '../../src/components/FormError';
import { PhoneVerifyCard } from '../../src/components/PhoneVerifyCard';

/**
 * Password recovery. Phone first (verify.mn SMS → new password → logged
 * straight in). The email code path stays for old accounts with a verified
 * address and no phone — the backend only emails verified addresses.
 */
export default function ForgotPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { applySession } = useAuth();
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [error, setError] = useState<string | null>(null);

  // ── phone ──
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const v = usePhoneVerification();
  const digits = phone.replace(/\D/g, '');
  const beginPhone = () => v.start(() => phoneApi.startPhoneVerification(digits, 'reset'));
  async function savePhonePassword() {
    setError(null);
    const res = await phoneApi.resetWithPhone(v.verificationId!, newPassword);
    await applySession(res); // RootNavigator then leaves (auth)
  }

  // ── email (legacy) ──
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  function requestCode() {
    setError(null);
    return authApi.forgotPassword(email.trim());
  }

  function reset() {
    setError(null);
    return authApi.resetPassword(email.trim(), code.trim(), password);
  }

  const backToLogin = () => router.replace({ pathname: '/(auth)/login', params: { signin: '1' } });

  return (
    <Screen>
      <Pressable style={styles.back} onPress={backToLogin} hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>

      {mode === 'phone' ? (
        v.state === 'verified' ? (
          <>
            <View style={[styles.chip, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="checkmark" size={14} color={colors.success} />
              <AppText variant="label" color={colors.success}>{digits}</AppText>
            </View>
            <AppText variant="h1" style={styles.title}>{t('newPasswordTitle')}</AppText>
            <TextField
              leftIcon="lock-closed-outline"
              label={t('newPassword')}
              secureToggle
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <FormError message={error} />
            <ActionButton
              label={t('savePassword')}
              action={savePhonePassword}
              onError={setError}
              disabled={newPassword.length < 6}
              style={styles.button}
            />
          </>
        ) : (
          <>
            <AppText variant="h1" style={styles.title}>{t('forgotTitle')}</AppText>
            <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
              {v.session ? t('phoneVerifyBody') : t('forgotPhoneBody')}
            </AppText>
            {v.session ? (
              <PhoneVerifyCard verification={v} onRestart={() => beginPhone().catch(() => {})} />
            ) : (
              <>
                <TextField
                  leftIcon="call-outline"
                  label={t('phone')}
                  keyboardType="number-pad"
                  maxLength={8}
                  value={phone}
                  onChangeText={setPhone}
                />
                <FormError message={error} />
                <ActionButton
                  label={t('continue')}
                  action={beginPhone}
                  onError={setError}
                  disabled={!/^[5-9]\d{7}$/.test(digits)}
                  style={styles.button}
                />
                <Button
                  label={t('forgotByEmail')}
                  variant="ghost"
                  onPress={() => {
                    setError(null);
                    setMode('email');
                  }}
                  style={styles.button}
                />
              </>
            )}
          </>
        )
      ) : step === 'done' ? (
        <View style={styles.doneWrap}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <AppText variant="h2" center style={{ marginTop: spacing.md }}>
            {t('resetDone')}
          </AppText>
          <Button label={t('backToLogin')} onPress={backToLogin} style={styles.button} />
        </View>
      ) : (
        <>
          <AppText variant="h1" style={styles.title}>{t('forgotTitle')}</AppText>
          <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
            {step === 'email' ? t('forgotSubtitle') : `${t('otpSentTo')} ${email}`}
          </AppText>

          {step === 'email' ? (
            <>
              <TextField
                leftIcon="mail-outline"
                label={t('email')}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <FormError message={error} />
              <ActionButton
                label={t('sendCode')}
                action={requestCode}
                onSuccess={() => setStep('reset')}
                onError={setError}
                disabled={!email.trim()}
                style={styles.button}
              />
            </>
          ) : (
            <>
              <TextField
                leftIcon="key-outline"
                label={t('otpCode')}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <TextField
                leftIcon="lock-closed-outline"
                label={t('newPassword')}
                secureToggle
                value={password}
                onChangeText={setPassword}
              />
              <FormError message={error} />
              <ActionButton
                label={t('resetPassword')}
                action={reset}
                onSuccess={() => setStep('done')}
                onError={setError}
                disabled={code.trim().length !== 6 || password.length < 6}
                style={styles.button}
              />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

// No themed values in here, so these are plain constants — no per-render rebuild.
const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: spacing.sm },
  title: { marginTop: spacing.sm },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.xl },
  button: { marginTop: spacing.sm },
  doneWrap: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
});
