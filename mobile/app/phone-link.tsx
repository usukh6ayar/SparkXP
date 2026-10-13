import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as phoneApi from '../src/api/phone';
import { useAuth } from '../src/auth/AuthContext';
import { usePhoneVerification } from '../src/lib/usePhoneVerification';
import { useColors } from '../src/settings/SettingsContext';
import { spacing } from '../src/theme/theme';
import { t } from '../src/i18n';
import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { ActionButton } from '../src/components/ActionButton';
import { FormError } from '../src/components/FormError';
import { PhoneVerifyCard } from '../src/components/PhoneVerifyCard';

/**
 * `?gate=1` — the forced gate for email accounts without a verified phone
 * (server flag `user.needsPhone`; RootNavigator sends them here). No back, only
 * «Гарах». Without it: the optional «Холбох» from the Account screen.
 */
export default function PhoneLinkScreen() {
  const colors = useColors();
  const router = useRouter();
  const { gate } = useLocalSearchParams<{ gate?: string }>();
  const isGate = gate === '1';
  const { token, user, updateUser, logout } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const v = usePhoneVerification();
  const digits = phone.replace(/\D/g, '');

  const begin = () => v.start(() => phoneApi.startLinkPhone(digits, token!));

  useEffect(() => {
    if (v.state !== 'verified' || !v.verificationId || !token) return;
    phoneApi
      .linkPhone(v.verificationId, token)
      .then(async (fresh) => {
        await updateUser(fresh); // needsPhone=false
        // Leave explicitly — the gate has no back button, so never rely on
        // RootNavigator's history check alone to get the user out of it.
        if (isGate) router.replace(user?.role === 'teacher' ? '/(teacher)' : '/(tabs)');
        else router.back();
      })
      .catch((e) => {
        v.reset();
        setError(e instanceof Error ? e.message : t('errorGeneric'));
      });
    // Fires once when the SMS arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.state]);

  return (
    <Screen>
      {!isGate ? (
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      ) : null}

      <AppText variant="h1" style={styles.title}>{isGate ? t('phoneGateTitle') : t('phoneLinkTitle')}</AppText>
      <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {v.session ? t('phoneVerifyBody') : isGate ? t('phoneGateBody') : t('phoneLinkBody')}
      </AppText>

      {v.session ? (
        <PhoneVerifyCard verification={v} onRestart={() => begin().catch(() => {})} />
      ) : (
        <>
          <TextField leftIcon="call-outline" label={t('phone')} keyboardType="number-pad" maxLength={8} value={phone} onChangeText={setPhone} />
          <FormError message={error} />
          <ActionButton
            label={t('verifyAction')}
            action={begin}
            onError={setError}
            disabled={!/^[5-9]\d{7}$/.test(digits)}
            style={styles.button}
          />
        </>
      )}

      {isGate ? (
        <View style={styles.footer}>
          <AppText variant="caption" center color={colors.textMuted}>{`${user?.username ?? ''} ${t('signedInAs')}`}</AppText>
          <Button label={t('logout')} variant="ghost" onPress={logout} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  title: { marginTop: spacing.md },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  button: { marginTop: spacing.md },
  footer: { marginTop: 'auto', gap: spacing.xs, paddingTop: spacing.lg },
});
