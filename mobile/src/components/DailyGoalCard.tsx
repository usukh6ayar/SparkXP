import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { AppIcon } from './AppIcon';
import { ProgressRing } from './ProgressRing';
import { PressableScale } from './PressableScale';
import { useColors } from '../settings/SettingsContext';
import { t, tf } from '../i18n';
import { spacing, radius, progressGradients, type AppColors } from '../theme/theme';

/**
 * Today's XP against the student's chosen daily target — an Apple Fitness style
 * ring, so progress reads at a glance instead of as a number to parse.
 *
 * Both numbers come from `GET /gamification` (`todayXp` / `dailyGoal`), which
 * sums `XpLog.created_at` for today — there is no separate counter to keep in
 * sync. Tapping opens the goal picker.
 */
export function DailyGoalCard({
  todayXp,
  dailyGoal,
  onPress,
  style,
}: {
  todayXp: number;
  dailyGoal: number;
  onPress: () => void;
  /** Outer spacing. The screen owns it, like every other card on Home. */
  style?: ViewStyle;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Guard against a 0 goal so the ring never divides by zero.
  const progress = dailyGoal > 0 ? todayXp / dailyGoal : 0;
  const done = todayXp >= dailyGoal;
  const remaining = Math.max(0, dailyGoal - todayXp);

  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, style]}
      accessibilityLabel={tf('dailyGoalProgress', { done: todayXp, goal: dailyGoal })}
    >
      <ProgressRing
        progress={progress}
        size={56}
        stroke={7}
        gradient={done ? progressGradients.success : progressGradients.xp}
        track={c.surfaceAlt}
      >
        {done ? (
          <Ionicons name="checkmark" size={22} color={c.success} />
        ) : (
          <AppIcon name="xp" size={22} />
        )}
      </ProgressRing>

      <View style={styles.copy}>
        <AppText variant="overline" color={c.textMuted}>
          {t('dailyGoalTitle').toUpperCase()}
        </AppText>
        <AppText variant="h3" color={c.text}>
          {tf('dailyGoalProgress', { done: todayXp, goal: dailyGoal })}
        </AppText>
        <AppText variant="caption" color={done ? c.success : c.textSecondary}>
          {done ? t('dailyGoalDone') : tf('dailyGoalRemaining', { n: remaining })}
        </AppText>
      </View>

      {/* Affordance that the goal itself is editable — without it the card
          reads as a static stat and nobody discovers the picker. */}
      <View style={styles.editHint}>
        <Ionicons name="options-outline" size={18} color={c.textMuted} />
      </View>
    </PressableScale>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    // Slim by design: this is a status strip, not a feature card — it sits
    // between "continue learning" and the next-step tiles and should not
    // out-weigh either. Outer spacing comes from the screen (`style`), so the
    // margins of two neighbours can never stack into a visible hole.
    //
    // The border is not decoration: without it this white strip landed flush
    // under the glowing purple "continue" card and the two read as one merged
    // block. It now matches the review/join cards below it.
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    copy: { flex: 1, gap: 0 },
    editHint: { alignSelf: 'flex-start' },
  });
