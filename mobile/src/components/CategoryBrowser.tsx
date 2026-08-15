import { ReactNode, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { SkeletonRows } from './SkeletonRows';
import { EmptyState } from './EmptyState';
import { t, tf } from '../i18n';
import { haptics } from '../lib/haptics';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, tints, type AppColors } from '../theme/theme';
import { bounded } from '../theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;
type TintName = keyof typeof tints;

/** One row of content, labelled by its сэдэв (`category`). */
export type BrowserItem = {
  id: string;
  title: string;
  subtitle?: string;
  category: string | null;
};

// Row visuals cycle through a palette so lists stay lively.
const TINT_CYCLE: TintName[] = ['green', 'amber', 'pink', 'purple', 'blue', 'teal', 'orange'];

/**
 * The content list shared by Reading and the skill/IELTS exercise screens.
 *
 * It used to be a **two-level browser**: tap a сэдэв, then tap an item. That
 * meant three taps from Home to start anything, and the middle screen carried no
 * information you could not have shown in a header — you had to walk into a
 * folder to find out it held two exercises. Worse, going back to try a different
 * one meant leaving the list entirely.
 *
 * Now everything is on one screen: the items are always visible, and the сэдэв
 * become **filter chips** that narrow the list in place. Two taps from Home to
 * an exercise, and switching сэдэв costs one tap with no navigation at all.
 */
export function CategoryBrowser({
  items,
  loading,
  refreshing,
  onRefresh,
  error,
  onRetry,
  onOpen,
  hero,
  itemIcon = 'book',
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
  onOpen: (id: string) => void;
  hero?: ReactNode;
  itemIcon?: IconName;
  emptyText?: string;
  /** When set, rows show completion state (a check per item). Opt-in. */
  completedIds?: Set<string>;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  /** Active сэдэв filter; null = show everything. */
  const [filter, setFilter] = useState<string | null>(null);

  // Items with no сэдэв fall under this bucket (follows the app language).
  const NO_TOPIC = t('otherTopic');
  const topicOf = (it: BrowserItem) => it.category?.trim() || NO_TOPIC;

  /** Distinct сэдэв in first-seen order, with their counts. */
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      const key = it.category?.trim() || NO_TOPIC;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [items, NO_TOPIC]);

  const shown = filter ? items.filter((it) => topicOf(it) === filter) : items;

  return (
    <ScrollView
      contentContainerStyle={[styles.container, bounded]}
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
      ) : (
        <>
          {/* Filter chips — only when there is something to choose between. */}
          {topics.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <Chip
                label={t('allTopics')}
                count={items.length}
                active={filter === null}
                onPress={() => { haptics.select(); setFilter(null); }}
                styles={styles}
                c={c}
              />
              {topics.map(([topic, count]) => (
                <Chip
                  key={topic}
                  label={topic}
                  count={count}
                  active={filter === topic}
                  onPress={() => { haptics.select(); setFilter(filter === topic ? null : topic); }}
                  styles={styles}
                  c={c}
                />
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.listCard}>
            {shown.map((it, i) => {
              const tint = tints[TINT_CYCLE[i % TINT_CYCLE.length]];
              const isDone = completedIds?.has(it.id) ?? false;
              // The сэдэв travels on the row itself rather than as a section
              // header — one line each, and it stays visible while filtering.
              const topic = topics.length > 1 && filter === null ? topicOf(it) : null;
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
                    <AppText variant="caption" color={c.textMuted} numberOfLines={1}>
                      {[topic, it.subtitle].filter(Boolean).join(' · ')}
                    </AppText>
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

          {completedIds ? (
            <AppText variant="caption" color={c.textMuted} center style={styles.footer}>
              {tf('doneCountLabel', {
                done: shown.filter((it) => completedIds.has(it.id)).length,
                total: shown.length,
              })}
            </AppText>
          ) : null}
        </>
      )}

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

/** One сэдэв filter. */
function Chip({
  label, count, active, onPress, styles, c,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  styles: Styles;
  c: AppColors;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <AppText variant="caption" color={active ? c.white : c.textSecondary} style={styles.chipText}>
        {label}
      </AppText>
      <AppText variant="caption" color={active ? c.textOnDarkMuted : c.textMuted}>
        {count}
      </AppText>
    </Pressable>
  );
}

type Styles = ReturnType<typeof makeStyles>;

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
    chips: { gap: spacing.xs, paddingBottom: spacing.md },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipOn: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontWeight: '700' },
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
    doneTag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
    doneTagText: { fontWeight: '700' },
    footer: { marginTop: spacing.sm },
    empty: { marginTop: spacing.xxl },
    skeleton: { marginTop: spacing.xs },
    pressed: { opacity: 0.85 },
  });
