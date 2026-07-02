import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth/AuthContext';
import { uploadAvatar } from '../api/users';
import { ApiError } from '../api/client';
import { t } from '../i18n';

/**
 * Pick a square photo from the library and upload it as the user's avatar.
 * Shared by the Profile camera button and the avatar screen so the "change
 * photo" flow lives in exactly one place.
 */
export function useAvatarPicker() {
  const { token, updateUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = useCallback(async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(t('photoPermission')); return; }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (res.canceled || !token) return;

    setBusy(true);
    try {
      const updated = await uploadAvatar(res.assets[0].uri, token);
      await updateUser(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }, [token, updateUser]);

  return { pickPhoto, busy, error };
}
