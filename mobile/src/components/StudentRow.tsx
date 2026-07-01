import { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Avatar } from './Avatar';
import { spacing, radius, type AppColors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const Row = onPress ? Pressable : View;
  return (
    <Row style={styles.row} onPress={onPress}>
      {rank != null ? (
        <AppText variant="label" color={colors.textMuted} style={styles.rank}>
          {rank}
        </AppText>
      ) : null}
      <Avatar avatarUrl={avatarUrl} name={name} size={40} />
      <View style={styles.body}>
        <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
        {username ? (
          <AppText variant="caption" numberOfLines={1}>@{username}</AppText>
        ) : null}
      </View>
      <View style={styles.xp}>
        <Ionicons name="flash" size={13} color={colors.xp} />
        <AppText variant="label" color={colors.textSecondary}>{xp}</AppText>
      </View>
    </Row>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rank: { width: 18, textAlign: 'center' },
  body: { flex: 1, gap: 1 },
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
