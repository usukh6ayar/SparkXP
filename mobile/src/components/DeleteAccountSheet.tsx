import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Button } from './Button';
import { ActionButton } from './ActionButton';
import { TextField } from './TextField';
import { FormError } from './FormError';
import { SheetModal } from './SheetModal';
import { useColors } from '../settings/SettingsContext';
import { useAuth } from '../auth/AuthContext';
import { deleteAccount } from '../api/users';
import { t } from '../i18n';
import { spacing, radius } from '../theme/theme';

/**
 * Permanently delete the signed-in account.
 *
 * Required by App Store Review Guideline 5.1.1(v) — an app that lets people
 * create an account must let them delete it from inside the app; pointing them
 * at a support email is an automatic rejection.
 *
 * The design is deliberately high-friction for an irreversible action: the
 * consequences are spelled out, the password has to be typed again, and the
 * confirm button stays disabled until it is. On success `logout()` clears the
 * local session, which drops the user back at the welcome screen — the token
 * is already dead server-side.
 */
export function DeleteAccountSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const { token, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    // Never leave a typed password sitting in state behind a closed sheet.
    setPassword('');
    setError(null);
    onClose();
  }

  async function confirmDelete() {
    setError(null);
    await deleteAccount(password, token!);
    setPassword('');
    // The account is gone; this only clears the device's copy of the session.
    await logout();
  }

  return (
    <SheetModal visible={visible} onClose={close}>
      <View style={[styles.iconWrap, { backgroundColor: c.dangerSoft }]}>
        <Ionicons name="trash" size={26} color={c.danger} />
      </View>

      <AppText variant="h2" center style={styles.title}>
        {t('deleteAccount')}
      </AppText>
      {/* The explanation is the part that can afford to give way: once the
          password field takes focus the keyboard eats half a small phone, and
          the field and its buttons are what must stay reachable. This block
          shrinks and scrolls instead; nothing below it moves. */}
      <ScrollView
        style={styles.explain}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="body" center color={c.textSecondary} style={styles.body}>
          {t('deleteAccountBody')}
        </AppText>

        {/* What actually goes. Vague warnings make people tap through; a concrete
            list is what makes the choice informed. */}
        <View style={[styles.losses, { backgroundColor: c.surfaceAlt }]}>
          {(['deleteAccountLoss1', 'deleteAccountLoss2', 'deleteAccountLoss3'] as const).map((key) => (
            <View key={key} style={styles.lossRow}>
              <Ionicons name="close-circle" size={16} color={c.danger} />
              <AppText variant="caption" color={c.textSecondary} style={styles.lossText}>
                {t(key)}
              </AppText>
            </View>
          ))}
        </View>
      </ScrollView>

      <TextField
        leftIcon="lock-closed-outline"
        label={t('password')}
        placeholder={t('deleteAccountPasswordHint')}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      <FormError message={error} />

      <View style={styles.actions}>
        <ActionButton
          label={t('deleteAccountConfirm')}
          variant="danger"
          action={confirmDelete}
          onError={setError}
          disabled={!password || !token}
        />
        <Button label={t('cancel')} variant="ghost" onPress={close} />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: spacing.md },
  // `flexGrow: 0` so a short explanation takes only the room it needs (the
  // sheet stays compact); `flexShrink: 1` lets the keyboard squeeze it.
  explain: { flexGrow: 0, flexShrink: 1 },
  body: { marginTop: spacing.sm },
  losses: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  lossRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  lossText: { flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
