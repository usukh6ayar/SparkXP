import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import Animated, { interpolate, useAnimatedStyle, Extrapolation } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { t } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';
import { useColors, useSettings } from '../settings/SettingsContext';
import { AppText } from './Text';
import { TextField } from './TextField';
import { Checkbox } from './Checkbox';
import { SocialRow } from './SocialRow';
import { FormError } from './FormError';

/** Frosted-glass sheet background (blurs the welcome content behind it). */
function GlassBackground({ style }: BottomSheetBackgroundProps) {
  const colors = useColors();
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const styles = useMemo(() => makeStyles(colors, isLight), [colors, isLight]);
  return (
    <View style={[style, styles.sheetBg]}>
      <BlurView
        intensity={50}
        tint={isLight ? 'light' : 'dark'}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.sheetTint]} />
      <View style={styles.sheetHighlight} />
    </View>
  );
}

/**
 * Sign-in as a draggable @gorhom bottom sheet with 45% / 70% / 92% snap points.
 * The fox + logo stay fixed behind; the backdrop blurs & dims (fading with the
 * sheet position). Opened in place from the welcome screen — no screen jump.
 */
export function SignInSheet({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const { theme } = useSettings();
  const styles = useMemo(() => makeStyles(colors, theme === 'light'), [colors, theme]);
  const { login } = useAuth();
  const router = useRouter();
  const ref = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['45%', '70%', '92%'], []);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Smooth spring motion for snapping + finger release.
  const springConfigs = useBottomSheetSpringConfigs({
    damping: 50,
    stiffness: 420,
    mass: 1,
    overshootClamping: false,
  });

  // Present on mount — the parent only renders this component while open, so
  // there is never a lingering (touch-capturing) sheet on the welcome screen.
  useEffect(() => {
    ref.current?.present();
  }, []);

  const close = useCallback(() => ref.current?.dismiss(), []);

  // Backdrop: real blur + dim that fades in as the sheet rises, tap to close.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <GlassBackdrop {...props} onPress={close} />,
    [close],
  );

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password); // auth gate redirects on success
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const soon = () => setError(t('comingSoon'));
  const goForgot = () => {
    close();
    router.push('/(auth)/forgot');
  };
  const goRegister = () => {
    close();
    router.push('/(auth)/register');
  };

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={onClose}
      animationConfigs={springConfigs}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassBackground}
      handleIndicatorStyle={styles.handleIndicator}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="h2" center style={styles.title}>
          {t('welcomeBack')}
        </AppText>

        <TextField
          InputComponent={BottomSheetTextInput}
          leftIcon="person-outline"
          placeholder={t('usernameOrEmail')}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <TextField
          InputComponent={BottomSheetTextInput}
          leftIcon="lock-closed-outline"
          placeholder={t('password')}
          secureToggle
          value={password}
          onChangeText={setPassword}
        />

        <View style={styles.row}>
          <Checkbox checked={remember} onToggle={() => setRemember((v) => !v)} label={t('rememberMe')} />
          <Pressable onPress={goForgot} hitSlop={6}>
            <AppText variant="caption" color={colors.primary}>
              {t('forgotPassword')}
            </AppText>
          </Pressable>
        </View>

        <FormError message={error} />

        {/* Gradient CTA */}
        <Pressable onPress={onSubmit} disabled={busy} style={({ pressed }) => pressed && styles.pressed}>
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={styles.ctaContent}>
                <AppText variant="bodyStrong" color={colors.white} style={styles.ctaLabel}>
                  {t('login')}
                </AppText>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </View>
            )}
          </LinearGradient>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.line} />
          <AppText variant="caption" color={colors.textMuted}>
            {t('orDivider')}
          </AppText>
          <View style={styles.line} />
        </View>
        <SocialRow onPress={soon} />

        <View style={styles.footer}>
          <AppText variant="body" color={colors.textSecondary}>
            {t('noAccount')}{' '}
          </AppText>
          <Pressable onPress={goRegister} hitSlop={8}>
            <AppText variant="bodyStrong" color={colors.primary}>
              {t('register')}
            </AppText>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

/** Blur + dim backdrop whose opacity tracks the sheet position; tap to close. */
function GlassBackdrop({
  animatedIndex,
  style,
  onPress,
}: BottomSheetBackdropProps & { onPress: () => void }) {
  const colors = useColors();
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const styles = useMemo(() => makeStyles(colors, isLight), [colors, isLight]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [-1, 0], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
        <BlurView
          intensity={26}
          tint={isLight ? 'light' : 'dark'}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: AppColors, isLight: boolean) => StyleSheet.create({
  dim: { backgroundColor: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(10,6,26,0.35)' },
  sheetBg: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: isLight ? colors.border : colors.glassBorder,
    backgroundColor: isLight ? colors.surface : 'transparent',
    overflow: 'hidden',
  },
  sheetTint: { backgroundColor: isLight ? 'transparent' : colors.glassBgStrong },
  sheetHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: isLight ? 'transparent' : 'rgba(255,255,255,0.28)',
  },
  handleIndicator: { backgroundColor: isLight ? colors.borderStrong : 'rgba(255,255,255,0.4)', width: 48 },

  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  title: { marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  cta: {
    height: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ctaContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ctaLabel: { fontWeight: '700' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  line: { flex: 1, height: 1, backgroundColor: isLight ? colors.border : colors.glassBorder },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
});
