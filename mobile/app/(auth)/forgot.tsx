import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as authApi from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { t } from '../../src/i18n';
import { spacing, colors } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { FormError } from '../../src/components/FormError';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim());
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
      await authApi.resetPassword(email.trim(), code.trim(), password);
      setStep('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable
        style={styles.back}
        onPress={() => router.replace({ pathname: '/(auth)/login', params: { signin: '1' } })}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>

      {step === 'done' ? (
        <View style={styles.doneWrap}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <AppText variant="h2" center style={{ marginTop: spacing.md }}>
            {t('resetDone')}
          </AppText>
          <Button
            label={t('backToLogin')}
            onPress={() => router.replace({ pathname: '/(auth)/login', params: { signin: '1' } })}
            style={styles.button}
          />
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
                placeholder={t('email')}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <FormError message={error} />
              <Button label={t('sendCode')} onPress={requestCode} loading={busy} disabled={!email.trim()} style={styles.button} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: spacing.sm },
  title: { marginTop: spacing.sm },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.xl },
  button: { marginTop: spacing.sm },
  doneWrap: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: spacing.sm },
});
