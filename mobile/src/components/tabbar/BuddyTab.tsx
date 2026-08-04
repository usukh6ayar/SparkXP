import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../Text';
import { colors } from '../../theme/theme';
import { haptics } from '../../lib/haptics';
import { SPRING, useReduceMotion } from '../../lib/motion';
import { AVATAR, BUDDY_GAP, BUDDY_OUTER, RING } from './geometry';

/**
 * The AI-buddy tab: the fox as a raised avatar in a glowing brand ring, riding
 * the crest of the wave as if the wave were its wake.
 *
 * It breathes at rest — a slow scale and a halo that swells with it. That is a
 * deliberate reversal of this component's earlier "nothing animates at rest"
 * rule: the buddy is the primary call to action, and the whole bar is designed
 * around it being the one live thing down there. The motion is slow (≈4.4s a
 * cycle) and tiny (3.5%) so it registers as alive rather than as an animation
 * competing with the screen, and it is switched off entirely under
 * Reduce Motion, where it would be exactly the distraction that setting exists
 * to remove.
 */

/** Brand sweep for the ring. */
const RING_COLORS = [colors.primary, '#A855F7', '#EC4899'] as const;
/** Behind the artwork while it loads — never white, in either theme. */
const BACKDROP = '#241250';

/**
 * `buddy-menu.webp` is a 1024px sticker with a WHITE page behind it: the purple
 * disc spans the middle ~71%, its centre ~3% above the file's centre. Drawing
 * the image at 1.42× the avatar and nudging it down crops the white away, so
 * the artwork's own disc is what fills the circle.
 */
const IMG = Math.round(AVATAR * 1.42);
const IMG_NUDGE = Math.round(IMG * 0.03);

/**
 * The halo: a soft purple bloom that breathes half a beat behind the avatar.
 *
 * Kept TIGHT on purpose. The bar reserves only its card from the screens, so
 * everything the buddy paints above that lands on top of whatever the screen
 * has at its bottom edge. A wide bloom (it was scale 1.20 over a 22px shadow)
 * reached 18px past the fox and settled on the bottom of the buddy picker's
 * Apply button — reading as if the fox were stuck to it. Now the whole glow
 * stops within a few px of the ring, and no screen has to pad around it.
 */
function Halo({ breath, focused }: { breath: SharedValue<number>; focused: boolean }) {
  const style = useAnimatedStyle(() => ({
    opacity: (focused ? 0.5 : 0.3) + breath.value * 0.22,
    transform: [{ scale: 1.05 + breath.value * 0.08 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.halo, style]} />;
}

export function BuddyTab({
  image,
  label,
  focused,
  onPress,
}: {
  image: number;
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const reduce = useReduceMotion();
  const press = useSharedValue(1);
  // 0…1, looping. Drives both the avatar's scale and the halo's swell so they
  // breathe as one body instead of two independent loops drifting apart.
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(withTiming(1, { duration: 2200 }), withTiming(0, { duration: 2200 })),
      -1,
    );
    return () => cancelAnimation(breath);
  }, [reduce, breath]);

  const tap = () => {
    haptics.medium(); // heavier than the other tabs — this one is the hero
    if (!reduce) press.value = withSequence(withSpring(1.08, SPRING), withSpring(1, SPRING));
    onPress();
  };

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: press.value * (focused ? 1.06 : 1) * (1 + breath.value * 0.035) },
    ],
  }));

  return (
    <Pressable
      style={styles.tab}
      onPress={tap}
      onPressIn={() => { if (!reduce) press.value = withSpring(0.94, SPRING); }}
      onPressOut={() => { if (!reduce) press.value = withSpring(1, SPRING); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      {/* Its own box, exactly the ring's size, so the halo centres on the
          avatar rather than on the avatar-plus-label column. */}
      <View style={styles.orb}>
        <Halo breath={breath} focused={focused} />

        <Animated.View style={[styles.ring, focused && styles.ringActive, avatarStyle]}>
          {/* The gradient IS the ring: the avatar sits on top and leaves it
              showing as a band, which stays even in width without a border. */}
          <LinearGradient
            colors={RING_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.gradient, !focused && styles.gradientIdle]}
          />
          <View style={styles.avatar}>
            <Image source={image} style={styles.img} resizeMode="cover" />
          </View>
        </Animated.View>
      </View>

      {/* Always brand-coloured, active or not — the four flat tabs go grey when
          idle, and this one staying purple is what keeps it reading as the
          hero rather than as a fifth tab. */}
      <AppText variant="tabLabel" color={colors.primary} center>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Avatar over label — `CustomTabBar` anchors this column by its bottom. */
  tab: { alignItems: 'center', gap: BUDDY_GAP },
  orb: { width: BUDDY_OUTER, height: BUDDY_OUTER, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: BUDDY_OUTER,
    height: BUDDY_OUTER,
    borderRadius: BUDDY_OUTER / 2,
    padding: RING,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.32,
    // Thrown DOWNWARD (+6) and kept short, for the same reason as the halo:
    // upward bleed lands on the screen's own bottom-most content. Reach up is
    // radius − offset, so this glows ~4px above the ring and ~16 below it.
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ringActive: { shadowOpacity: 0.55, shadowRadius: 12 },
  gradient: { borderRadius: BUDDY_OUTER / 2 },
  /** Muted while another tab is active — present, but not calling out. */
  gradientIdle: { opacity: 0.62 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: BACKDROP,
    overflow: 'hidden',
  },
  // Oversized and nudged down so the sticker's white backing is cropped off.
  img: { width: IMG, height: IMG, left: (AVATAR - IMG) / 2, top: (AVATAR - IMG) / 2 + IMG_NUDGE },
  halo: {
    position: 'absolute',
    width: BUDDY_OUTER,
    height: BUDDY_OUTER,
    borderRadius: BUDDY_OUTER / 2,
    backgroundColor: colors.primary,
    opacity: 0.3,
    shadowColor: colors.primary,
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
