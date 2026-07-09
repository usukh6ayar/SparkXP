import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { AppText } from './Text';
import { AppIcon } from './AppIcon';
import { spacing, radius } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/**
 * Shared screen header: optional back button + title on the left, streak and
 * Sparks badges on the right. Streak is a placeholder until the backend tracks
 * it; Sparks is the real balance.
 */
export function TopBar({
  title,
  subtitle,
  back = false,
  onBack,
  streak = 0,
  showBadges = true,
  onAddSparks,
  onHistory,
}: {
  title?: string;
  /** Small status line under the title (shown with a green "online" dot). */
  subtitle?: string;
  back?: boolean;
  /** Custom back handler (e.g. step back one level in-screen). Defaults to router.back(). */
  onBack?: () => void;
  streak?: number;
  showBadges?: boolean;
  /** Shows a small "+" button next to the Sparks badge (e.g. open the Sparks store). */
  onAddSparks?: () => void;
  /** Shows a history icon in the top corner (e.g. open the ChatGPT-style chat history). */
  onHistory?: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const c = useColors();

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {back ? (
          <Pressable style={[styles.backBtn, { backgroundColor: c.surfaceAlt }]} onPress={() => (onBack ? onBack() : router.back())} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </Pressable>
        ) : null}
        {title ? (
          <View style={styles.titleCol}>
            <AppText variant="h1" numberOfLines={1}>{title}</AppText>
            {subtitle ? (
              <View style={styles.subtitleRow}>
                <View style={[styles.onlineDot, { backgroundColor: c.success }]} />
                <AppText variant="caption" color={c.textSecondary}>{subtitle}</AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.badges}>
        {onHistory ? (
          <Pressable
            style={[styles.iconBtn, { backgroundColor: c.surfaceAlt }]}
            onPress={onHistory}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Ionicons name="time-outline" size={20} color={c.text} />
          </Pressable>
        ) : null}
        {showBadges ? (
          <>
          <View style={[styles.badge, { backgroundColor: c.surfaceAlt }]}>
            <AppIcon name="streak" size={22} />
            <AppText variant="label" color={c.text}>{streak}</AppText>
          </View>
          <View style={[styles.badge, { backgroundColor: c.surfaceAlt }]}>
            <AppIcon name="sparks" size={21} />
            <AppText variant="label" color={c.text}>{user?.sparks ?? 0}</AppText>
            {onAddSparks ? (
              <Pressable onPress={onAddSparks} hitSlop={6} style={[styles.addBtn, { backgroundColor: c.primary }]}>
                <Ionicons name="add" size={12} color={c.white} />
              </Pressable>
            ) : null}
          </View>
          </>
        ) : null}
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
    minHeight: 48,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  titleCol: { flexShrink: 1, gap: 2 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  addBtn: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
