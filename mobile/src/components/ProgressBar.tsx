import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/**
 * Thin rounded progress track. One implementation for daily goals, lesson
 * progress, XP-to-next-level, challenges — anywhere we show "x of y".
 */
export function ProgressBar({
  value,
  color = colors.primary,
  track,
  height = 8,
  style,
}: {
  /** 0–1. Clamped. */
  value: number;
  color?: string;
  track?: string;
  height?: number;
  style?: ViewStyle;
}) {
  const c = useColors();
  const trackColor = track ?? c.border;
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { height, borderRadius: height, backgroundColor: trackColor }, style]}>
      <View style={{ width: `${pct}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
});
