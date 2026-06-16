import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { t } from '../i18n';
import { colors, spacing, radius } from '../theme/theme';

/** A pending join-request row: student name + approve / reject actions. */
export function RequestRow({
  name,
  onApprove,
  onReject,
  busy,
}: {
  name: string;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <AppText variant="bodyStrong" color={colors.streak}>{initial}</AppText>
      </View>
      <AppText variant="bodyStrong" style={styles.name} numberOfLines={1}>
        {name}
      </AppText>
      <Pressable onPress={onReject} disabled={busy} style={[styles.btn, styles.reject]} hitSlop={4}>
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
      <Pressable onPress={onApprove} disabled={busy} style={[styles.btn, styles.approve]} hitSlop={4}>
        <Ionicons name="checkmark" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: '#FFF1E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1 },
  btn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  reject: { backgroundColor: colors.dangerSoft },
  approve: { backgroundColor: colors.success },
});
