import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OnboardingStep } from '../../../src/components/onboarding/OnboardingStep';
import { AppText } from '../../../src/components/Text';
import { PressableScale } from '../../../src/components/PressableScale';
import { useAuth } from '../../../src/auth/AuthContext';
import { ONBOARDING_TOTAL_STEPS } from '../../../src/lib/onboardingAnswers';
import { useOncePress } from '../../../src/lib/useOncePress';
import { track } from '../../../src/lib/analytics';
import { useColors, useSettings, useT } from '../../../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Step 7 — the exit. Every route out of onboarding goes through here, and each
 * one marks onboarding finished first so the auth gate never drops the user
 * back at the welcome screen.
 *
 * Google and Apple sign-in are NOT implemented in this app, so they show the
 * same "coming soon" notice the welcome screen uses. Faking a success here
 * would strand the user with no session and no way to tell why.
 */
export default function OnboardingAccount() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);

  // `replace`, not `push`: onboarding is done, and back from registration
  // should leave the app rather than re-enter the flow.
  const leave = useOncePress(async (href: Href, exit: string) => {
    // Which door they left by is the whole point of this screen's metrics:
    // register vs guest vs existing-account tells us if the flow is converting.
    track('onboarding_finished', { exit });
    await completeOnboarding();
    router.replace(href);
  });

  const soon = () => setNotice(t('comingSoon'));

  return (
    <OnboardingStep
      step={ONBOARDING_TOTAL_STEPS}
      total={ONBOARDING_TOTAL_STEPS}
      onBack={() => router.back()}
      title={t('onbAccountTitle')}
      subtitle={t('onbAccountBody')}
      footer={null}
    >
      <View style={styles.actions}>
        <AuthOption icon="logo-google" label={t('continueWithGoogle')} onPress={soon} />
        <AuthOption icon="logo-apple" label={t('continueWithApple')} onPress={soon} />
        {/* The one that actually works — filled so it reads as the main path.
            Registration is email + password (there is no phone sign-up). */}
        <AuthOption
          icon="mail"
          label={t('continueWithEmail')}
          filled
          onPress={() => leave('/(auth)/register', 'register')}
        />

        {notice ? (
          <AppText variant="caption" center color={c.textSecondary}>
            {notice}
          </AppText>
        ) : null}
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.rule} />
        <AppText variant="caption">{t('onbOr')}</AppText>
        <View style={styles.rule} />
      </View>

      <View style={styles.secondaryActions}>
        {/* Guest: the pre-signup taste-task is the app's guest-safe surface —
            it needs no token and ends by offering registration. */}
        <AuthOption icon="play-circle" label={t('onbAccountGuest')} onPress={() => leave('/(auth)/taste', 'guest')} />
        <AuthOption icon="log-in" label={t('login')} onPress={() => leave('/(auth)/login?signin=1', 'login')} />
      </View>
    </OnboardingStep>
  );
}

/** Full-width option row — gradient when `filled`, bordered surface otherwise. */
function AuthOption({
  icon,
  label,
  filled,
  onPress,
}: {
  icon: IconName;
  label: string;
  filled?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const { theme } = useSettings();
  const styles = useMemo(() => makeStyles(c), [c]);
  // White ink on the gradient; otherwise the theme's own ink. Apple's mark has
  // no brand colour of its own, so it follows the label.
  const fg = filled ? c.white : c.text;

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      style={[styles.option, !filled && styles.optionOutline]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {filled ? (
        <LinearGradient
          colors={c.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.fill]}
        />
      ) : null}
      <Ionicons
        name={icon}
        size={20}
        color={icon === 'logo-google' && theme === 'light' ? '#EA4335' : fg}
      />
      <AppText variant="bodyStrong" color={fg}>{label}</AppText>
    </PressableScale>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    actions: { gap: spacing.md },
    secondaryActions: { gap: spacing.md },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
    },
    optionOutline: {
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    fill: { borderRadius: radius.md },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rule: { flex: 1, height: 1, backgroundColor: c.border },
  });
