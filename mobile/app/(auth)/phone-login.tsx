import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as phoneApi from '../../src/api/phone';
import { useAuth } from '../../src/auth/AuthContext';
import { usePhoneVerification } from '../../src/lib/usePhoneVerification';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing } from '../../src/theme/theme';
import { t } from '../../src/i18n';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { ActionButton } from '../../src/components/ActionButton';
import { FormError } from '../../src/components/FormError';
import { PhoneVerifyCard } from '../../src/components/PhoneVerifyCard';

/** «SMS-ээр нэвтрэх»: number → SMS → logged in. No password. */
export default function PhoneLoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { applySession } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const v = usePhoneVerification();
  const digits = phone.replace(/\D/g, '');

  const begin = () => v.start(() => phoneApi.startPhoneVerification(digits, 'login'));

  useEffect(() => {
    if (v.state !== 'verified' || !v.verificationId) return;
    phoneApi
      .loginWithPhone(v.verificationId)
      .then(applySession) // RootNavigator then leaves (auth)
      .catch((e) => {
        v.reset();
        setError(e instanceof Error ? e.message : t('errorGeneric'));
      });
    // Fires once when the SMS arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.state]);

  return (
    <Screen>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <AppText variant="h1" style={styles.title}>{t('phoneLoginTitle')}</AppText>
      <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {v.session ? t('phoneVerifyBody') : t('phoneLoginBody')}
      </AppText>

      {v.session ? (
        <PhoneVerifyCard verification={v} onRestart={() => begin().catch(() => {})} />
      ) : (
        <>
          <TextField leftIcon="call-outline" label={t('phone')} keyboardType="number-pad" maxLength={8} value={phone} onChangeText={setPhone} />
          <FormError message={error} />
          <ActionButton
            label={t('continue')}
            action={begin}
            onError={(msg) => setError(msg)}
            disabled={!/^[5-9]\d{7}$/.test(digits)}
            style={styles.button}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  title: { marginTop: spacing.md },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.lg },
  button: { marginTop: spacing.md },
});
