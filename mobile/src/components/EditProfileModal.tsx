import { useEffect, useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import Animated from 'react-native-reanimated';
import { enter } from '../lib/motion';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { haptics } from '../lib/haptics';
import { isValidUsername } from '../lib/username';
import { useSettings } from '../settings/SettingsContext';
import * as usersApi from '../api/users';
import { MN_PROVINCES as PROVINCES, UB_DISTRICTS } from '../constants/locations';
import { alertError } from '../lib/alerts';
import { TopBar } from './TopBar';
import { TextField } from './TextField';
import { SelectField } from './SelectField';
import { Button } from './Button';
import { ModalScreen } from './ModalScreen';
import { spacing } from '../theme/theme';

/**
 * Edit-profile sheet — the single source of truth for editing a profile, opened
 * from both the Profile hero and Settings. Edits the profile-info fields on
 * PATCH /users/me: full name, English name, province & district. CEFR level is
 * NOT editable here — it's set by the placement test, not chosen by hand.
 */
export function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, token, updateUser } = useAuth();
  const { t } = useSettings();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);
  const isUB = province === 'Улаанбаатар';

  // Only send the username when it actually changed — re-sending your own name
  // would trip the server's uniqueness check against your own row.
  const usernameChanged = username.trim() !== (user?.username ?? '');

  // Pre-fill from the current profile each time the sheet opens (only on the
  // open transition, so a background user refresh doesn't wipe unsaved edits).
  useEffect(() => {
    if (!visible) return;
    haptics.tap();
    setFullName(user?.fullName ?? '');
    setUsername(user?.username ?? '');
    setProvince(user?.province ?? '');
    setDistrict(user?.district ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    if (!fullName.trim()) { alertError(t('enterName')); return; }
    // The username is the login handle, so it must stay well-formed and unique.
    if (usernameChanged && !isValidUsername(username)) { alertError(t('usernameInvalid')); return; }
    setSaving(true);
    try {
      const updated = await usersApi.updateProfile(
        {
          fullName: fullName.trim(),
          username: usernameChanged ? username.trim() : undefined,
          province: province || undefined,
          district: isUB ? district || undefined : undefined,
        },
        token!,
      );
      // Apply the returned user so the profile header reflects changes at once.
      await updateUser(updated);
      // The server strips fields its DTO doesn't know (global ValidationPipe
      // runs with `whitelist: true`), so a username change can come back
      // silently unapplied. Say so instead of claiming a save that didn't
      // happen — see the note on UpdateProfilePayload.username.
      if (usernameChanged && updated.username !== username.trim()) {
        alertError(t('usernameUnavailable'));
        return;
      }
      Alert.alert(t('success'), t('profileUpdated'));
      onClose();
    } catch (e) {
      // 409 = the handle is already someone else's.
      alertError(e instanceof ApiError && e.status === 409 ? t('usernameTaken') : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalScreen visible={visible} onClose={onClose} animationType="fade">
      <Animated.View entering={enter(0, 200)} style={{ flex: 1 }}>
      <TopBar title={t('editProfile')} showBadges={false} />
      {/* `automaticallyAdjustKeyboardInsets`: iOS doesn't resize for the keyboard
          like Android does, so lower fields hide behind it. No-op on Android. */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <TextField label={t('fullName')} value={fullName} onChangeText={setFullName} placeholder={t('enterName')} />
        {/* Login handle — unique, so it gets its own hint about the allowed
            characters and is only sent when the student actually changed it. */}
        <TextField
          label={t('username')} value={username} onChangeText={setUsername}
          placeholder={t('usernamePlaceholder')} autoCapitalize="none" autoCorrect={false}
          hint={t('usernameHint')}
          error={usernameChanged && username.trim() !== '' && !isValidUsername(username) ? t('usernameInvalid') : undefined}
        />
        <SelectField
          label={t('province')} value={province} options={PROVINCES}
          placeholder={t('selectOptional')}
          onSelect={(v) => { setProvince(v); setDistrict(''); }}
        />
        {isUB && (
          <SelectField label={t('district')} value={district} options={UB_DISTRICTS} placeholder={t('selectDistrict')} onSelect={setDistrict} />
        )}
        <Button label={saving ? t('saving') : t('save')} onPress={save} disabled={saving} style={{ marginTop: spacing.lg }} />
        <Button label={t('cancel')} variant="secondary" onPress={onClose} style={{ marginTop: spacing.md }} />
      </ScrollView>
      </Animated.View>
    </ModalScreen>
  );
}
