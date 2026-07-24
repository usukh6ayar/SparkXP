import { useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
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
  // A photo chosen but not yet uploaded — drives the preview + Save flow.
  const [pending, setPending] = useState<string | null>(null);

  // Open the OS library with a forced 1:1 crop; returns the picked uri or null.
  const chooseFromLibrary = useCallback(async (): Promise<string | null> => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      // Denied — if the OS won't prompt again, the only way to enable it is the
      // system Settings, so offer to jump straight there.
      Alert.alert(t('photoPermissionTitle'), t('photoPermission'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    return res.canceled ? null : res.assets[0].uri;
  }, []);

  // Upload a chosen uri and refresh the user; shared by both flows.
  const upload = useCallback(async (uri: string) => {
    if (!token) return;
    setBusy(true);
    try {
      const updated = await uploadAvatar(uri, token);
      await updateUser(updated);
      setPending(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }, [token, updateUser]);

  // Instant flow (profile hero camera tap): pick → upload right away.
  const pickPhoto = useCallback(async () => {
    const uri = await chooseFromLibrary();
    if (uri) await upload(uri);
  }, [chooseFromLibrary, upload]);

  // Two-step flow (avatar screen): pick → preview → explicit Save.
  const pickForPreview = useCallback(async () => {
    const uri = await chooseFromLibrary();
    if (uri) setPending(uri);
  }, [chooseFromLibrary]);

  const savePending = useCallback(async () => {
    if (pending) await upload(pending);
  }, [pending, upload]);

  const cancelPending = useCallback(() => setPending(null), []);

  return { pickPhoto, pickForPreview, pending, savePending, cancelPending, busy, error };
}
