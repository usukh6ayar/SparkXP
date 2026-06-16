import { useState } from 'react';
import { View, Pressable, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/auth/AuthContext';
import { uploadAvatar, updateProfile } from '../src/api/users';
import { ApiError } from '../src/api/client';
import { DEFAULT_AVATARS } from '../src/lib/avatar';
import { t } from '../src/i18n';
import { AppText } from '../src/components/Text';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { colors, spacing, radius } from '../src/theme/theme';

export default function AvatarScreen() {
  const { user, token, updateUser } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFromPhotos() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(t('photoPermission'));

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
  }

  async function pickDefault(key: string) {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await updateProfile({ avatarUrl: key }, token);
      await updateUser(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="h3" style={styles.title}>{t('avatarTitle')}</AppText>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.current}>
        <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size={120} />
        {busy ? <ActivityIndicator color={colors.primary} style={styles.busy} /> : null}
      </View>

      {error ? (
        <AppText variant="caption" color={colors.danger} center style={styles.error}>
          {error}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={t('chooseFromPhotos')}
          icon="image-outline"
          onPress={pickFromPhotos}
          disabled={busy}
        />
      </View>

      <AppText variant="label" color={colors.textSecondary} style={styles.section}>
        {t('defaultAvatars')}
      </AppText>
      <View style={styles.grid}>
        {DEFAULT_AVATARS.map((a) => {
          const active = user?.avatarUrl === a.key;
          return (
            <Pressable
              key={a.key}
              onPress={() => pickDefault(a.key)}
              disabled={busy}
              style={[styles.cell, active && styles.cellActive]}
            >
              <Image source={a.src} style={styles.cellImg} resizeMode="cover" />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { flex: 1, textAlign: 'center' },
  current: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  busy: { position: 'absolute', top: 48 },
  error: { marginBottom: spacing.sm },
  actions: { paddingHorizontal: spacing.lg },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  cell: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  cellActive: { borderColor: colors.primary },
  cellImg: { width: '100%', height: '100%', backgroundColor: colors.primarySoft },
});
