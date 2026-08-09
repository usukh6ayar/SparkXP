import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as authApi from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { isValidUsername } from '../../src/lib/username';
import { t } from '../../src/i18n';
import { spacing } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';
import { useAuth } from '../../src/auth/AuthContext';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { FormError } from '../../src/components/FormError';

/**
 * Last step of a first-time Google/Apple sign-in: pick the login handle.
 *
 * The server deliberately stops short of creating the account and hands back a
 * short-lived `ticket` instead, because a username is public on leaderboards —
 * deriving one from the person's email would both surprise them and leak the
 * address's local part. Nothing exists until this screen is submitted.
 *
 * There is no back button on purpose: going back would strand a ticket that
 * expires in 15 minutes with no account behind it. Leaving the screen at all
 * simply means signing in again, which is cheap.
 */
export default function ChooseUsernameScreen() {
  const colors = useColors();
  const { applySession } = useAuth();
  const { ticket, email, suggested, fullName } = useLocalSearchParams<{
    ticket: string;
    email: string;
    suggested?: string;
    fullName?: string;
  }>();

  const [username, setUsername] = useState(suggested ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const valid = isValidUsername(username);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await authApi.socialComplete(
        ticket,
        username.trim(),
        fullName?.trim() || undefined,
      );
      await applySession(res); // the auth gate redirects from here
    } catch (e) {
      // 409 is the useful one: the handle was taken between the suggestion and
      // the tap. Say so plainly instead of the generic backend wording.
      if (e instanceof ApiError && e.status === 409) setError(t('usernameTaken'));
      else setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="h1" center style={styles.title}>
        {t('chooseUsernameTitle')}
      </AppText>
      <AppText variant="body" center color={colors.textSecondary} style={styles.subtitle}>
        {t('chooseUsernameBody')}
      </AppText>

      {email ? (
        <AppText variant="caption" center color={colors.textMuted} style={styles.email}>
          {email}
        </AppText>
      ) : null}

      <TextField
        leftIcon="person-circle-outline"
        label={t('username')}
        placeholder={t('usernamePlaceholder')}
        hint={t('usernameHint')}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        value={username}
        onChangeText={setUsername}
        error={username.trim() !== '' && !valid ? t('usernameInvalid') : undefined}
      />

      <FormError message={error} />

      <Button
        label={t('chooseUsernameCta')}
        iconRight="arrow-forward"
        onPress={submit}
        loading={busy}
        disabled={!valid}
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.xxl },
  subtitle: { marginTop: spacing.sm, marginBottom: spacing.md },
  email: { marginBottom: spacing.lg },
  button: { marginTop: spacing.lg },
});
