import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { useColors } from '../../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../../theme/theme';
import { tf } from '../../i18n';

/**
 * The XP reward banner shown after the AI-buddy demo.
 *
 * The wording is a PROMISE, not a balance: an onboarding user has no account,
 * so nothing can be credited yet. The backend grants this bonus once, on the
 * first email verification (`XpSource.ONBOARDING`) — which is why the amount
 * passed in must be the real reward, never a bigger marketing number.
 */
export function OnboardingRewardCard({ xp, note }: { xp: number; note: string }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.badge}>
        <Ionicons name="star" size={20} color={c.xp} />
      </View>
      <View style={styles.copy}>
        <AppText variant="bodyStrong" color={c.xpText}>
          {tf('tasteXpBadge', { xp })}
        </AppText>
        <AppText variant="caption" color={c.textSecondary}>
          {note}
        </AppText>
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: c.surfaceAlt,
    },
    badge: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    copy: { flex: 1, gap: 2 },
  });
