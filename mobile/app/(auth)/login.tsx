import { useState } from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthContext';
import { ApiError } from '../../src/api/client';
import { t } from '../../src/i18n';
import { spacing, colors } from '../../src/theme/theme';
import { Screen } from '../../src/components/Screen';
import { Logo } from '../../src/components/Logo';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { Checkbox } from '../../src/components/Checkbox';
import { SocialRow } from '../../src/components/SocialRow';
import { FormError } from '../../src/components/FormError';
import { AuthFooter } from '../../src/components/AuthFooter';

const fox = require('../../assets/onboarding/onb-welcome.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password); // auth gate redirects on success
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const soon = () => setError(t('comingSoon'));

  return (
    <Screen>
      <Logo size="md" wordmarkOnly align="left" />
      <AppText variant="h1" style={styles.title}>
        {t('welcomeBack')}
      </AppText>
      <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {t('loginSubtitle')}
      </AppText>

      <TextField
        leftIcon="person-outline"
        placeholder={t('username')}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextField
        leftIcon="lock-closed-outline"
        placeholder={t('password')}
        secureToggle
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.row}>
        <Checkbox checked={remember} onToggle={() => setRemember((v) => !v)} label={t('rememberMe')} />
        <Pressable onPress={() => router.push('/(auth)/forgot')} hitSlop={6}>
          <AppText variant="caption" color={colors.primary}>
            {t('forgotPassword')}
          </AppText>
        </Pressable>
      </View>

      <FormError message={error} />
      <Button
        label={t('login')}
        iconRight="arrow-forward"
        onPress={onSubmit}
        loading={busy}
        style={styles.button}
      />

      <View style={styles.divider}>
        <View style={styles.line} />
        <AppText variant="caption" color={colors.textMuted}>
          {t('orDivider')}
        </AppText>
        <View style={styles.line} />
      </View>
      <SocialRow onPress={soon} />

      <AuthFooter prompt={t('noAccount')} linkLabel={t('register')} href="/(auth)/register" />

      <Image source={fox} style={styles.fox} resizeMode="contain" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xl },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  button: { marginTop: spacing.sm },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  fox: { width: 120, height: 120, alignSelf: 'flex-start', marginTop: spacing.md },
});
