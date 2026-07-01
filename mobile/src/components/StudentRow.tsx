import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { PersonRow } from './PersonRow';
import { colors, spacing, radius } from '../theme/theme';

/** A roster row: rank, avatar, name (+ @username), lifetime XP. Tappable when `onPress` is given. */
export function StudentRow({
  name,
  username,
  avatarUrl,
  xp,
  rank,
  onPress,
}: {
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  xp: number;
  rank?: number;
  onPress?: () => void;
}) {
  return (
    <PersonRow
      name={name}
      username={username}
      avatarUrl={avatarUrl}
      onPress={onPress}
      style={styles.row}
      leading={
        rank != null ? (
          <AppText variant="label" color={colors.textMuted} style={styles.rank}>
            {rank}
          </AppText>
        ) : undefined
      }
      right={
        <View style={styles.xp}>
          <Ionicons name="flash" size={13} color={colors.xp} />
          <AppText variant="label" color={colors.textSecondary}>{xp}</AppText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.md },
  rank: { width: 18, textAlign: 'center' },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
