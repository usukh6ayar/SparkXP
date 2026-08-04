import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { Button } from './Button';
import { Confetti } from './Confetti';
import { useColors } from '../settings/SettingsContext';
import { haptics } from '../lib/haptics';
import { useReduceMotion, SPRING } from '../lib/motion';
import { t } from '../i18n';
import { spacing, radius, elevation } from '../theme/theme';
import { ms } from '../theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;

export interface Achievement {
  icon: IconName;
  title: string;
  /** Small header above the badge. Defaults to "Шинэ амжилт нээгдлээ!". */
  overline?: string;
  /** Short description of what was unlocked. */
  subtitle?: string;
  /** Badge tint (bg/fg pair from theme `tints`). */
  tint: { bg: string; fg: string };
  /**
   * Real trophy artwork (the 640px `image` from GET /achievements). When set it
   * replaces `icon`, which stays the fallback for callers that have no artwork.
   */
  imageUrl?: string;
  /**
   * A number to print large inside the badge, under a shrunken icon — the
   * streak count. A trophy IS its artwork, but "your streak is now 12" is a
   * number first, and reading it off the title line wastes the badge.
   */
  badgeValue?: string;
  /** One extra line below the subtitle, in its own tinted chip (e.g. how many
   *  days of freeze protection are left). Omitted when there is nothing to say. */
  note?: string;
  /** Icon for `note`'s chip. */
  noteIcon?: IconName;
}

/**
 * Full-screen celebration when the user unlocks a badge — confetti + a badge
 * that springs/pulses in, with a success haptic. Fire it from anywhere that
 * detects a newly-earned achievement.
 *
 * Usage:
 *   <AchievementModal visible={!!unlocked} achievement={unlocked} onClose={...} />
 */
export function AchievementModal({
  visible,
  achievement,
  onClose,
}: {
  visible: boolean;
  achievement: Achievement | null;
  onClose: () => void;
}) {
  const c = useColors();
  const reduce = useReduceMotion();
  const scale = useSharedValue(0);

  useEffect(() => {
    if (visible && achievement) {
      haptics.success();
      scale.value = reduce
        ? 1
        : withSequence(withSpring(1.15, SPRING), withSpring(1, SPRING));
    } else {
      scale.value = 0;
    }
  }, [visible, achievement, reduce]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!achievement) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tap outside to dismiss — behind the card/confetti */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* `key` matters when two celebrations queue back to back (a streak and
            the trophy it just unlocked): the modal never closes between them,
            so without a remount the second one would inherit spent confetti. */}
        {visible && <Confetti key={achievement.title} count={50} />}
        <Animated.View
          key={achievement.title}
          entering={FadeIn}
          style={[styles.card, { backgroundColor: c.surface }]}
        >
          <AppText variant="overline" color={c.textMuted}>
            {achievement.overline ?? t('achievementUnlocked')}
          </AppText>

          <Animated.View
            style={[
              styles.badge,
              { backgroundColor: achievement.tint.bg, borderColor: achievement.tint.fg },
              badgeStyle,
            ]}
          >
            {achievement.imageUrl ? (
              <AppImage source={achievement.imageUrl} width={220} contentFit="contain" style={styles.badgeImg} />
            ) : achievement.badgeValue ? (
              // Icon shrinks and sits over the number: the count is the news.
              <>
                <Ionicons name={achievement.icon} size={30} color={achievement.tint.fg} />
                <AppText style={[styles.badgeValue, { color: achievement.tint.fg }]}>
                  {achievement.badgeValue}
                </AppText>
              </>
            ) : (
              <Ionicons name={achievement.icon} size={54} color={achievement.tint.fg} />
            )}
          </Animated.View>

          <AppText variant="h2" center>{achievement.title}</AppText>
          {achievement.subtitle ? (
            <AppText variant="body" color={c.textSecondary} center style={styles.subtitle}>
              {achievement.subtitle}
            </AppText>
          ) : null}

          {achievement.note ? (
            <View style={[styles.note, { backgroundColor: achievement.tint.bg }]}>
              {achievement.noteIcon ? (
                <Ionicons name={achievement.noteIcon} size={14} color={achievement.tint.fg} />
              ) : null}
              <AppText variant="caption" color={achievement.tint.fg}>{achievement.note}</AppText>
            </View>
          ) : null}

          <Button label={t('nice')} onPress={onClose} style={styles.btn} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,6,30,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    zIndex: 2,
    ...(elevation.float as object),
  },
  badge: {
    width: ms(110),
    height: ms(110),
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
    overflow: 'hidden',
  },
  /** Trophy artwork fills the circle, inset so the ring stays visible. */
  badgeImg: { width: '86%', height: '86%' },
  badgeValue: { fontSize: ms(40), lineHeight: ms(46), fontWeight: '800' },
  subtitle: { marginTop: 2 },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  btn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
