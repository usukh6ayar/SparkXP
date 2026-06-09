import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { AppText } from './Text';
import { colors, spacing, radius } from '../theme/theme';

/**
 * Shared screen header: optional back button + title on the left, streak and
 * Sparks badges on the right. Streak is a placeholder until the backend tracks
 * it; Sparks is the real balance.
 */
export function TopBar({
  title,
  back = false,
  streak = 0,
  showBadges = true,
}: {
  title?: string;
  back?: boolean;
  streak?: number;
  showBadges?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {back ? (
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        {title ? <AppText variant="h1" numberOfLines={1}>{title}</AppText> : null}
      </View>

      {showBadges ? (
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Ionicons name="flame" size={15} color={colors.streak} />
            <AppText variant="label" color={colors.text}>{streak}</AppText>
          </View>
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color={colors.sparks} />
            <AppText variant="label" color={colors.text}>{user?.sparks ?? 0}</AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
});
