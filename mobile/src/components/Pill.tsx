import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { radius, spacing } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

type IconName = keyof typeof Ionicons.glyphMap;

/** Small rounded tag — CEFR level, lesson state, counts. Optional leading icon. */
export function Pill({
  label,
  bg,
  fg,
  icon,
}: {
  label: string;
  bg?: string;
  fg?: string;
  icon?: IconName;
}) {
  const c = useColors();
  const bgColor = bg ?? c.surfaceAlt;
  const fgColor = fg ?? c.textSecondary;
  return (
    <View style={[styles.pill, { backgroundColor: bgColor }]}>
      {icon ? <Ionicons name={icon} size={12} color={fgColor} /> : null}
      <AppText variant="caption" color={fgColor} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  text: { fontWeight: '700', letterSpacing: 0.2 },
});
