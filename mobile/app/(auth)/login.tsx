import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { t } from '../../src/i18n';
import { spacing } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { Logo } from '../../src/components/Logo';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { FormError } from '../../src/components/FormError';
import { AuthFooter } from '../../src/components/AuthFooter';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password); // auth gate redirects on success
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen centered>
      <View style={styles.logo}>
        <Logo />
      </View>

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
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <FormError message={error} />
      <Button label={t('login')} onPress={onSubmit} loading={busy} style={styles.button} />
      <AuthFooter prompt={t('noAccount')} linkLabel={t('register')} href="/(auth)/register" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginBottom: spacing.xl },
  button: { marginTop: spacing.sm },
});
