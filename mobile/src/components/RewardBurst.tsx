import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
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
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  confettiCount?: number;
}) {
  const c = useColors();
  const styles = makeStyles(c);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Confetti count={confettiCount} />
      <Animated.View
        entering={FadeInDown.springify().damping(13)}
        exiting={FadeOutUp.duration(180)}
        style={styles.card}
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
    top: spacing.xl,
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
