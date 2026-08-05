import { useMemo, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStep } from '../../../src/components/onboarding/OnboardingStep';
import { OnboardingFooter } from '../../../src/components/onboarding/OnboardingFooter';
import { OnboardingRewardCard } from '../../../src/components/onboarding/OnboardingRewardCard';
import { useOnboardingAnswers } from '../../../src/components/onboarding/OnboardingAnswersProvider';
import { AppText } from '../../../src/components/Text';
import { PressableScale } from '../../../src/components/PressableScale';
import { ONBOARDING_TOTAL_STEPS } from '../../../src/lib/onboardingAnswers';
import { markTasteCompleted, ONBOARDING_BONUS_XP } from '../../../src/lib/tasteTask';
import { haptics } from '../../../src/lib/haptics';
import { track } from '../../../src/lib/analytics';
import { useColors, useT } from '../../../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../../../src/theme/theme';
import { ms } from '../../../src/theme/responsive';

const buddy = require('../../../assets/buddy-menu.webp');

/**
 * Step 5 — the AI-buddy demo: the first moment the app does something *for* the
 * user rather than asking them something.
 *
 * **This exchange is scripted on the device, not generated.** Every `/ai/*`
 * endpoint needs a JWT and there is no account yet, so a live call could only
 * fail — and an onboarding flow that can break on a bad network is worse than
 * one that is honest about being a demo. The screen is labelled as an example
 * and never claims to have heard or transcribed the user.
 *
 * Speaking is likewise NOT wired here: CLAUDE.md's MVP rule is "design the
 * voice UI but show coming soon", so the mic shows the same notice the welcome
 * screen's social buttons do.
 */
export default function OnboardingBuddy() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const router = useRouter();
  const { answers, update } = useOnboardingAnswers();

  const [answered, setAnswered] = useState(answers.completedBuddyDemo);
  const [notice, setNotice] = useState<string | null>(null);

  function pickDemoAnswer() {
    haptics.success();
    setNotice(null);
    setAnswered(true);
    update({ completedBuddyDemo: true, earnedDemoXp: ONBOARDING_BONUS_XP });
    track('onboarding_buddy_demo_completed');
    // Same flag the pre-signup taste-task sets — it is what makes registration
    // send `tasteCompleted`, so the XP promised below is actually granted.
    markTasteCompleted();
  }

  const next = () => router.push('/(auth)/onboarding/plan');

  return (
    <OnboardingStep
      step={5}
      total={ONBOARDING_TOTAL_STEPS}
      onBack={() => router.back()}
      title={t('onbBuddyTitle')}
      subtitle={t('onbBuddyBody')}
      footer={
        <OnboardingFooter
          label={t('continue')}
          onPress={next}
          disabled={!answered}
          secondaryLabel={t('skip')}
          onSecondary={next}
        />
      }
    >
      {/* The buddy asks. */}
      <View style={styles.ask}>
        <Image source={buddy} style={styles.avatar} resizeMode="contain" />
        <View style={styles.bubble}>
          <AppText variant="bodyStrong">{t('onbBuddyQuestion')}</AppText>
        </View>
      </View>

      {answered ? (
        <>
          <View style={styles.feedback}>
            <View style={styles.chip}>
              <AppText variant="caption" color={c.textSecondary}>{t('onbBuddySample')}</AppText>
            </View>

            <Line
              label={t('onbBuddyOriginal')}
              text={t('onbBuddyDemoAnswer')}
              accent={c.danger}
            />
            <Line
              label={t('onbBuddyImproved')}
              text={t('onbBuddyImprovedText')}
              accent={c.success}
            />

            <View style={styles.explain}>
              <Ionicons name="bulb" size={16} color={c.xp} />
              <AppText variant="caption" color={c.textSecondary} style={styles.explainText}>
                {t('onbBuddyExplain')}
              </AppText>
            </View>
          </View>

          <OnboardingRewardCard xp={ONBOARDING_BONUS_XP} note={t('onbRewardNote')} />
        </>
      ) : (
        <View style={styles.actions}>
          <Action
            icon="mic"
            label={t('onbBuddyMic')}
            onPress={() => setNotice(t('comingSoon'))}
          />
          <Action
            icon="chatbubble-ellipses"
            label={t('onbBuddyPick')}
            primary
            onPress={pickDemoAnswer}
          />
          {notice ? (
            <AppText variant="caption" center color={c.textSecondary}>
              {notice}
            </AppText>
          ) : null}
        </View>
      )}
    </OnboardingStep>
  );
}

/** One "before / after" row of the correction card. */
function Line({ label, text, accent }: { label: string; text: string; accent: string }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.line, { borderLeftColor: accent }]}>
      <AppText variant="overline">{label}</AppText>
      <AppText variant="body">{text}</AppText>
    </View>
  );
}

/** One of the two ways to answer the buddy. */
function Action({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const fg = primary ? c.primary : c.text;
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      style={[styles.action, primary && styles.actionPrimary]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <AppText variant="bodyStrong" color={fg}>{label}</AppText>
    </PressableScale>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    ask: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: { width: ms(76), height: ms(76) },
    bubble: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.lg,
      // Square the corner nearest the avatar so the panel reads as speech.
      borderBottomLeftRadius: radius.sm,
      backgroundColor: c.surfaceAlt,
    },

    actions: { gap: spacing.md },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    actionPrimary: { borderColor: c.primary, backgroundColor: c.primarySoft },

    feedback: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    chip: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
    },
    line: { gap: 2, paddingLeft: spacing.md, borderLeftWidth: 3 },
    explain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    explainText: { flex: 1 },
  });
