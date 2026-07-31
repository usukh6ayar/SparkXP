import { useMemo, useState } from 'react';
import { View, StyleSheet, SectionList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { useSWR } from '../src/api/useSWR';
import {
  getAchievements,
  setPinnedTrophies,
  ACHIEVEMENTS_PATH,
  MAX_PINNED,
  type Trophy,
  type AchievementsResponse,
} from '../src/api/achievements';
import { AppImage } from '../src/components/AppImage';
import { AppText } from '../src/components/Text';
import { TopBar } from '../src/components/TopBar';
import { SheetModal } from '../src/components/SheetModal';
import { Button } from '../src/components/Button';
import { EmptyState } from '../src/components/EmptyState';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { ProgressBar } from '../src/components/ProgressBar';
import { PressableScale } from '../src/components/PressableScale';
import { describeCondition, tierLabel } from '../src/lib/trophyCondition';
import { haptics } from '../src/lib/haptics';
import { toast } from '../src/components/Toast';
import { t, tf } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../src/theme/theme';

/** Grid density. 3 across reads well from phone-small up to tablet width. */
const COLUMNS = 3;

type Filter = 'all' | 'earned' | 'locked';

const FILTERS: { key: Filter; labelKey: 'trophyFilterAll' | 'trophyFilterEarned' | 'trophyFilterLocked' }[] = [
  { key: 'all', labelKey: 'trophyFilterAll' },
  { key: 'earned', labelKey: 'trophyFilterEarned' },
  { key: 'locked', labelKey: 'trophyFilterLocked' },
];

/**
 * The full 100-badge trophy collection, grouped by tier.
 *
 * Everything comes from GET /achievements — the catalog, the earned flags and
 * the image URLs. Trophy names stay English (the backend catalog is the single
 * source of truth for them); only the surrounding UI and the unlock conditions
 * are Mongolian.
 */
export default function TrophiesScreen() {
  const { token } = useAuth();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Trophy | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Pinned slugs, held locally so the sheet reacts instantly; the server is the
  // source of truth and `refetch()` reconciles right after the write.
  const [pinned, setPinned] = useState<string[] | null>(null);
  const [pinning, setPinning] = useState(false);

  const { data, loading, refetch } = useSWR<AchievementsResponse>(
    ACHIEVEMENTS_PATH,
    () => getAchievements(token!),
    { enabled: Boolean(token) },
  );

  // One section per tier, in the server's low→high order. Tiers left empty by
  // the active filter are dropped so the list never shows a bare header.
  const sections = useMemo(() => {
    if (!data) return [];
    const visible = data.trophies.filter((tr) =>
      filter === 'all' ? true : filter === 'earned' ? tr.earned : !tr.earned,
    );
    return data.tiers
      .map((tier) => {
        const rows = visible.filter((tr) => tr.tier === tier);
        const earned = rows.filter((tr) => tr.earned).length;
        return { tier, title: tierLabel(tier), earned, total: rows.length, data: chunk(rows) };
      })
      .filter((s) => s.total > 0);
  }, [data, filter]);

  const pinnedSlugs = pinned ?? data?.pinned ?? [];

  /**
   * Pin or unpin one trophy. The API takes the WHOLE set, so build the next set
   * here and send it — that keeps the display order explicit.
   */
  async function togglePin(trophy: Trophy) {
    if (!token || pinning) return;
    const isPinned = pinnedSlugs.includes(trophy.slug);
    if (!isPinned && pinnedSlugs.length >= MAX_PINNED) {
      haptics.warning();
      toast.error(tf('trophyPinFull', { n: MAX_PINNED }));
      return;
    }
    const next = isPinned
      ? pinnedSlugs.filter((slug) => slug !== trophy.slug)
      : [...pinnedSlugs, trophy.slug];
    setPinned(next);
    setPinning(true);
    haptics.tap();
    try {
      await setPinnedTrophies(next, token);
      await refetch();
    } catch {
      setPinned(pinnedSlugs); // roll back to what the server last confirmed
      toast.error(t('errorGeneric'));
    } finally {
      setPinning(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function open(trophy: Trophy) {
    haptics.tap();
    setSelected(trophy);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <TopBar title={t('trophies')} back showBadges={false} />

      {loading && !data ? (
        <SkeletonRows count={6} />
      ) : !data ? (
        <EmptyState
          icon="trophy-outline"
          title={t('trophies')}
          hint={t('errorGeneric')}
          action={{ label: t('retry'), onPress: () => void refetch() }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.map((tr) => tr.slug).join('|')}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.hero}>
              <AppText variant="display">{data.earned}</AppText>
              <AppText variant="caption" color={c.textMuted}>
                {tf('trophyProgress', { earned: data.earned, total: data.total })}
              </AppText>
              <ProgressBar value={data.total ? data.earned / data.total : 0} style={styles.heroBar} />
              <AppText variant="caption" color={c.textMuted} center style={styles.heroHint}>
                {tf('trophyPinHint', { n: MAX_PINNED })}
              </AppText>
              <View style={styles.filters}>
                {FILTERS.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressable
                      key={f.key}
                      onPress={() => { haptics.tap(); setFilter(f.key); }}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <AppText variant="label" color={on ? c.primary : c.textSecondary}>
                        {t(f.labelKey)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="trophy-outline"
              title={t('trophyNone')}
              hint={data.earned === 0 ? t('trophyFirstHint') : ''}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHead}>
              <AppText variant="h3">{section.title}</AppText>
              <AppText variant="caption" color={c.textMuted}>
                {section.earned}/{section.total}
              </AppText>
            </View>
          )}
          renderItem={({ item: row }) => (
            <View style={styles.row}>
              {row.map((tr) => (
                <TrophyCell
                  key={tr.slug}
                  trophy={tr}
                  pinned={pinnedSlugs.includes(tr.slug)}
                  styles={styles}
                  c={c}
                  onPress={() => open(tr)}
                />
              ))}
              {/* Keeps the last, short row left-aligned instead of spread out. */}
              {padding(row.length).map((k) => (
                <View key={k} style={styles.cell} />
              ))}
            </View>
          )}
        />
      )}

      <TrophyDetail
        trophy={selected}
        pinned={selected ? pinnedSlugs.includes(selected.slug) : false}
        onTogglePin={togglePin}
        busy={pinning}
        onClose={() => setSelected(null)}
        styles={styles}
        c={c}
      />
    </SafeAreaView>
  );
}

/** One badge in the grid. Always uses `thumb` — see api/achievements.ts. */
function TrophyCell({
  trophy, pinned, styles, c, onPress,
}: { trophy: Trophy; pinned: boolean; styles: Styles; c: AppColors; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.cell}>
      <View style={[styles.badge, !trophy.earned && styles.badgeLocked]}>
        <AppImage
          source={trophy.thumb}
          width={128}
          contentFit="contain"
          style={[styles.badgeImg, !trophy.earned && styles.badgeImgLocked]}
        />
        {!trophy.earned ? (
          <View style={styles.lockDot}>
            <Ionicons name="lock-closed" size={12} color={c.textMuted} />
          </View>
        ) : pinned ? (
          <View style={styles.lockDot}>
            <Ionicons name="bookmark" size={12} color={c.primary} />
          </View>
        ) : null}
      </View>
      <AppText
        variant="caption"
        center
        numberOfLines={2}
        color={trophy.earned ? c.text : c.textMuted}
        style={styles.cellLabel}
      >
        {trophy.name}
      </AppText>
    </PressableScale>
  );
}

/** Detail sheet: the big 640px image plus earned date or unlock condition. */
function TrophyDetail({
  trophy, pinned, onTogglePin, busy, onClose, styles, c,
}: {
  trophy: Trophy | null;
  pinned: boolean;
  onTogglePin: (trophy: Trophy) => void;
  busy: boolean;
  onClose: () => void;
  styles: Styles;
  c: AppColors;
}) {
  return (
    <SheetModal visible={Boolean(trophy)} onClose={onClose}>
      {trophy ? (
        <View style={styles.detail}>
          <AppImage
            source={trophy.image}
            width={320}
            contentFit="contain"
            style={[styles.detailImg, !trophy.earned && styles.badgeImgLocked]}
          />
          <AppText variant="h2" center>{trophy.name}</AppText>
          <AppText variant="label" color={c.textMuted} center>{tierLabel(trophy.tier)}</AppText>

          {trophy.earned ? (
            <View style={styles.detailNote}>
              <Ionicons name="checkmark-circle" size={18} color={c.success} />
              <AppText variant="body" color={c.textSecondary}>
                {trophy.earnedAt
                  ? tf('trophyEarnedOn', { date: new Date(trophy.earnedAt).toLocaleDateString() })
                  : t('trophyFilterEarned')}
              </AppText>
            </View>
          ) : (
            <View style={styles.detailLocked}>
              <AppText variant="overline" color={c.textMuted}>{t('trophyHowTo')}</AppText>
              <AppText variant="bodyStrong" center>{describeCondition(trophy.condition)}</AppText>
            </View>
          )}

          {pinned ? (
            <View style={styles.detailNote}>
              <Ionicons name="bookmark" size={18} color={c.primary} />
              <AppText variant="body" color={c.textSecondary}>{t('trophyPinned')}</AppText>
            </View>
          ) : null}

          {/* Only an earned trophy can be pinned — there is nothing to show off
              about a locked one. */}
          {trophy.earned ? (
            <Button
              label={pinned ? t('trophyUnpin') : t('trophyPin')}
              variant={pinned ? 'secondary' : 'primary'}
              icon={pinned ? 'bookmark' : 'bookmark-outline'}
              loading={busy}
              onPress={() => onTogglePin(trophy)}
              style={styles.detailBtn}
            />
          ) : null}
          <Button label={t('close')} variant="ghost" onPress={onClose} style={styles.detailBtn} />
        </View>
      ) : null}
    </SheetModal>
  );
}

/** Split a flat list into fixed-width rows so SectionList can render a grid. */
function chunk(items: Trophy[]): Trophy[][] {
  const rows: Trophy[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) rows.push(items.slice(i, i + COLUMNS));
  return rows;
}

/** Filler keys for the empty cells of a short final row. */
function padding(used: number): string[] {
  return Array.from({ length: COLUMNS - used }, (_, i) => `pad${i}`);
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  heroBar: { alignSelf: 'stretch', marginTop: spacing.sm },
  heroHint: { marginTop: spacing.xs },
  filters: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, backgroundColor: c.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
  },
  chipOn: { backgroundColor: c.primarySoft, borderColor: c.primary },

  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },

  row: { flexDirection: 'row', gap: spacing.sm },
  cell: { flex: 1, alignItems: 'center', marginBottom: spacing.md },
  badge: {
    width: '100%', aspectRatio: 1, borderRadius: radius.lg,
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border, overflow: 'hidden',
  },
  badgeLocked: { backgroundColor: c.surfaceAlt, borderColor: 'transparent' },
  badgeImg: { width: '82%', height: '82%' },
  // Locked badges stay recognisable (so the goal is visible) but clearly dimmed.
  badgeImgLocked: { opacity: 0.28 },
  lockDot: {
    position: 'absolute', right: spacing.xs, bottom: spacing.xs,
    width: 22, height: 22, borderRadius: radius.full,
    backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
  },
  cellLabel: { marginTop: spacing.xs },

  detail: { alignItems: 'center', gap: spacing.xs },
  detailImg: { width: 160, height: 160, marginBottom: spacing.sm },
  detailNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  detailLocked: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  detailBtn: { alignSelf: 'stretch', marginTop: spacing.lg },
});
