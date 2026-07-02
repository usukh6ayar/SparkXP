import { ReactNode, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { SkeletonRows } from './SkeletonRows';
import { EmptyState } from './EmptyState';
import { t } from '../i18n';
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

/** Items with no сэдэв fall under this bucket. */
const NO_TOPIC = 'Бусад';

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
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

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
  }, [items]);

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
              const t = tints[TINT_CYCLE[i % TINT_CYCLE.length]];
              return (
                <Pressable
                  key={cat}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                  onPress={() => onSelectCat(cat)}
                >
                  <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
                    <Ionicons name="folder-open" size={20} color={t.fg} />
                  </View>
                  <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>{cat}</AppText>
                  <AppText variant="caption" color={c.textMuted}>{list.length}</AppText>
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
            const t = tints[TINT_CYCLE[i % TINT_CYCLE.length]];
            return (
              <Pressable
                key={it.id}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                onPress={() => onOpen(it.id)}
              >
                <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
                  <Ionicons name={itemIcon} size={20} color={t.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3" numberOfLines={1}>{it.title}</AppText>
                  {it.subtitle ? <AppText variant="caption">{it.subtitle}</AppText> : null}
                </View>
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
    empty: { marginTop: spacing.xxl },
    skeleton: { marginTop: spacing.xs },
    pressed: { opacity: 0.85 },
  });
