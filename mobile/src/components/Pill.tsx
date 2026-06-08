import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, fontSize } from '../theme/theme';

/** Small rounded tag — level (A1), lesson state ("Дасгал"), etc. */
export function Pill({
  label,
  bg = colors.surface,
  fg = colors.textMuted,
}: {
  label: string;
  bg?: string;
  fg?: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  text: { fontSize: fontSize.xs, fontWeight: '700' },
});
