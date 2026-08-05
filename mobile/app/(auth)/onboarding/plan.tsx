import { useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStep } from '../../../src/components/onboarding/OnboardingStep';
import { OnboardingFooter } from '../../../src/components/onboarding/OnboardingFooter';
import { useOnboardingAnswers } from '../../../src/components/onboarding/OnboardingAnswersProvider';
import { AppText } from '../../../src/components/Text';
import { ONBOARDING_TOTAL_STEPS, type LearningGoal } from '../../../src/lib/onboardingAnswers';
import { weeklyPlan, type PlanSkill } from '../../../src/lib/onboardingPlan';
import { CEFR_LEVELS } from '../../../src/constants/levels';
import { useColors, useT } from '../../../src/settings/SettingsContext';
import { tf, type TranslationKey } from '../../../src/i18n';
import { spacing, radius, type AppColors } from '../../../src/theme/theme';
import { ms } from '../../../src/theme/responsive';

const fox = require('../../../assets/logo.webp');

/** Short "what you're aiming at" phrasing per goal, for the summary rows. */
const GOAL_SUMMARY: Record<LearningGoal, TranslationKey> = {
  daily: 'onbGoalSumDaily',
  career: 'onbGoalSumCareer',
  travel: 'onbGoalSumTravel',
  exam: 'onbGoalSumExam',
  abroad: 'onbGoalSumAbroad',
};

const SKILL_ICON: Record<PlanSkill, keyof typeof Ionicons.glyphMap> = {
  speaking: 'mic',
  vocabulary: 'library',
  listening: 'headset',
  grammar: 'construct',
};

/**
 * Step 6 — the payoff: the four answers played back as a plan.
 *
 * The weekly mix is a pure frontend mapping (`weeklyPlan`), not a server
 * recommendation — there is no account to build one against yet. It exists so
 * the previous four screens visibly meant something.
 */
export default function OnboardingPlan() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const t = useT();
  const router = useRouter();
  const { answers } = useOnboardingAnswers();

  const rows = weeklyPlan(answers.goal, answers.level);
  const level = CEFR_LEVELS.find((lv) => lv.value === answers.level);

  return (
    <OnboardingStep
      step={6}
      total={ONBOARDING_TOTAL_STEPS}
      onBack={() => router.back()}
      footer={
        <OnboardingFooter
          label={t('onbPlanCta')}
          onPress={() => router.push('/(auth)/onboarding/account')}
        />
      }
    >
      <View style={styles.hero}>
        <Image source={fox} style={styles.fox} resizeMode="contain" />
        <AppText variant="h1" center>{t('onbPlanTitle')}</AppText>
      </View>

      {/* What we heard. */}
      <View style={styles.summary}>
        <SummaryRow
          icon="podium"
          label={t('onbPlanLevelLabel')}
          value={level ? `${level.code} — ${t(level.labelKey)}` : t('onbPlanLevelUnknown')}
        />
        <SummaryRow
          icon="flag"
          label={t('onbPlanGoalLabel')}
          value={answers.goal ? t(GOAL_SUMMARY[answers.goal]) : t('onbPlanGoalAny')}
        />
        <SummaryRow
          icon="time"
          label={t('onbPlanMinutesLabel')}
          value={`${answers.dailyMinutes} ${t('onbMinutesUnit')}`}
        />
      </View>

      {/* What that turns into. */}
      <View style={styles.week}>
        <AppText variant="overline">{t('onbPlanWeekTitle')}</AppText>
        {rows.map((row) => (
          <View key={row.skill} style={styles.weekRow}>
            <View style={styles.weekIcon}>
              <Ionicons name={SKILL_ICON[row.skill]} size={18} color={c.primary} />
            </View>
            <AppText variant="bodyStrong" style={styles.weekName}>{t(row.labelKey)}</AppText>
            <AppText variant="body" color={c.textSecondary}>
              {tf('onbPlanLessons', { n: row.lessons })}
            </AppText>
          </View>
        ))}
      </View>
    </OnboardingStep>
  );
}

/** One "label → value" line of the answers summary. */
function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={c.textMuted} />
      <AppText variant="body" color={c.textSecondary} style={styles.summaryLabel}>{label}</AppText>
      <AppText variant="bodyStrong" style={styles.summaryValue} numberOfLines={2}>{value}</AppText>
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    hero: { alignItems: 'center', gap: spacing.md },
    fox: { width: ms(180), height: ms(150) },

    summary: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: c.surfaceAlt,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    summaryLabel: { flexShrink: 0 },
    // Takes the remaining width and right-aligns, so the values line up as a
    // column however long the labels are.
    summaryValue: { flex: 1, textAlign: 'right' },

    week: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    weekIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    weekName: { flex: 1 },
  });
