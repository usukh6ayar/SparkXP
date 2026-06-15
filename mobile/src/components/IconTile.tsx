import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * A brand-tinted rounded icon chip. Replaces emoji used as functional icons —
 * one coherent (Ionicons) visual language that can be tinted to any tint pair.
 */
export function IconTile({
  icon,
  bg,
  fg,
  size = 48,
  iconSize,
}: {
  icon: IconName;
  bg: string;
  fg: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius.md, backgroundColor: bg }]}>
      <Ionicons name={icon} size={iconSize ?? size * 0.5} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
