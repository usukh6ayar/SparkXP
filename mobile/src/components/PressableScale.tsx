import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptics } from '../lib/haptics';
import { SPRING, useReduceMotion } from '../lib/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  /** Scale while pressed (default 0.97 — the app-wide "tactile" press). */
  activeScale?: number;
  /** Fire a light haptic tap on press-in (default true). */
  haptic?: boolean;
}

/**
 * Pressable that springs down to `activeScale` while held — the shared tactile
 * press feedback for the whole app. Replaces the old, barely-visible
 * `scale: 0.99` scattered across screens (DRY). Respects Reduce Motion.
 *
 * Usage:
 *   <PressableScale onPress={...}><Card>…</Card></PressableScale>
 */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { activeScale = 0.97, haptic = true, onPressIn, onPressOut, disabled, children, style, ...rest },
  ref,
) {
  const scale = useSharedValue(1);
  const reduce = useReduceMotion();

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = reduce ? 1 : withSpring(activeScale, SPRING);
          if (haptic) haptics.tap();
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = reduce ? 1 : withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      style={[animatedStyle, style as object]}
      {...rest}
    >
      {children as React.ReactNode}
    </AnimatedPressable>
  );
});
