import { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { useAvatarPicker } from '../src/lib/useAvatarPicker';
import { t } from '../src/i18n';
import { AppText } from '../src/components/Text';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { TopBar } from '../src/components/TopBar';
import { spacing, radius, elevation, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';
import { useColors } from '../src/settings/SettingsContext';

/** Change your profile photo. Just the photo picker — no default-avatar grid. */
export default function AvatarScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { pickPhoto, busy, error } = useAvatarPicker();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('avatarTitle')} back showBadges={false} />

      <View style={styles.content}>
        {/* Tappable avatar with a camera badge — the whole thing opens the picker. */}
        <Pressable style={styles.avatarWrap} onPress={pickPhoto} disabled={busy} accessibilityRole="button" accessibilityLabel={t('editAvatar')}>
          <View style={styles.avatarRing}>
            <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size={132} />
          </View>
          <View style={styles.cameraBadge}>
            {busy ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="camera" size={18} color={colors.white} />
            )}
          </View>
        </Pressable>

        {user?.fullName ? (
          <AppText variant="h3" center style={styles.name} numberOfLines={1}>{user.fullName}</AppText>
        ) : null}
        <AppText variant="caption" center color={colors.textSecondary} style={styles.hint}>
          {t('avatarHint')}
        </AppText>

        {error ? (
          <AppText variant="caption" color={colors.danger} center style={styles.error}>
            {error}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.actions, bounded]}>
        <Button
          label={t('chooseFromPhotos')}
          icon="image-outline"
          onPress={pickPhoto}
          disabled={busy}
        />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
  avatarWrap: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  // Soft ring + shadow framing the avatar so it reads as intentional, not bare.
  avatarRing: {
    padding: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...(elevation.sm as object),
  },
  cameraBadge: {
    position: 'absolute', right: 4, bottom: 4,
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.background,
  },
  name: { marginTop: spacing.lg },
  hint: { marginTop: spacing.xs, maxWidth: 280 },
  error: { marginTop: spacing.md },
  actions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
