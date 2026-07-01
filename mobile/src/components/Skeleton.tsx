import { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '../settings/SettingsContext';
import { radius } from '../theme/theme';

/**
 * Ghost-loading placeholder block. Pulses opacity while content is fetching —
 * drop several in a row/column to mimic the real layout (title line, cover
 * image, paragraph lines, etc.) instead of a centered spinner.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius: r = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const c = useColors();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: r, backgroundColor: c.surfaceAlt },
        animatedStyle,
        style,
      ]}
    />
  );
}
