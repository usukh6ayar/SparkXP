import { type ReactNode, useEffect } from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '../settings/SettingsContext';
import { useReduceMotion } from '../lib/motion';
import { type AppColors } from '../theme/theme';

/**
 * Round mascot backdrop used on onboarding / success screens: a soft (or
 * gradient) circle with the fox image centered. Floating badges are passed as
 * `children` and positioned absolutely by the caller relative to this circle.
 */
export function MascotCircle({
  image,
  size = 260,
  gradient = false,
  children,
}: {
  image: ImageSourcePropType;
  size?: number;
  gradient?: boolean;
  children?: ReactNode;
}) {
  const c = useColors();
  const styles = makeStyles(c);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  // Gentle "breathe" idle loop so the mascot feels alive (a static image can't
  // blink). Skipped under Reduce Motion.
  const breathe = useSharedValue(0);
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    breathe.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [reduce]);
  const foxStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + breathe.value * 0.04 },
      { translateY: -breathe.value * 4 },
    ],
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {gradient ? (
        <LinearGradient
          colors={[...c.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.circle, circle]}
        />
      ) : (
        <View style={[styles.circle, circle, styles.soft]} />
      )}
      <Animated.Image
        source={image}
        style={[{ width: size * 0.7, height: size * 0.7 }, foxStyle]}
        resizeMode="contain"
      />
      {children}
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute' },
  soft: { backgroundColor: c.primarySoft },
});
