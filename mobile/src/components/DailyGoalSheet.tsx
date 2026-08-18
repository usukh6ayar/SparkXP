import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { PressableScale } from './PressableScale';
import { SheetModal } from './SheetModal';
import { useColors } from '../settings/SettingsContext';
import { useAuth } from '../auth/AuthContext';
import { haptics } from '../lib/haptics';
import { alertError } from '../lib/alerts';
import {
  DAILY_GOAL_CHOICES,
  goalTier,
  setDailyGoal,
  type DailyGoal,
  type Gamification,
} from '../api/gamification';
import { ApiError } from '../api/client';
import { t, tf, type TranslationKey } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';

/** Label + one-line "who this is for" per goal, in DAILY_GOAL_CHOICES order. */
const GOAL_COPY: Record<DailyGoal, { labelKey: TranslationKey; hintKey: TranslationKey }> = {
  30: { labelKey: 'goalEasy', hintKey: 'goalEasyHint' },
  80: { labelKey: 'goalMedium', hintKey: 'goalMediumHint' },
  200: { labelKey: 'goalHard', hintKey: 'goalHardHint' },
};

/**
 * Daily XP goal picker (Сэргээх 30 / Тогтмол 80 / Эрчтэй 200).
 *
 * The three values are the only ones the picker offers, so they come from
 * `DAILY_GOAL_CHOICES` rather than being retyped here. Saving returns the
 * refreshed gamification summary, which the caller uses directly — no refetch.
 *
 * A user who set their goal on an older build still holds a legacy number
 * (20 / 50 / 100). `goalTier` maps that onto the row that replaced it so one
 * row is still shown as selected, and the sheet states their real current goal
 * above the list rather than pretending the tier's number is theirs.
 */
export function DailyGoalSheet({
  visible,
  current,
  onClose,
  onSaved,
}: {
  visible: boolean;
  /** The goal currently in effect, so it can be shown as selected. */
  current: number;
  onClose: () => void;
  onSaved: (next: Gamification) => void;
}) {
  const c = useColors();
  const { token } = useAuth();
  const [saving, setSaving] = useState<DailyGoal | null>(null);
  const tier = goalTier(current);

  async function choose(goal: DailyGoal) {
    if (!token || saving) return;
    // Picking the goal already in effect is a no-op, not a wasted request.
    if (goal === current) {
      onClose();
      return;
    }
    setSaving(goal);
    try {
      const next = await setDailyGoal(goal, token);
      haptics.success();
      onSaved(next);
      onClose();
    } catch (e) {
      alertError(e instanceof ApiError ? e.message : t('errorFallback'));
    } finally {
      setSaving(null);
    }
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <AppText variant="h2" center style={styles.title}>
        {t('dailyGoalPickTitle')}
      </AppText>
      <AppText variant="body" color={c.textSecondary} center style={styles.subtitle}>
        {t('dailyGoalPickSubtitle')}
      </AppText>

      {/* Only when their goal isn't exactly a tier — i.e. it was set on an
          older build, so the selected row is an approximation. */}
      {current > 0 && current !== tier && (
        <AppText variant="caption" color={c.textMuted} center style={styles.subtitle}>
          {tf('dailyGoalCurrentLegacy', { n: current })}
        </AppText>
      )}

      {DAILY_GOAL_CHOICES.map((goal) => (
        <GoalRow
          key={goal}
          goal={goal}
          selected={goal === tier}
          busy={saving === goal}
          disabled={saving !== null}
          onPress={() => choose(goal)}
          colors={c}
        />
      ))}
    </SheetModal>
  );
}

function GoalRow({
  goal,
  selected,
  busy,
  disabled,
  onPress,
  colors: c,
}: {
  goal: DailyGoal;
  selected: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: AppColors;
}) {
  const copy = GOAL_COPY[goal];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        rowStyles.row,
        { backgroundColor: c.surfaceAlt, borderColor: selected ? c.primary : 'transparent' },
        disabled && !busy && rowStyles.dimmed,
      ]}
    >
      <View style={rowStyles.textCol}>
        <AppText variant="bodyStrong" color={c.text}>
          {t(copy.labelKey)} · {tf('dailyGoalXpValue', { n: goal })}
        </AppText>
        <AppText variant="caption" color={c.textSecondary}>
          {t(copy.hintKey)}
        </AppText>
      </View>
      <Ionicons
        name={busy ? 'ellipsis-horizontal' : selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? c.primary : c.textMuted}
      />
    </PressableScale>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  dimmed: { opacity: 0.5 },
  textCol: { flex: 1 },
});

const styles = StyleSheet.create({
  title: { marginBottom: 4 },
  subtitle: { marginBottom: spacing.sm },
});
