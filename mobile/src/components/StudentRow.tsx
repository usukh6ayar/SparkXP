import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { colors, spacing, radius } from '../theme/theme';

/** A roster row: initial avatar, name, lifetime XP. */
export function StudentRow({ name, xp }: { name: string; xp: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <AppText variant="bodyStrong" color={colors.primary}>
          {initial}
        </AppText>
      </View>
      <AppText variant="bodyStrong" style={styles.name} numberOfLines={1}>
        {name}
      </AppText>
      <View style={styles.xp}>
        <Ionicons name="flash" size={13} color={colors.xp} />
        <AppText variant="label" color={colors.textSecondary}>
          {xp} XP
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1 },
  xp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
