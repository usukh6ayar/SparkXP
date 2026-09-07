import { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingStep } from '../../../src/components/onboarding/OnboardingStep';
import { OnboardingFooter } from '../../../src/components/onboarding/OnboardingFooter';
import { AppText } from '../../../src/components/Text';
import { AuthFooter } from '../../../src/components/AuthFooter';
import { useAuth } from '../../../src/auth/AuthContext';
import { track } from '../../../src/lib/analytics';
import { useColors } from '../../../src/settings/SettingsContext';
import { t } from '../../../src/i18n';
import { spacing, type AppColors } from '../../../src/theme/theme';
import { ms, vs } from '../../../src/theme/responsive';

// The brand fox (transparent PNG, also the login hero) — the only real mascot
// art in the repo. The bespoke poses this flow was designed around are listed
// in assets/onboarding/HYBRID_ASSETS.md.
const fox = require('../../../assets/logo.webp');

/**
 * Step 1 — Welcome. Sells the app in one line and starts the flow; a returning
 * user can jump straight to sign-in.
 *
 * No progress bar here on purpose: a "1 / 7" on the very first screen reads as
 * "this will take a while" before the user has any reason to invest.
 */
export default function OnboardingWelcome() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { completeOnboarding } = useAuth();

  async function goSignIn() {
    // Leaving the flow for good — don't make a returning user walk it again.
    await completeOnboarding();
    router.replace('/(auth)/login?signin=1');
  }

  return (
    <OnboardingStep
      footer={
        <>
          <OnboardingFooter
            label={t('onbWelcomeCta')}
            onPress={() => {
              track('onboarding_started');
              router.push('/(auth)/onboarding/goal');
            }}
          />
          <AuthFooter prompt={t('haveAccount')} linkLabel={t('login')} onPress={goSignIn} />
        </>
      }
    >
      <View style={styles.hero}>
        {/* Soft concentric discs behind the mascot — a gentle glow rather than
            a hard shape, so the fox reads as lit instead of pasted on. */}
        <View pointerEvents="none" style={styles.glowWrap}>
          <View style={styles.glow3}>
            <View style={styles.glow2}>
              <View style={styles.glow1} />
            </View>
          </View>
        </View>
        <Image source={fox} style={styles.fox} resizeMode="contain" />
      </View>

      <View style={styles.copy}>
        <AppText variant="display" center style={styles.title}>
          {t('onbWelcomeTitle')}
        </AppText>
        <AppText variant="body" center color={c.textSecondary}>
          {t('onbWelcomeBody')}
        </AppText>
      </View>
    </OnboardingStep>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    hero: { alignItems: 'center', justifyContent: 'center', height: vs(300) },
    glowWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    glow3: {
      width: ms(300), height: ms(300), borderRadius: ms(150),
      backgroundColor: `${c.glow}0F`, // ~6% alpha
      alignItems: 'center', justifyContent: 'center',
    },
    glow2: {
      width: ms(210), height: ms(210), borderRadius: ms(105),
      backgroundColor: `${c.glow}17`, // ~9% alpha
      alignItems: 'center', justifyContent: 'center',
    },
    glow1: {
      width: ms(130), height: ms(130), borderRadius: ms(65),
      backgroundColor: c.primarySoft,
    },
    fox: { width: '100%', height: '100%' },
    copy: { gap: spacing.md, paddingHorizontal: spacing.sm },
    // Slightly tighter than the display default — the headline is two lines in
    // Mongolian and needs to hold together as one block.
    title: { lineHeight: 38 },
  });
