import { View, Pressable, Image, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/theme";
import { haptics } from "../lib/haptics";
import { SPRING, useReduceMotion } from "../lib/motion";

/**
 * The AI-buddy tab: the fox as a raised avatar in a brand-gradient ring.
 *
 * Deliberately calm. This sits in a tab bar beside four flat icons, on top of
 * whatever screen the student is actually reading — so it earns attention by
 * being the only round, raised, full-colour thing down there, not by moving.
 * Nothing animates at rest: a permanent animation in a persistent chrome
 * element competes with the content, draws the eye back every few seconds, and
 * runs the compositor for as long as the app is open.
 *
 * All the life is in the press, where it is feedback rather than decoration:
 * the avatar dips and springs back while a ring pulses outward once.
 *
 * Layout: the avatar is absolutely positioned over a small invisible anchor, so
 * its size never changes the tab bar's height or nudges the tabs beside it.
 */
const AVATAR = 60;
const RING = 2.5;
const OUTER = AVATAR + RING * 2;
/** Ripple's reach on press, as a multiple of the ring. */
const RIPPLE_SCALE = 1.5;
/**
 * The avatar is absolutely positioned and this invisible box is all it
 * contributes to layout — matching the flat tabs' chip height.
 */
const ANCHOR = 48;
/** Raise above the other tabs. Kept modest: on Android the part of a view
 *  outside its parent still draws but does NOT receive touches. */
const LIFT = 10;

/**
 * `buddy-menu.webp` is a 1024px sticker with a WHITE page behind it: the purple
 * disc spans the middle ~71%, its centre ~3% above the file's centre. Drawing
 * the image at 1.42× the avatar and nudging it down crops the white away, so
 * the artwork's own disc is what fills the circle.
 */
const IMG = Math.round(AVATAR * 1.42);
const IMG_NUDGE = Math.round(IMG * 0.03);

/** Brand sweep for the ring. */
const RING_COLORS = [colors.primary, "#A855F7", "#EC4899"] as const;
/** Behind the artwork while it loads — never white, in either theme. */
const BACKDROP = "#241250";

/** One outward pulse on press. Feedback, not decoration. */
function Ripple({ ripple }: { ripple: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: (1 - ripple.value) * 0.5,
    transform: [{ scale: 1 + ripple.value * (RIPPLE_SCALE - 1) }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.ripple, style]} />;
}

export function BuddyTabButton({
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
  const scale = useSharedValue(1);
  const ripple = useSharedValue(0);

  const press = () => {
    haptics.medium(); // heavier than the other tabs — this one is the hero
    if (!reduce) {
      // Reset first so a quick second tap restarts the pulse instead of
      // continuing the old one.
      ripple.value = 0;
      ripple.value = withTiming(1, { duration: 420 });
      scale.value = withSequence(withSpring(1.06, SPRING), withSpring(1, SPRING));
    }
    onPress();
  };

  const avatarStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      style={styles.tab}
      onPress={press}
      onPressIn={() => { if (!reduce) scale.value = withSpring(0.93, SPRING); }}
      onPressOut={() => { if (!reduce) scale.value = withSpring(1, SPRING); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <View style={styles.anchor}>
        <Ripple ripple={ripple} />

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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  anchor: {
    width: ANCHOR,
    height: ANCHOR,
    marginTop: -LIFT,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    alignItems: "center",
    justifyContent: "center",
    // Soft brand-coloured lift, so the avatar reads as sitting above the bar
    // rather than punched into it.
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  ringActive: { shadowOpacity: 0.5, shadowRadius: 12 },
  gradient: { borderRadius: OUTER / 2 },
  /** Muted while another tab is active — present, but not calling out. */
  gradientIdle: { opacity: 0.55 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: BACKDROP,
    overflow: "hidden",
  },
  // Oversized and nudged down so the sticker's white backing is cropped off.
  img: { width: IMG, height: IMG, left: (AVATAR - IMG) / 2, top: (AVATAR - IMG) / 2 + IMG_NUDGE },
  ripple: {
    position: "absolute",
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});
