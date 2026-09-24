import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing, FadeIn, cancelAnimation, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { colors, radius } from '../theme/theme';
import { useReduceMotion } from '../lib/motion';

/** Must equal `imageWidth` of expo-splash-screen in `app.json`, so the fox
 *  sits exactly where the native splash left it — no jump on hand-off. */
const LOGO_SIZE = 240;
const BAR_W = 120;
const SHIMMER_W = 44;

/**
 * The launch screen shown after the native splash hides, while fonts and the
 * saved session load. Same background + same fox in the same spot as the native
 * splash, then it comes alive: the fox breathes, a glow pulses behind it, the
 * SparkXP wordmark fades in and a thin bar shimmers.
 *
 * Never delays anything on purpose — it disappears the moment the app is ready.
 * Renders ABOVE SettingsProvider, so it can use no theme context or custom
 * fonts (images only).
 */
export function BrandLoader() {
  const reduce = useReduceMotion();
  const breath = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    const ease = Easing.inOut(Easing.quad);
    breath.value = withRepeat(
      withSequence(withTiming(1, { duration: 900, easing: ease }), withTiming(0, { duration: 900, easing: ease })),
      -1,
    );
    shimmer.value = withRepeat(withTiming(1, { duration: 1100, easing: ease }), -1);
    return () => {
      cancelAnimation(breath);
      cancelAnimation(shimmer);
    };
  }, [reduce, breath, shimmer]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.value * 0.04 }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + breath.value * 0.55,
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -SHIMMER_W + shimmer.value * (BAR_W + SHIMMER_W) }],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={logoStyle}>
        <Image source={require('../../assets/splash-logo.png')} style={styles.logo} contentFit="contain" />
      </Animated.View>

      {/* Absolutely placed under the centre so the fox itself stays exactly
          centred, matching the native splash. */}
      <Animated.View entering={FadeIn.delay(150).duration(400)} style={styles.below}>
        <Image source={require('../../assets/logoSparkXP.webp')} style={styles.wordmark} contentFit="contain" />
        <View style={styles.track}>
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.splash },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  // The disc hides behind the fox tile (120pt) — only its blurred shadow shows,
  // as a soft halo. A bigger disc reads as a hard-edged circle.
  glow: {
    position: 'absolute', width: 112, height: 112, borderRadius: radius.full,
    backgroundColor: colors.glow,
    shadowColor: colors.glow, shadowOpacity: 1, shadowRadius: 48, elevation: 0, shadowOffset: { width: 0, height: 0 },
  },
  // The wordmark PNG has wide transparent padding; the negative margin pulls
  // its letters up to sit just under the fox tile.
  below: { position: 'absolute', top: '50%', marginTop: 44, alignItems: 'center' },
  wordmark: { width: 220, height: 147 },
  track: {
    width: BAR_W, height: 4, borderRadius: radius.full, overflow: 'hidden',
    marginTop: -40, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shimmer: { width: SHIMMER_W, height: '100%', borderRadius: radius.full, backgroundColor: colors.xp },
});
