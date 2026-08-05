import { StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp } from 'react-native-reanimated';
import { enter } from '../lib/motion';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Confetti } from './Confetti';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, elevation, type AppColors } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function RewardBurst({
  title,
  subtitle,
  icon = 'sparkles',
  confettiCount = 18,
  topOffset = spacing.xl,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  confettiCount?: number;
  /**
   * Distance from the top of the parent. Screens with their own header must
   * push it clear of theirs — the card is `pointerEvents="none"`, so landing on
   * a back button does not break the press, but it hides it, and a back button
   * you cannot see reads as a broken one.
   */
  topOffset?: number;
}) {
  const c = useColors();
  const styles = makeStyles(c);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Confetti count={confettiCount} />
      <Animated.View
        entering={enter()}
        exiting={FadeOutUp.duration(180)}
        style={[styles.card, { top: topOffset }]}
      >
        <View style={styles.icon}>
          <Ionicons name={icon} size={22} color={c.xp} />
        </View>
        <View style={styles.copy}>
          <AppText variant="h3" color={c.textOnDark} numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color={c.textOnDarkMuted} numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50 },
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.primary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.glassBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...(elevation.float as object),
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  copy: { flex: 1 },
});
