import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { t } from '../../src/i18n';
import { spacing } from '../../src/theme/theme';
import { MN_PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { Screen } from '../../src/components/Screen';
import { Logo } from '../../src/components/Logo';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { FormError } from '../../src/components/FormError';
import { AuthFooter } from '../../src/components/AuthFooter';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [province, setProvince] = useState<string | undefined>();
  const [district, setDistrict] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // District applies only to Ulaanbaatar (only its districts are enumerated).
  const isUB = province === 'Улаанбаатар';

  function onProvinceChange(value: string) {
    setProvince(value);
    if (value !== 'Улаанбаатар') setDistrict(undefined);
  }

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        province,
        district: isUB ? district : undefined,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen centered>
      <View style={styles.logo}>
        <Logo size="md" />
      </View>

      <TextField label={t('fullName')} placeholder="Бат Болд" value={fullName} onChangeText={setFullName} />
      <TextField
        label={t('email')}
        placeholder="name@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label={t('password')}
        placeholder="дор хаяж 6 тэмдэгт"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <SelectField
        label={`${t('province')} (${t('optional')})`}
        placeholder={t('selectProvince')}
        value={province}
        options={MN_PROVINCES}
        onSelect={onProvinceChange}
      />
      {isUB ? (
        <SelectField
          label={`${t('district')} (${t('optional')})`}
          placeholder={t('selectDistrict')}
          value={district}
          options={UB_DISTRICTS}
          onSelect={setDistrict}
        />
      ) : null}

      <FormError message={error} />
      <Button label={t('register')} onPress={onSubmit} loading={busy} style={styles.button} />
      <AuthFooter prompt={t('haveAccount')} linkLabel={t('login')} href="/(auth)/login" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginBottom: spacing.lg },
  button: { marginTop: spacing.sm },
});
