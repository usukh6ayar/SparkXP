import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { EmptyState } from '../src/components/EmptyState';
import { Skeleton } from '../src/components/Skeleton';
import { getMyNotifications, type AppNotification } from '../src/api/notifications';
import { markNotificationsSeen } from '../src/lib/useUnreadNotifications';
import { t, tf } from '../src/i18n';
import { spacing, radius, type AppColors } from '../src/theme/theme';
import { useColors } from '../src/settings/SettingsContext';

/** Compact "x ago" label from an ISO timestamp; falls back to a date. */
function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return t('timeNow');
  if (min < 60) return tf('timeMinAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return tf('timeHourAgo', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return tf('timeDayAgo', { n: day });
  return new Date(iso).toLocaleDateString();
}

/**
 * In-app notification center: lists broadcasts targeting the student (from the
 * admin panel). Opening it marks everything seen so the header bell dot clears.
 */
export default function NotificationsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(false);
      const list = await getMyNotifications(token);
      setItems(list);
      if (list.length > 0) {
        const latest = list.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), list[0].createdAt);
        await markNotificationsSeen(latest);
      }
    } catch {
      setError(true);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('notifications')} back showBadges={false} />
      {loading ? (
        <View style={styles.container}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={78} radius={radius.lg} style={{ marginBottom: spacing.md }} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t('notificationsError')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: () => { setLoading(true); load().finally(() => setLoading(false)); } }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title={t('notificationsEmpty')}
          hint={t('notificationsEmptyHint')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {items.map((n) => (
            <View key={n.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name="megaphone" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardHead}>
                  <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>{n.title}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>{timeAgo(n.createdAt)}</AppText>
                </View>
                <AppText variant="body" color={colors.textSecondary} style={styles.body}>{n.body}</AppText>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  body: { marginTop: 3 },
});
