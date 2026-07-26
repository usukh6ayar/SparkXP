import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * A round icon "award" badge used on completion / celebration screens (quiz &
 * reading finish, saved-words practice done, empty-deck state). Replaces the
 * raw celebration emoji (🎉/🏆…) which render clipped or as broken glyphs on
 * some Android devices — a crisp vector icon in a coloured disc looks premium
 * and identical everywhere.
 */
export function AwardBadge({
  icon,
  color,
  bg,
  size = 76,
  iconSize,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** Icon colour. */
  color: string;
  /** Disc background colour. */
  bg: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.5)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
