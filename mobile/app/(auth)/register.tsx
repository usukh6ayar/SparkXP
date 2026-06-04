import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { t } from '../../src/i18n';
import { colors, spacing, fontSize } from '../../src/theme/theme';
import { MN_PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { Logo } from '../../src/components/Logo';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [province, setProvince] = useState<string | undefined>();
  const [district, setDistrict] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // District picker only makes sense for Ulaanbaatar (only its districts are
  // enumerated). Selecting a different province clears any chosen district.
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
      // Auth gate redirects on success.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logo}>
          <Logo size="md" />
        </View>

        <TextField
          label={t('fullName')}
          placeholder="Бат Болд"
          value={fullName}
          onChangeText={setFullName}
        />
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label={t('register')} onPress={onSubmit} loading={busy} style={styles.button} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('haveAccount')} </Text>
          <Link href="/(auth)/login" style={styles.link}>
            {t('login')}
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logo: { alignItems: 'center', marginBottom: spacing.lg },
  error: { color: colors.danger, marginBottom: spacing.sm },
  button: { marginTop: spacing.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  footerText: { color: colors.textMuted, fontSize: fontSize.md },
  link: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
});
