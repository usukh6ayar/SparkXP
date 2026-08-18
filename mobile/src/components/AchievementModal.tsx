import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './Text';
import { AppImage } from './AppImage';
import { AppIcon } from './AppIcon';
import { Button } from './Button';
import { Confetti } from './Confetti';
import { useColors } from '../settings/SettingsContext';
import { haptics } from '../lib/haptics';
import { useReduceMotion, SPRING } from '../lib/motion';
import { t } from '../i18n';
import { spacing, radius, elevation } from '../theme/theme';
import type { AppIconName } from '../constants/appIcons';
import { ms } from '../theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;

export interface Achievement {
  /** Ionicons fallback, used only when there is no `appIcon` and no `imageUrl`. */
  icon: IconName;
  /**
   * A brand 3D icon from `assets/icons` (the same flame the streak badge uses
   * everywhere else in the app). **Preferred over `icon`** — a flat Ionicons
   * glyph in the middle of a celebration is the cheapest thing on the screen.
   */
  appIcon?: AppIconName;
  /** Headline. Optional: when `badgeValue` is set, the number IS the headline. */
  title?: string;
  /** Small header above the badge. Defaults to "Шинэ амжилт нээгдлээ!". */
  overline?: string;
  /** Short description of what was unlocked. */
  subtitle?: string;
  /** Badge tint (bg/fg pair from theme `tints`). */
  tint: { bg: string; fg: string };
  /**
   * Real trophy artwork (the 640px `image` from GET /achievements). When set it
   * replaces the icon, which stays the fallback for callers with no artwork.
   */
  imageUrl?: string;
  /**
   * A number to print large UNDER the badge — the streak count.
   *
   * It used to be crammed inside the badge beneath a shrunken icon, which left
   * the badge doing two jobs badly. Now the artwork owns the badge and the
   * number owns the line below it, where it can be as big as its news.
   */
  badgeValue?: string;
  /** Caption under `badgeValue` ("өдрийн дараалал"). */
  badgeValueLabel?: string;
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
  // Slow breathing on the halo behind the badge, so the celebration keeps a
  // little life after the badge has sprung in (off under Reduce Motion).
  const halo = useSharedValue(0);

  useEffect(() => {
    if (visible && achievement) {
      haptics.success();
      scale.value = reduce
        ? 1
        : withSequence(withSpring(1.15, SPRING), withSpring(1, SPRING));
      halo.value = reduce
        ? 0.5
        : withRepeat(withTiming(1, { duration: 1400 }), -1, true);
    } else {
      scale.value = 0;
      halo.value = 0;
    }
  }, [visible, achievement, reduce, scale, halo]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + halo.value * 0.5,
    transform: [{ scale: 0.92 + halo.value * 0.16 }],
  }));

  if (!achievement) return null;

  // A streak card has no `title` (its number is the headline), so the remount
  // key can't be the title alone — without this a streak followed by the trophy
  // it just unlocked would keep the first card's mounted confetti.
  const key = achievement.title ?? `${achievement.overline}:${achievement.badgeValue}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* A soft wash of the badge's own colour over the dark scrim — a richer
            backdrop than a flat grey, tinted to whatever is being celebrated. */}
        <LinearGradient
          pointerEvents="none"
          colors={[`${achievement.tint.fg}2E`, 'rgba(10,6,30,0.86)', 'rgba(8,4,26,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Tap outside to dismiss — behind the card/confetti */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* `key` matters when two celebrations queue back to back (a streak and
            the trophy it just unlocked): the modal never closes between them,
            so without a remount the second one would inherit spent confetti. */}
        {visible && <Confetti key={`confetti-${key}`} count={50} />}
        <Animated.View
          key={`card-${key}`}
          entering={FadeIn}
          style={[styles.card, { backgroundColor: c.surface }]}
        >
          <AppText variant="overline" color={c.textMuted}>
            {achievement.overline ?? t('achievementUnlocked')}
          </AppText>

          {/* The badge sits inside a soft halo of its own tint. One flat
              circle read as a sticker; the halo is what makes it look lit. */}
          <View style={styles.badgeWrap}>
            <Animated.View style={[styles.glow, { backgroundColor: `${achievement.tint.fg}1F` }, haloStyle]} />
            <Animated.View
              style={[
                styles.badge,
                { backgroundColor: achievement.tint.bg, borderColor: achievement.tint.fg },
                badgeStyle,
              ]}
            >
              {achievement.imageUrl ? (
                <AppImage source={achievement.imageUrl} width={220} contentFit="contain" style={styles.badgeImg} />
              ) : achievement.appIcon ? (
                // ≤64pt on purpose: the brand PNGs are ~200px wide, so anything
                // larger goes soft (see `appIcons.ts`).
                <AppIcon name={achievement.appIcon} size={ms(64)} />
              ) : (
                <Ionicons name={achievement.icon} size={54} color={achievement.tint.fg} />
              )}
            </Animated.View>
          </View>

          {achievement.badgeValue ? (
            <View style={styles.valueBlock}>
              <AppText style={[styles.badgeValue, { color: achievement.tint.fg }]}>
                {achievement.badgeValue}
              </AppText>
              {achievement.badgeValueLabel ? (
                <AppText variant="bodyStrong" color={c.textSecondary}>
                  {achievement.badgeValueLabel}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {achievement.title ? <AppText variant="h2" center>{achievement.title}</AppText> : null}
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

          <Button label={t('continue')} onPress={onClose} style={styles.btn} />
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
  badgeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  /** The halo. Sits BEHIND the badge, which clips its own contents. */
  glow: {
    position: 'absolute',
    width: ms(152),
    height: ms(152),
    borderRadius: radius.full,
  },
  badge: {
    width: ms(110),
    height: ms(110),
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** Trophy artwork fills the circle, inset so the ring stays visible. */
  badgeImg: { width: '86%', height: '86%' },
  /** The streak number, on its own line under the badge. */
  valueBlock: { alignItems: 'center', gap: 2 },
  badgeValue: { fontSize: ms(52), lineHeight: ms(58), fontWeight: '800' },
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
