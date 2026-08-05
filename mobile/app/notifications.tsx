import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useAuth } from '../src/auth/AuthContext';
import { AppText } from '../src/components/Text';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { PressableScale } from '../src/components/PressableScale';
import { Skeleton } from '../src/components/Skeleton';
import { getMyNotifications, type AppNotification } from '../src/api/notifications';
import { markNotificationsSeen } from '../src/lib/useUnreadNotifications';
import { haptics } from '../src/lib/haptics';
import { enter, useReduceMotion } from '../src/lib/motion';
import {
  categorize, chipOf, bucketOf, notifStore, DEV_MOCK_NOTIFICATIONS,
  type NotifCategory, type ChipKey, type TimeBucket,
} from '../src/lib/notificationCenter';
import { t, tf } from '../src/i18n';
import { spacing, radius, tints, elevation, type AppColors } from '../src/theme/theme';
import { useColors } from '../src/settings/SettingsContext';
import { bounded } from '../src/theme/responsive';

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

/** Visual identity + optional deep-link for each category (routes all exist). */
type CategoryMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  tint: { bg: string; fg: string };
  cta?: { labelKey: 'notifCtaContinue' | 'notifCtaStartChat' | 'notifCtaView'; href: Href };
};

function metaFor(category: NotifCategory, c: AppColors): CategoryMeta {
  switch (category) {
    case 'learning':
      return { icon: 'flash', tint: tints.purple, cta: { labelKey: 'notifCtaContinue', href: '/(tabs)/lessons' } };
    case 'rewards':
      return { icon: 'star', tint: tints.orange };
    case 'achievement':
      return { icon: 'trophy', tint: tints.green };
    case 'aibuddy':
      return { icon: 'chatbubbles', tint: tints.blue, cta: { labelKey: 'notifCtaStartChat', href: '/(tabs)/chat' } };
    case 'friend':
      return { icon: 'people', tint: tints.pink, cta: { labelKey: 'notifCtaView', href: '/leaderboard' } };
    default:
      return { icon: 'megaphone', tint: { bg: 'rgba(142,128,188,0.16)', fg: c.textMuted } };
  }
}

const CHIPS: { key: ChipKey; labelKey: Parameters<typeof t>[0] }[] = [
  { key: 'all', labelKey: 'notifFilterAll' },
  { key: 'learning', labelKey: 'notifFilterLearning' },
  { key: 'rewards', labelKey: 'notifFilterRewards' },
  { key: 'aibuddy', labelKey: 'notifFilterAiBuddy' },
  { key: 'social', labelKey: 'notifFilterSocial' },
  { key: 'system', labelKey: 'notifFilterSystem' },
];

const BUCKET_LABEL: Record<TimeBucket, Parameters<typeof t>[0]> = {
  today: 'notifGroupToday',
  yesterday: 'notifGroupYesterday',
  earlier: 'notifGroupEarlier',
};

/** A flattened list row — either a time-section header or a notification card. */
type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'item'; key: string; notif: AppNotification; category: NotifCategory; read: boolean };

// ── One notification card (memoized: only re-renders when its own props change) ──

const NotificationCard = memo(function NotificationCard({
  notif, category, read, colors, reduce, onOpen, onMarkRead, onDelete, onLongPress,
}: {
  notif: AppNotification;
  category: NotifCategory;
  read: boolean;
  colors: AppColors;
  reduce: boolean;
  onOpen: (n: AppNotification, category: NotifCategory) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onLongPress: (n: AppNotification, category: NotifCategory) => void;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const meta = useMemo(() => metaFor(category, colors), [category, colors]);
  const label = t(meta.cta ? meta.cta.labelKey : 'notifCtaView');

  // Swipe-left reveals: Read (only while unread) + Delete.
  const rightActions = () => (
    <View style={styles.actions}>
      {!read ? (
        <Pressable
          style={[styles.action, { backgroundColor: colors.primary }]}
          onPress={() => onMarkRead(notif.id)}
          accessibilityRole="button"
          accessibilityLabel={t('notifSwipeRead')}
        >
          <Ionicons name="checkmark-done" size={20} color={colors.white} />
          <AppText variant="caption" color={colors.white}>{t('notifSwipeRead')}</AppText>
        </Pressable>
      ) : null}
      <Pressable
        style={[styles.action, { backgroundColor: colors.danger }]}
        onPress={() => onDelete(notif.id)}
        accessibilityRole="button"
        accessibilityLabel={t('notifSwipeDelete')}
      >
        <Ionicons name="trash" size={20} color={colors.white} />
        <AppText variant="caption" color={colors.white}>{t('notifSwipeDelete')}</AppText>
      </Pressable>
    </View>
  );

  return (
    <Animated.View
      entering={reduce ? undefined : enter(0, 220)}
      exiting={reduce ? undefined : FadeOut.duration(160)}
      style={styles.cardOuter}
    >
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={rightActions}
      >
        <PressableScale
          onPress={() => onOpen(notif, category)}
          onLongPress={() => onLongPress(notif, category)}
          haptic={false}
          style={[styles.card, !read && styles.cardUnread]}
          accessibilityRole="button"
          accessibilityLabel={`${notif.title}. ${notif.body}. ${timeAgo(notif.createdAt)}`}
          accessibilityHint={read ? undefined : t('notifSwipeRead')}
        >
          <View style={[styles.iconWrap, { backgroundColor: meta.tint.bg }]}>
            <Ionicons name={meta.icon} size={22} color={meta.tint.fg} />
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardHead}>
              <AppText
                variant={read ? 'bodyStrong' : 'h3'}
                style={styles.title}
                numberOfLines={2}
              >
                {notif.title}
              </AppText>
              {!read ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
            </View>

            <AppText variant="body" color={colors.textSecondary} style={styles.body} numberOfLines={3}>
              {notif.body}
            </AppText>

            <View style={styles.metaRow}>
              <AppText variant="caption" color={colors.textMuted}>{timeAgo(notif.createdAt)}</AppText>
              {meta.cta ? (
                <PressableScale
                  onPress={() => onOpen(notif, category)}
                  style={[styles.cta, { backgroundColor: meta.tint.bg }]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <AppText variant="label" color={meta.tint.fg}>{label}</AppText>
                  <Ionicons name="arrow-forward" size={13} color={meta.tint.fg} />
                </PressableScale>
              ) : null}
            </View>
          </View>
        </PressableScale>
      </ReanimatedSwipeable>
    </Animated.View>
  );
});

/**
 * In-app Activity Center: lists broadcasts targeting the student, grouped by
 * time and filterable by category. The backend only stores title/body/time, so
 * category, per-item read state, dismiss and mute are all derived/kept locally
 * (see `lib/notificationCenter.ts`). Opening the screen still marks everything
 * "seen" so the header bell dot clears.
 */
export default function NotificationsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduce = useReduceMotion();
  const router = useRouter();
  const { token } = useAuth();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<ChipKey>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    // Restore local read / dismissed / muted state FIRST, independent of the
    // network — so an API error never drops the user's read state (which would
    // make everything look unread again after leaving and returning).
    const [read, dis, mut] = await Promise.all([
      notifStore.loadRead(),
      notifStore.loadDismissed(),
      notifStore.loadMuted(),
    ]);
    setReadIds(read);
    setMuted(mut);

    // Show a list and mark its newest entry "seen" so the home bell dot clears.
    const show = async (list: AppNotification[], keepDismissed: boolean) => {
      setItems(list);
      setDismissed(keepDismissed ? dis : new Set());
      if (list.length > 0) {
        const latest = list.reduce((max, n) => (n.createdAt > max ? n.createdAt : max), list[0].createdAt);
        await markNotificationsSeen(latest);
      }
    };

    try {
      setError(false);
      const list = token ? await getMyNotifications(token) : [];
      // DEV: preview data until real broadcasts exist (see DEV_MOCK_NOTIFICATIONS).
      await (list.length === 0 ? show(DEV_MOCK_NOTIFICATIONS, false) : show(list, true));
    } catch {
      // DEV: still preview the UI even when the API is unreachable.
      if (DEV_MOCK_NOTIFICATIONS.length > 0) {
        await show(DEV_MOCK_NOTIFICATIONS, false);
        setError(false);
      } else {
        setError(true);
      }
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

  // Non-dismissed, non-muted notifications with their derived category.
  const active = useMemo(
    () =>
      items
        .filter((n) => !dismissed.has(n.id))
        .map((n) => ({ notif: n, category: categorize(n) }))
        .filter((x) => !muted.has(x.category)),
    [items, dismissed, muted],
  );

  const unreadCount = useMemo(
    () => active.reduce((sum, x) => (readIds.has(x.notif.id) ? sum : sum + 1), 0),
    [active, readIds],
  );

  // Per-chip counts drive whether we render a chip and its filtered list.
  const rows = useMemo<Row[]>(() => {
    const visible = active
      .filter((x) => filter === 'all' || chipOf(x.category) === filter)
      .sort((a, b) => (a.notif.createdAt < b.notif.createdAt ? 1 : -1));

    const out: Row[] = [];
    let lastBucket: TimeBucket | null = null;
    for (const x of visible) {
      const bucket = bucketOf(x.notif.createdAt);
      if (bucket !== lastBucket) {
        out.push({ kind: 'header', key: `h-${bucket}`, label: t(BUCKET_LABEL[bucket]) });
        lastBucket = bucket;
      }
      out.push({
        kind: 'item',
        key: x.notif.id,
        notif: x.notif,
        category: x.category,
        read: readIds.has(x.notif.id),
      });
    }
    return out;
  }, [active, filter, readIds]);

  const persistRead = useCallback((next: Set<string>) => {
    setReadIds(next);
    notifStore.saveRead(next);
  }, []);

  const markRead = useCallback((id: string) => {
    haptics.select();
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      notifStore.saveRead(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    if (unreadCount === 0) return;
    haptics.success();
    const next = new Set(readIds);
    active.forEach((x) => next.add(x.notif.id));
    persistRead(next);
  }, [active, readIds, unreadCount, persistRead]);

  const dismiss = useCallback((id: string) => {
    haptics.warning();
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      notifStore.saveDismissed(next);
      return next;
    });
  }, []);

  const mute = useCallback((category: NotifCategory) => {
    haptics.warning();
    setMuted((prev) => {
      const next = new Set(prev).add(category);
      notifStore.saveMuted(next);
      return next;
    });
  }, []);

  const open = useCallback((n: AppNotification, category: NotifCategory) => {
    markRead(n.id);
    const meta = metaFor(category, colors);
    if (meta.cta) router.push(meta.cta.href);
  }, [markRead, router, colors]);

  // Long-press context menu (Open · Mark read · Mute type · Delete).
  const openContextMenu = useCallback((n: AppNotification, category: NotifCategory) => {
    haptics.medium();
    Alert.alert(n.title, undefined, [
      { text: t('notifCtxOpen'), onPress: () => open(n, category) },
      { text: t('notifCtxMarkRead'), onPress: () => markRead(n.id) },
      { text: t('notifCtxMute'), onPress: () => mute(category) },
      { text: t('notifCtxDelete'), style: 'destructive', onPress: () => dismiss(n.id) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }, [open, markRead, mute, dismiss]);

  const renderItem = useCallback(({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return <AppText variant="overline" color={colors.textMuted} style={styles.sectionHeader}>{item.label}</AppText>;
    }
    return (
      <NotificationCard
        notif={item.notif}
        category={item.category}
        read={item.read}
        colors={colors}
        reduce={reduce}
        onOpen={open}
        onMarkRead={markRead}
        onDelete={dismiss}
        onLongPress={openContextMenu}
      />
    );
  }, [colors, reduce, styles.sectionHeader, open, markRead, dismiss, openContextMenu]);

  const chips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, bounded]}
    >
      {CHIPS.map((chip) => {
        const selected = filter === chip.key;
        return (
          <PressableScale
            key={chip.key}
            onPress={() => { haptics.select(); setFilter(chip.key); }}
            style={[
              styles.chip,
              { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <AppText variant="label" color={selected ? colors.white : colors.textSecondary}>
              {t(chip.labelKey)}
            </AppText>
          </PressableScale>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header: back · title (+ unread badge) · mark-all-read */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('notifCtxOpen')}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <AppText variant="h1">{t('notifications')}</AppText>
          {unreadCount > 0 ? (
            <Animated.View
              key={unreadCount}
              entering={reduce ? undefined : ZoomIn.duration(200)}
              style={[styles.countBadge, { backgroundColor: colors.primary }]}
            >
              <AppText variant="caption" color={colors.white} style={styles.countText}>{unreadCount}</AppText>
            </Animated.View>
          ) : null}
        </View>

        {unreadCount > 0 ? (
          <PressableScale
            onPress={markAllRead}
            style={styles.markAll}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('markAllRead')}
          >
            <Ionicons name="checkmark-done" size={16} color={colors.primary} />
            <AppText variant="label" color={colors.primary}>{t('markAllRead')}</AppText>
          </PressableScale>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={92} radius={radius.xl} style={{ marginBottom: spacing.md }} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t('notificationsError')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: () => { setLoading(true); load().finally(() => setLoading(false)); } }}
        />
      ) : rows.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.emptyScroll, bounded]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filter === 'all' ? null : chips}
          <EmptyState
            icon="notifications-outline"
            title={t('notifCaughtTitle')}
            hint={t('notifCaughtHint')}
          />
          <View style={styles.emptyCta}>
            <Button
              label={t('notifContinueLearning')}
              icon="rocket"
              fullWidth={false}
              onPress={() => router.push('/(tabs)/lessons')}
            />
          </View>
        </ScrollView>
      ) : (
        <Animated.FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          ListHeaderComponent={chips}
          itemLayoutAnimation={reduce ? undefined : LinearTransition.duration(220)}
          contentContainerStyle={[styles.list, bounded]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          removeClippedSubviews
          initialNumToRender={10}
          windowSize={11}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 48,
    gap: spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  countBadge: {
    minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontWeight: '800' },
  markAll: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    backgroundColor: c.primarySoft,
  },

  // Chips
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chip: {
    height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.full,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },

  // List
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  sectionHeader: { marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase' },

  // Card
  cardOuter: { marginBottom: spacing.md },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    ...elevation.sm,
  },
  cardUnread: {
    backgroundColor: c.primarySoft,
    borderColor: c.primary,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: radius.full, marginTop: 6 },
  body: { marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
  },

  // Swipe actions (sized to the card's height by ReanimatedSwipeable)
  actions: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.sm },
  action: {
    width: 72, alignSelf: 'stretch',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderRadius: radius.lg,
  },

  // Empty
  emptyScroll: { flexGrow: 1 },
  emptyCta: { alignItems: 'center', marginTop: spacing.lg },
});
