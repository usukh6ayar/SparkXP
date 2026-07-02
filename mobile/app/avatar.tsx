import { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import { useAvatarPicker } from '../src/lib/useAvatarPicker';
import { t } from '../src/i18n';
import { AppText } from '../src/components/Text';
import { Avatar } from '../src/components/Avatar';
import { Button } from '../src/components/Button';
import { TopBar } from '../src/components/TopBar';
import { spacing, type AppColors } from '../src/theme/theme';
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
          onPress={pickPhoto}
          disabled={busy}
        />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  current: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  busy: { position: 'absolute', top: 48 },
  error: { marginBottom: spacing.sm },
  actions: { paddingHorizontal: spacing.lg },
});
