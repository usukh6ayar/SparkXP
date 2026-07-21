import { useMemo } from 'react';
import { View, Image, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Button } from './Button';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, elevation, type AppColors } from '../theme/theme';
import { ms } from '../theme/responsive';

const fox = require('../../assets/fox-home.webp');

export function EmptyState({
  icon,
  title,
  hint,
  action,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  /** Optional retry/action button rendered below the hint (e.g. "Дахин оролдох"). */
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={[styles.empty, style]}>
      {/* Fox mascot with a small contextual icon badge — warmer than a bare icon. */}
      <View style={styles.mascot}>
        <Image source={fox} style={styles.foxImg} resizeMode="contain" />
        <View style={styles.badge}>
          <Ionicons name={icon} size={18} color={c.white} />
        </View>
      </View>
      <AppText variant="h3" center style={{ marginTop: spacing.md }}>{title}</AppText>
      <AppText variant="body" center color={c.textSecondary} style={{ marginTop: 2 }}>
        {hint}
      </AppText>
      {action ? (
        <Button
          label={action.label}
          icon="refresh"
          variant="secondary"
          fullWidth={false}
          onPress={action.onPress}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.xxxl },
  mascot: { width: ms(120), height: ms(120), alignItems: 'center', justifyContent: 'center' },
  foxImg: { width: ms(120), height: ms(120) },
  badge: {
    position: 'absolute', right: 4, bottom: 4,
    width: 36, height: 36, borderRadius: radius.full, backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: c.background,
    ...elevation.sm,
  },
});
