import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PersonRow } from './PersonRow';
import { colors, radius } from '../theme/theme';

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
    <PersonRow
      name={name}
      username={username}
      avatarUrl={avatarUrl}
      right={
        busy ? (
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
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  reject: { backgroundColor: colors.dangerSoft },
  approve: { backgroundColor: colors.success },
});
