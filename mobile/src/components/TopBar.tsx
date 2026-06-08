import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, radius, fontSize } from '../theme/theme';

/**
 * Shared screen header: optional back button + title on the left, the
 * streak 🔥 and Sparks 🪙 badges on the right (как in the design). Streak is a
 * placeholder until the backend tracks it; Sparks is the real balance.
 */
export function TopBar({
  title,
  back = false,
  streak = 0,
}: {
  title?: string;
  back?: boolean;
  streak?: number;
}) {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {back ? (
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        ) : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>

      <View style={styles.badges}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>🔥</Text>
          <Text style={styles.badgeText}>{streak}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>🪙</Text>
          <Text style={styles.badgeText}>{user?.sparks ?? 0}</Text>
        </View>
      </View>
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
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 26, color: colors.navy, marginTop: -2, fontWeight: '700' },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.navy },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  badgeIcon: { fontSize: fontSize.md },
  badgeText: { fontWeight: '800', color: colors.navy, fontSize: fontSize.md },
});
