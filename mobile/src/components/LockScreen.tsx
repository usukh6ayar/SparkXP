import { useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useColors } from '../settings/SettingsContext';
import { t } from '../i18n';
import { AppText } from './Text';
import { Button } from './Button';
import { spacing, radius, type AppColors } from '../theme/theme';

/**
 * Full-screen biometric lock. Rendered on top of everything (see app/_layout)
 * whenever the session is locked, so app content stays hidden until Face ID /
 * fingerprint succeeds. Auto-prompts on mount; offers a manual retry and a
 * "log in with password" escape hatch (which signs out → login screen).
 */
export function LockScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { runBiometricUnlock, logout } = useAuth();

  // Prompt as soon as the lock appears (cold start / re-lock on resume is driven
  // from AuthContext's AppState listener).
  useEffect(() => { runBiometricUnlock(); }, [runBiometricUnlock]);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={44} color={c.primary} />
        </View>
        <AppText variant="h2" center style={styles.title}>{t('lockTitle')}</AppText>
        <AppText variant="body" center color={c.textSecondary} style={styles.subtitle}>
          {t('lockSubtitle')}
        </AppText>
        <Button
          label={t('lockUnlock')}
          icon="finger-print"
          onPress={runBiometricUnlock}
          style={styles.unlockBtn}
        />
        <Pressable onPress={logout} hitSlop={8} style={styles.passwordBtn}>
          <AppText variant="bodyStrong" color={c.primary}>{t('lockUsePassword')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  // Opaque full-screen cover — also hides content in the app switcher.
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  center: { alignItems: 'center', paddingHorizontal: spacing.xl, width: '100%', maxWidth: 420 },
  iconCircle: {
    width: 96, height: 96, borderRadius: radius.full, backgroundColor: c.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  title: { marginBottom: spacing.sm },
  subtitle: { marginBottom: spacing.xxl },
  unlockBtn: { alignSelf: 'stretch' },
  passwordBtn: { marginTop: spacing.lg, padding: spacing.sm },
});
