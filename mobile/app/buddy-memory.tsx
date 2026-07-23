import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/auth/AuthContext';
import { useSettings } from '../src/settings/SettingsContext';
import { AppText } from '../src/components/Text';
import { getBuddyMemory, clearBuddyMemory, type BuddyMemory } from '../src/api/ai';
import { colors, spacing, radius, tints } from '../src/theme/theme';
import type { TranslationKey } from '../src/i18n';
import { bounded } from '../src/theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;
type Tint = { bg: string; fg: string };

/** Maps a backend memoryType to a label key + tinted icon. Unknown → neutral. */
const TYPE_META: Record<string, { key: TranslationKey; icon: IconName; tint: Tint }> = {
  interest: { key: 'memInterest', icon: 'heart', tint: tints.pink },
  goal: { key: 'memGoal', icon: 'flag', tint: tints.blue },
  mistake_pattern: { key: 'memMistake', icon: 'alert-circle', tint: tints.coral },
  preference: { key: 'memPreference', icon: 'star', tint: tints.amber },
  level: { key: 'memLevel', icon: 'trending-up', tint: tints.green },
};

/**
 * "AI Buddy санах ой" — lets a student see everything their voice Buddy has
 * remembered about them (interests, goals, mistakes…) and wipe it. Backend keeps
 * only a filtered long-term memory; the clear-all endpoint forgets it entirely.
 */
export default function BuddyMemoryScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme, palette: p, t } = useSettings();

  const [items, setItems] = useState<BuddyMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(false);
      setItems(await getBuddyMemory(token));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(theme === 'dark' ? 'light' : 'dark');
      load();
    }, [load, theme]),
  );

  /** Export (share) the buddy's memory as plain text — data-portability (doc §8). */
  const exportMemory = async () => {
    if (items.length === 0) {
      Alert.alert(t('exportMemory'), t('memoryEmptyExport'));
      return;
    }
    const body = items
      .map((m) => {
        const label = TYPE_META[m.memoryType] ? t(TYPE_META[m.memoryType].key) : m.memoryType;
        return `• ${m.value} (${label})`;
      })
      .join('\n');
    try {
      await Share.share({ title: t('buddyMemory'), message: `${t('buddyMemory')}\n\n${body}` });
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  };

  const confirmClear = () => {
    Alert.alert(t('clearMemoryConfirm'), t('clearMemoryConfirmBody'), [
      { text: t('cancel') },
      {
        text: t('clearMemory'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          setClearing(true);
          try {
            await clearBuddyMemory(token);
            setItems([]);
          } catch {
            Alert.alert(t('errorFallback'));
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: p.bgFlat }]}>
      <LinearGradient colors={p.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={p.text} />
          </Pressable>
          <AppText variant="h2" color={p.text}>{t('buddyMemory')}</AppText>
          <Pressable onPress={exportMemory} hitSlop={8} style={styles.backBtn} accessibilityLabel={t('exportMemory')}>
            <Ionicons name="share-outline" size={22} color={p.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.container, bounded]} showsVerticalScrollIndicator={false}>
          <AppText variant="caption" color={p.textMuted} style={styles.sub}>{t('buddyMemorySub')}</AppText>

          {loading ? (
            <ActivityIndicator color={p.primary} style={{ marginTop: spacing.xxl }} />
          ) : error ? (
            <Empty p={p} icon="cloud-offline-outline" title={t('buddyMemoryError')}
              action={{ label: t('retry'), onPress: () => { setLoading(true); load(); } }} />
          ) : items.length === 0 ? (
            <Empty p={p} icon="sparkles-outline" title={t('buddyMemoryEmpty')} hint={t('buddyMemoryEmptyHint')} />
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
                {items.map((m, i) => {
                  const meta = TYPE_META[m.memoryType];
                  return (
                    <View key={m.id}>
                      {i > 0 ? <View style={[styles.divider, { backgroundColor: p.divider }]} /> : null}
                      <View style={styles.row}>
                        <View style={[styles.rowIcon, { backgroundColor: meta?.tint.bg ?? p.track }]}>
                          <Ionicons name={meta?.icon ?? 'ellipse'} size={18} color={meta?.tint.fg ?? p.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <AppText variant="body" color={p.text}>{m.value}</AppText>
                          {meta ? (
                            <AppText variant="caption" color={p.textMuted}>{t(meta.key)}</AppText>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Pressable
                onPress={confirmClear}
                disabled={clearing}
                style={({ pressed }) => [styles.clearBtn, { borderColor: colors.danger }, pressed && styles.pressed]}
              >
                {clearing ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <AppText variant="bodyStrong" color={colors.danger}>{t('clearMemory')}</AppText>
                  </>
                )}
              </Pressable>
            </>
          )}

          {/* Data-privacy / consent note (doc §8) */}
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={p.textMuted} />
            <AppText variant="caption" color={p.textMuted} style={{ flex: 1 }}>{t('memoryPrivacyNote')}</AppText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** Centered empty / error state with an optional retry action. */
function Empty({
  p, icon, title, hint, action,
}: {
  p: ReturnType<typeof useSettings>['palette']; icon: IconName; title: string;
  hint?: string; action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color={p.textMuted} />
      <AppText variant="bodyStrong" color={p.text} style={styles.emptyTitle}>{title}</AppText>
      {hint ? <AppText variant="caption" color={p.textMuted} style={styles.emptyHint}>{hint}</AppText> : null}
      {action ? (
        <Pressable onPress={action.onPress} style={({ pressed }) => [styles.retry, { backgroundColor: p.primary }, pressed && styles.pressed]}>
          <AppText variant="bodyStrong" color={colors.white}>{action.label}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  sub: { marginBottom: spacing.md, marginLeft: 4 },

  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginLeft: 62 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 13 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1,
  },

  privacyNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    marginTop: spacing.xl, paddingHorizontal: spacing.xs,
  },

  empty: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.xs },
  emptyTitle: { marginTop: spacing.md },
  emptyHint: { textAlign: 'center', marginTop: 2 },
  retry: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.full },

  pressed: { opacity: 0.7 },
});
