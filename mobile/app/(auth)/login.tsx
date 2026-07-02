import { useEffect, useState, useMemo } from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../../src/i18n';
import { spacing, radius, type AppColors } from '../../src/theme/theme';
import { useColors, useSettings } from '../../src/settings/SettingsContext';
import { AppText } from '../../src/components/Text';
import { SignInSheet } from '../../src/components/SignInSheet';
import { AuthFooter } from '../../src/components/AuthFooter';

const wordmark = require('../../assets/logoSparkXP.png');
const hero = require('../../assets/logo.png');

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Welcome / get-started screen — the first thing a logged-out user sees.
 * Email → register, social sign-up, and a "Log in" link that opens the sign-in
 * form as an in-place frosted-glass bottom sheet (no jump to a separate screen).
 */
export default function WelcomeScreen() {
  const colors = useColors();
  const { theme, setTheme } = useSettings();
  const isLight = theme === 'light';
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signin } = useLocalSearchParams<{ signin?: string }>();
  const [notice, setNotice] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Auto-open the sheet when arriving with ?signin=1 (from register/forgot).
  useEffect(() => {
    if (signin === '1') setSheetOpen(true);
  }, [signin]);

  const soon = () => setNotice(t('comingSoon'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Brand — wordmark on top, hero fills the space above the actions. */}
        <View style={styles.brand}>
          {/* Soft radial glow behind the logo (concentric discs → gentle falloff). */}
          <View pointerEvents="none" style={styles.glowWrap}>
            <View style={styles.glow3}>
              <View style={styles.glow2}>
                <View style={styles.glow1} />
              </View>
            </View>
          </View>
          {/* Decorative only — never intercept touches meant for the buttons below. */}
          <Image source={wordmark} style={styles.wordmark} resizeMode="contain" />
          <Image source={hero} style={styles.hero} resizeMode="contain" />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <AuthButton
            icon="mail"
            label={t('continueWithEmail')}
            filled
            onPress={() => router.push('/(auth)/register')}
          />
          <AuthButton icon="logo-google" label={t('continueWithGoogle')} onPress={soon} />
          <AuthButton icon="logo-apple" label={t('continueWithApple')} onPress={soon} />

          {notice ? (
            <AppText variant="caption" center color={colors.textSecondary} style={styles.notice}>
              {notice}
            </AppText>
          ) : null}

          <AuthFooter prompt={t('haveAccount')} linkLabel={t('login')} onPress={() => setSheetOpen(true)} />
        </View>
      </View>

      {/* Theme toggle — sits beside the SparkXP wordmark, top-right. Rendered
          LAST so it stays above the brand/actions for reliable single taps. */}
      <Pressable
        onPress={() => setTheme(isLight ? 'dark' : 'light')}
        hitSlop={12}
        style={[styles.themeToggle, { top: insets.top + 52 }]}
      >
        <Ionicons name={isLight ? 'moon' : 'sunny'} size={20} color={colors.text} />
      </Pressable>

      {sheetOpen ? <SignInSheet onClose={() => setSheetOpen(false)} /> : null}
    </SafeAreaView>
  );
}

/** A full-width auth button — gradient when `filled`, real frosted glass otherwise. */
function AuthButton({
  icon,
  label,
  filled = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  filled?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const { theme } = useSettings();
  const isLight = theme === 'light';
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Filled CTA is always white text on the purple gradient. The social buttons
  // are dark-ink on a light surface in light mode, white on glass in dark mode.
  const fg = filled || !isLight ? colors.white : colors.text;
  const content = (
    <View style={styles.btnContent}>
      <Ionicons name={icon} size={22} color={fg} />
      <AppText variant="bodyStrong" color={fg} style={styles.btnLabel}>
        {label}
      </AppText>
    </View>
  );

  if (filled) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <LinearGradient
          colors={colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btn, styles.btnFilled]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }
  // Light mode: a clean bordered surface button (glass is invisible on white).
  if (isLight) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.btn, styles.btnLight, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, styles.btnGlass, pressed && styles.pressed]}
    >
      <BlurView
        intensity={24}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.glassTint]} />
      {/* Glass top-edge highlight. */}
      <View style={styles.glassHighlight} />
      {content}
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  themeToggle: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 20,
    elevation: 20,
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  container: { flex: 1, paddingBottom: spacing.lg },
  brand: { flex: 1, alignItems: 'center', paddingTop: spacing.sm },
  glowWrap: { position: 'absolute', top: 10, left: 0, right: 0, alignItems: 'center' },
  glow3: {
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: `${colors.glow}0F`, // ~6% alpha
    alignItems: 'center', justifyContent: 'center',
  },
  glow2: {
    width: 210, height: 210, borderRadius: 105,
    backgroundColor: `${colors.glow}17`, // ~9% alpha
    alignItems: 'center', justifyContent: 'center',
  },
  glow1: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(124,59,255,0.16)',
  },
  wordmark: { width: '100%', height: 200, marginTop: -30, transform: [{ scale: 1.1 }], pointerEvents: 'none' },
  hero: { flex: 1, width: '100%', marginTop: -30, transform: [{ scale: 1.1 }], pointerEvents: 'none' },

  actions: { gap: spacing.md, paddingHorizontal: spacing.xl },
  btn: {
    height: 58,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  btnFilled: {
    // Soft violet glow on the primary CTA.
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btnGlass: { borderWidth: 1, borderColor: colors.glassBorder },
  btnLight: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  glassTint: { backgroundColor: colors.glassBg },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  btnContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btnLabel: { fontWeight: '700' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  notice: { marginTop: spacing.xs },
});
