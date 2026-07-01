import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PersonRow } from './PersonRow';
import { useColors } from '../settings/SettingsContext';
import { radius, type AppColors } from '../theme/theme';

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
  const c = useColors();
  const styles = makeStyles(c);
  return (
    <PersonRow
      name={name}
      username={username}
      avatarUrl={avatarUrl}
      right={
        busy ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <>
            <Pressable onPress={onReject} style={[styles.btn, styles.reject]} hitSlop={4}>
              <Ionicons name="close" size={18} color={c.danger} />
            </Pressable>
            <Pressable onPress={onApprove} style={[styles.btn, styles.approve]} hitSlop={4}>
              <Ionicons name="checkmark" size={18} color={c.white} />
            </Pressable>
          </>
        )
      }
    />
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  reject: { backgroundColor: c.dangerSoft },
  approve: { backgroundColor: c.success },
});
