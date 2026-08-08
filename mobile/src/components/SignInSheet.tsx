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
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { haptics } from '../lib/haptics';
import { shake, useReduceMotion } from '../lib/motion';
import { saveCredentials, clearCredentials, type SavedCredentials } from '../lib/savedCredentials';
import { isBiometricAvailable, authenticateBiometric } from '../auth/biometrics';
import { t } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';
import { useColors, useSettings } from '../settings/SettingsContext';
import { AppText } from './Text';
import { TextField } from './TextField';
import { Checkbox } from './Checkbox';
import { SocialRow } from './SocialRow';
import { FormError } from './FormError';
import { AuthFooter } from './AuthFooter';

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
export function SignInSheet({
  onClose,
  initial,
}: {
  onClose: () => void;
  /** Saved "remember me" credentials, loaded by the parent before mount. */
  initial?: SavedCredentials | null;
}) {
  const colors = useColors();
  const { theme } = useSettings();
  const styles = useMemo(() => makeStyles(colors, theme === 'light'), [colors, theme]);
  const { login } = useAuth();
  const router = useRouter();
  const ref = useRef<BottomSheetModal>(null);
  // Open tall enough that the whole form + social buttons + footer are visible
  // without scrolling. 45% cut the Google/Apple/Facebook row off the bottom.
  const snapPoints = useMemo(() => ['70%', '95%'], []);

  // Inputs are UNCONTROLLED (defaultValue + onChangeText, no `value`): a
  // controlled `value` on @gorhom's BottomSheetTextInput duplicates characters
  // on Android. State still tracks the text for submit; seeded from `initial`.
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Biometric unlock is offered only when creds are saved AND a face/finger is enrolled.
  const [bioAvailable, setBioAvailable] = useState(false);
  // Guards the one-shot auto Face ID prompt (see the effect below).
  const autoPromptedRef = useRef(false);
  const reduce = useReduceMotion();

  // Shake + error haptic when sign-in fails.
  const shakeX = useSharedValue(0);
  const formStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const fail = (msg: string) => {
    setError(msg);
    haptics.error();
    if (!reduce) shakeX.value = shake();
  };

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

  // Offer biometric unlock only if we have saved creds to unlock with — and go
  // straight to the prompt instead of making a returning user tap first.
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    isBiometricAvailable().then((ok) => {
      if (cancelled) return;
      setBioAvailable(ok);
      // Auto-prompt once per sheet open. If the user cancels, the button is
      // still there for a manual retry — re-prompting on its own would trap
      // them in a loop they can't dismiss to reach the password fields.
      if (ok && !autoPromptedRef.current) {
        autoPromptedRef.current = true;
        void onBiometric();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const close = useCallback(() => ref.current?.dismiss(), []);

  // Backdrop: real blur + dim that fades in as the sheet rises, tap to close.
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <GlassBackdrop {...props} onPress={close} />,
    [close],
  );

  /**
   * An account that never finished its email OTP can't sign in (the backend
   * refuses with `EMAIL_NOT_VERIFIED`). Showing the error here would strand
   * the user — the code is the only way forward — so hand them to the OTP step
   * with the address filled in.
   *
   * Matched on `code`, never on the message: the message is user-facing
   * Mongolian and would stop matching the moment it is reworded.
   */
  function handleLoginError(e: unknown): void {
    if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
      close();
      router.push({
        pathname: '/(auth)/register',
        params: { verifyEmail: e.email ?? username.trim() },
      });
      return;
    }
    fail(e instanceof ApiError ? e.message : t('errorGeneric'));
  }

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password); // auth gate redirects on success
      // Persist / forget for next time (fire-and-forget: the gate is redirecting).
      const persist = remember
        ? saveCredentials(username.trim(), password)
        : clearCredentials();
      persist.catch(() => {});
    } catch (e) {
      handleLoginError(e);
    } finally {
      setBusy(false);
    }
  }

  // Face ID / fingerprint → unlock the saved creds and sign in.
  async function onBiometric() {
    if (!initial) return;
    setError(null);
    // `authenticateBiometric` swallows hardware errors and returns false, so a
    // quirky device silently falls back to typing rather than throwing here.
    const ok = await authenticateBiometric(t('biometricPrompt'));
    if (!ok) return; // user cancelled or scan failed
    setBusy(true);
    try {
      await login(initial.username, initial.password);
    } catch (e) {
      handleLoginError(e);
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

        <Animated.View style={formStyle}>
          <TextField
            InputComponent={BottomSheetTextInput}
            leftIcon="person-outline"
            label={t('usernameOrEmail')}
            autoCapitalize="none"
            autoCorrect={false}
            defaultValue={initial?.username}
            onChangeText={setUsername}
          />
          <TextField
            InputComponent={BottomSheetTextInput}
            leftIcon="lock-closed-outline"
            label={t('password')}
            secureToggle
            defaultValue={initial?.password}
            onChangeText={setPassword}
          />
        </Animated.View>

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

        {/* Biometric unlock — only when creds are saved and a face/finger is enrolled. */}
        {bioAvailable ? (
          <Pressable onPress={onBiometric} disabled={busy} style={({ pressed }) => [styles.bioBtn, pressed && styles.pressed]}>
            <Ionicons name="finger-print" size={22} color={colors.primary} />
            <AppText variant="bodyStrong" color={colors.primary}>{t('biometricLogin')}</AppText>
          </Pressable>
        ) : null}

        <View style={styles.divider}>
          <View style={styles.line} />
          <AppText variant="caption" color={colors.textMuted}>
            {t('orDivider')}
          </AppText>
          <View style={styles.line} />
        </View>
        <SocialRow onPress={soon} />

        <AuthFooter prompt={t('noAccount')} linkLabel={t('register')} onPress={goRegister} />
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
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginTop: spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  line: { flex: 1, height: 1, backgroundColor: isLight ? colors.border : colors.glassBorder },
});
