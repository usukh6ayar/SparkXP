import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { getReadingList, type ReadingPassage } from '../../src/api/reading';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Loading } from '../../src/components/Loading';
import { colors, spacing, radius, tints } from '../../src/theme/theme';

type TintName = keyof typeof tints;

// Row visuals cycle through a palette so the list stays lively.
const TINT_CYCLE: TintName[] = ['green', 'amber', 'pink', 'purple', 'blue', 'teal', 'orange'];

/** Passages with no сэдэв fall under this bucket. */
const NO_TOPIC = 'Бусад';

/**
 * Reading (Унших материал), two levels:
 *   1) Сэдэв (category) list — the topics authored in admin.
 *   2) The passages inside the chosen сэдэв → open the reader (/reading/[id]).
 * Categories are derived from the passages' `category` field, so mobile always
 * matches whatever сэдэв admin created (no hardcoded taxonomy).
 */
export default function ReadingListScreen() {
  const { token } = useAuth();
  const router = useRouter();

  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) { setPassages([]); return; }
    try {
      const r = await getReadingList(token);
      setPassages(r.items);
    } catch (e) {
      console.warn('Reading load failed:', (e as Error)?.message ?? e);
      setPassages([]);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Group passages by сэдэв (category), preserving first-seen order.
  const categories = useMemo(() => {
    const map = new Map<string, ReadingPassage[]>();
    for (const p of passages) {
      const cat = p.category?.trim() || NO_TOPIC;
      const list = map.get(cat) ?? [];
      list.push(p);
      map.set(cat, list);
    }
    return Array.from(map.entries()); // [ [cat, passages], ... ]
  }, [passages]);

  const shown = selectedCat
    ? passages.filter((p) => (p.category?.trim() || NO_TOPIC) === selectedCat)
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        title={selectedCat ?? 'Унших материал'}
        back
        showBadges={false}
        // When inside a сэдэв, Back returns to the сэдэв list, not off-screen.
        onBack={selectedCat ? () => setSelectedCat(null) : undefined}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <Loading />
        ) : passages.length === 0 ? (
          <AppText variant="body" color={colors.textMuted} center style={styles.empty}>
            Унших материал алга 🦊
          </AppText>
        ) : selectedCat === null ? (
          /* Level 1 — сэдэв (category) list */
          <>
            <AppText variant="h2" style={styles.sectionTitle}>Сэдэв сонгох</AppText>
            <View style={styles.listCard}>
              {categories.map(([cat, list], i) => {
                const t = tints[TINT_CYCLE[i % TINT_CYCLE.length]];
                return (
                  <Pressable
                    key={cat}
                    style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                    onPress={() => setSelectedCat(cat)}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
                      <Ionicons name="folder-open" size={20} color={t.fg} />
                    </View>
                    <AppText variant="h3" style={{ flex: 1 }} numberOfLines={1}>{cat}</AppText>
                    <AppText variant="caption" color={colors.textMuted}>{list.length}</AppText>
                    <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          /* Level 2 — passages inside the chosen сэдэв */
          <View style={styles.listCard}>
            {shown.map((p, i) => {
              const t = tints[TINT_CYCLE[i % TINT_CYCLE.length]];
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.pressed]}
                  onPress={() => router.push(`/reading/${p.id}`)}
                >
                  <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
                    <Ionicons name="book" size={20} color={t.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" numberOfLines={1}>{p.title}</AppText>
                    <AppText variant="caption">
                      {p.cefr?.toUpperCase()} · {p.wordCount} үг · ~{Math.max(1, Math.round(p.estimatedReadingTime / 60))} мин
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  sectionTitle: { marginBottom: spacing.md },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: spacing.xxl },
  pressed: { opacity: 0.85 },
});
