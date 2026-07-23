import { useEffect, useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../auth/AuthContext';
import { haptics } from '../lib/haptics';
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
  const [englishName, setEnglishName] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);
  const isUB = province === 'Улаанбаатар';

  // Pre-fill from the current profile each time the sheet opens (only on the
  // open transition, so a background user refresh doesn't wipe unsaved edits).
  useEffect(() => {
    if (!visible) return;
    haptics.tap();
    setFullName(user?.fullName ?? '');
    setEnglishName(user?.englishName ?? '');
    setProvince(user?.province ?? '');
    setDistrict(user?.district ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    if (!fullName.trim()) { alertError(t('enterName')); return; }
    setSaving(true);
    try {
      const updated = await usersApi.updateProfile(
        {
          fullName: fullName.trim(),
          englishName: englishName.trim() || undefined,
          province: province || undefined,
          district: isUB ? district || undefined : undefined,
        },
        token!,
      );
      // Apply the returned user so the profile header reflects changes at once.
      await updateUser(updated);
      Alert.alert(t('success'), t('profileUpdated'));
      onClose();
    } catch {
      alertError(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalScreen visible={visible} onClose={onClose} animationType="fade">
      <Animated.View entering={FadeInDown.springify().damping(16)} style={{ flex: 1 }}>
      <TopBar title={t('editProfile')} showBadges={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <TextField label={t('fullName')} value={fullName} onChangeText={setFullName} placeholder={t('enterName')} />
        <TextField
          label={t('englishName')} value={englishName} onChangeText={setEnglishName}
          placeholder={t('optional')} autoCapitalize="words"
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
