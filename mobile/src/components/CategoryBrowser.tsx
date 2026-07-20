import { ReactNode, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { SkeletonRows } from './SkeletonRows';
import { EmptyState } from './EmptyState';
import { ProgressRing } from './ProgressRing';
import { t, tf } from '../i18n';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, tints, type AppColors } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type TintName = keyof typeof tints;

/** One row of content, bucketed by its сэдэв (`category`). */
export type BrowserItem = {
  id: string;
  title: string;
  subtitle?: string;
  category: string | null;
};

// Row visuals cycle through a palette so lists stay lively.
const TINT_CYCLE: TintName[] = ['green', 'amber', 'pink', 'purple', 'blue', 'teal', 'orange'];


/**
 * Two-level сэдэв browser shared by Reading and the skill exercise screens:
 *   1) сэдэв (category) list — derived from the items' `category`, so it always
 *      matches whatever admin authored (no hardcoded taxonomy).
 *   2) the items inside the chosen сэдэв → `onOpen(id)`.
 * `selectedCat` is controlled by the parent so it can drive the TopBar title +
 * back button (see reading/index.tsx and skill/[key].tsx).
 */
export function CategoryBrowser({
  items,
  loading,
  refreshing,
  onRefresh,
  error,
  onRetry,
  selectedCat,
  onSelectCat,
  onOpen,
  hero,
  itemIcon = 'book',
  selectTitle = t('selectTopic'),
  emptyText = t('noContent'),
  completedIds,
}: {
  items: BrowserItem[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  /** Fetch failed (distinct from a genuinely empty, successful response). */
  error?: boolean;
  onRetry?: () => void;
  selectedCat: string | null;
  onSelectCat: (cat: string | null) => void;
  onOpen: (id: string) => void;
  hero?: ReactNode;
  itemIcon?: IconName;
  selectTitle?: string;
  emptyText?: string;
  /** When set, rows show completion state: a ring per сэдэв + a check per item.
      Opt-in — screens without progress (skill exercises) simply omit it. */
  completedIds?: Set<string>;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Items with no сэдэв fall under this bucket (follows the app language).
  const NO_TOPIC = t('otherTopic');

  // Group items by сэдэв, preserving first-seen order.
  const categories = useMemo(() => {
    const map = new Map<string, BrowserItem[]>();
    for (const it of items) {
      const cat = it.category?.trim() || NO_TOPIC;
      const list = map.get(cat) ?? [];
      list.push(it);
      map.set(cat, list);
    }
    return Array.from(map.entries());
  }, [items, NO_TOPIC]);

  const shown = selectedCat
    ? items.filter((it) => (it.category?.trim() || NO_TOPIC) === selectedCat)
    : [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
    >
      {hero}

      {loading ? (
        <SkeletonRows count={5} style={styles.skeleton} />
      ) : error ? (
        <EmptyState
          icon="alert-circle-outline"
          title={t('error')}
          hint={t('errorGeneric')}
          action={onRetry ? { label: t('retry'), onPress: onRetry } : undefined}
          style={styles.empty}
        />
      ) : items.length === 0 ? (
        <AppText variant="body" color={c.textMuted} center style={styles.empty}>
          {emptyText}
        </AppText>
      ) : selectedCat === null ? (
        /* Level 1 — сэдэв list */
        <>
          <AppText variant="h2" style={styles.sectionTitle}>{selectTitle}</AppText>
          <View style={styles.listCard}>
            {categories.map(([cat, list], i) => {
              const tint = tints[TINT_CYCLE[i % TINT_CYCLE.length]];
              const doneCount = completedIds ? list.filter((it) => completedIds.has(it.id)).length : 0;
              const allDone = completedIds && doneCount === list.length;
              return (
                <Pressable
                  key={cat}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                  onPress={() => onSelectCat(cat)}
                >
                  <View style={[styles.rowIcon, { backgroundColor: allDone ? tints.green.bg : tint.bg }]}>
                    <Ionicons
                      name={allDone ? 'checkmark-circle' : 'folder-open'}
                      size={allDone ? 24 : 20}
                      color={allDone ? tints.green.fg : tint.fg}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" numberOfLines={1}>{cat}</AppText>
                    {completedIds ? (
                      <AppText variant="caption" color={c.textMuted}>
                        {tf('doneCountLabel', { done: doneCount, total: list.length })}
                      </AppText>
                    ) : null}
                  </View>
                  {completedIds ? (
                    <ProgressRing
                      progress={list.length ? doneCount / list.length : 0}
                      size={40}
                      stroke={4}
                      color={allDone ? tints.green.fg : c.primary}
                    >
                      {allDone ? (
                        <Ionicons name="checkmark" size={18} color={tints.green.fg} />
                      ) : (
                        <AppText variant="caption" color={c.text} style={styles.ringLabel}>
                          {Math.round((doneCount / Math.max(1, list.length)) * 100)}
                        </AppText>
                      )}
                    </ProgressRing>
                  ) : (
                    <AppText variant="caption" color={c.textMuted}>{list.length}</AppText>
                  )}
                  <Ionicons name="chevron-forward" size={20} color={c.borderStrong} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        /* Level 2 — items inside the chosen сэдэв */
        <View style={styles.listCard}>
          {shown.map((it, i) => {
            const tint = tints[TINT_CYCLE[i % TINT_CYCLE.length]];
            const isDone = completedIds?.has(it.id) ?? false;
            return (
              <Pressable
                key={it.id}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                onPress={() => onOpen(it.id)}
              >
                <View style={[styles.rowIcon, { backgroundColor: isDone ? tints.green.bg : tint.bg }]}>
                  <Ionicons
                    name={isDone ? 'checkmark-circle' : itemIcon}
                    size={isDone ? 24 : 20}
                    color={isDone ? tints.green.fg : tint.fg}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3" numberOfLines={1}>{it.title}</AppText>
                  {it.subtitle ? <AppText variant="caption">{it.subtitle}</AppText> : null}
                </View>
                {isDone ? (
                  <View style={[styles.doneTag, { backgroundColor: tints.green.bg }]}>
                    <AppText variant="caption" color={tints.green.fg} style={styles.doneTagText}>{t('doneTag')}</AppText>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={20} color={c.borderStrong} />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
    sectionTitle: { marginBottom: spacing.md },
    listCard: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    rowBorder: { borderTopWidth: 1, borderTopColor: c.border },
    rowIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    ringLabel: { fontWeight: '800', fontSize: 11 },
    doneTag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
    doneTagText: { fontWeight: '700' },
    empty: { marginTop: spacing.xxl },
    skeleton: { marginTop: spacing.xs },
    pressed: { opacity: 0.85 },
  });
