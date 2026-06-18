import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Avatar } from './Avatar';
import { colors, spacing, radius } from '../theme/theme';

/** A pending join-request row: avatar, name (+ @username), approve / reject. */
export function RequestRow({
  name,
  username,
  avatarUrl,
  onApprove,
  onReject,
  busy,
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Avatar avatarUrl={avatarUrl} name={name} size={40} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
        {username ? <AppText variant="caption" numberOfLines={1}>@{username}</AppText> : null}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Pressable onPress={onReject} style={[styles.btn, styles.reject]} hitSlop={4}>
            <Ionicons name="close" size={18} color={colors.danger} />
          </Pressable>
          <Pressable onPress={onApprove} style={[styles.btn, styles.approve]} hitSlop={4}>
            <Ionicons name="checkmark" size={18} color={colors.white} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  body: { flex: 1, gap: 1 },
  btn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  reject: { backgroundColor: colors.dangerSoft },
  approve: { backgroundColor: colors.success },
});
