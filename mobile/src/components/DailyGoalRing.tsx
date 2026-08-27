import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { AppText } from './Text';
import { ProgressRing } from './ProgressRing';
import { useColors } from '../settings/SettingsContext';
import { progressGradients } from '../theme/theme';

/**
 * Today's XP against the student's chosen daily target, as a ring.
 *
 * This used to be a full-width strip (`DailyGoalCard`) sitting under "continue
 * learning" — a whole row of the page spent on two numbers, competing with the
 * feature cards around it. Then it became a labelled capsule under the streak,
 * which was still a wide bar for one fraction. Now it is just the dial: the arc
 * IS the message, with today's XP inside it, so the whole stat is a small round
 * badge the caller can drop anywhere (see Home's `goalDial`).
 *
 * Both numbers come from `GET /gamification` (`todayXp` / `dailyGoal`), which
 * sums `XpLog.created_at` for today — there is no separate counter to keep in
 * sync.
 */
export function DailyGoalRing({
  todayXp,
  dailyGoal,
  size = 26,
  stroke = 4,
  /** Unfilled part of the ring. Pass a light value when it sits on artwork. */
  track,
  /** Today's XP in the middle. Off for a decorative ring with no room for text. */
  showValue = false,
  /** Text/checkmark colour — white on the hero artwork, `text` on a surface. */
  valueColor,
}: {
  todayXp: number;
  dailyGoal: number;
  size?: number;
  stroke?: number;
  track?: string;
  showValue?: boolean;
  valueColor?: string;
}) {
  const c = useColors();
  // Guard against a 0 goal so the ring never divides by zero.
  const progress = dailyGoal > 0 ? todayXp / dailyGoal : 0;
  const done = todayXp >= dailyGoal;

  return (
    <ProgressRing
      progress={progress}
      size={size}
      stroke={stroke}
      gradient={done ? progressGradients.success : progressGradients.xp}
      track={track ?? c.surfaceAlt}
    >
      {done ? (
        <Ionicons name="checkmark" size={Math.round(size * 0.52)} color={c.success} />
      ) : showValue ? (
        // Shrinks rather than clips: a three-digit day (120 XP) has to fit the
        // same hole as a one-digit one.
        <AppText
          variant="label"
          color={valueColor ?? c.text}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[styles.value, { maxWidth: size - stroke * 2 - 4 }]}
        >
          {todayXp}
        </AppText>
      ) : null}
    </ProgressRing>
  );
}

const styles = StyleSheet.create({
  value: { textAlign: 'center' },
});
