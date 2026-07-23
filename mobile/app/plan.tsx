import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/auth/AuthContext';
import { useSettings } from '../src/settings/SettingsContext';
import { AppText } from '../src/components/Text';
import { getBuddyUsage, type BuddyUsageBlock } from '../src/api/ai';
import { colors, spacing, radius, type PremiumPalette } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';
import type { TranslationKey } from '../src/i18n';

/**
 * "Миний багц" — plan, this-month usage and limits, per the Premium 56,000₮
 * cost-breakdown doc (§2 limits, §7 positioning). Usage bars read the live
 * voice/STT counters (getBuddyUsage); the plan comparison is static content.
 * Upgrade is a stub until the QPay/web payment backend ships.
 */
export default function PlanScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme, palette: p, t } = useSettings();

  const [usage, setUsage] = useState<{ voice: BuddyUsageBlock; stt: BuddyUsageBlock } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Which plan the user has tapped (premium is pre-selected as the recommended
  // option). Payment is still a stub, so this only drives the visual selection.
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'premium'>('premium');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(false);
      setUsage(await getBuddyUsage(token));
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

  return (
    <View style={[styles.root, { backgroundColor: p.bgFlat }]}>
      <LinearGradient colors={p.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={p.text} />
          </Pressable>
          <AppText variant="h2" color={p.text}>{t('planTitle')}</AppText>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={[styles.container, bounded]} showsVerticalScrollIndicator={false}>
          <AppText variant="caption" color={p.textMuted} style={styles.sub}>{t('planSubtitle')}</AppText>

          {/* This month's usage */}
          <AppText variant="bodyStrong" color={p.text} style={styles.groupTitle}>{t('planUsageTitle')}</AppText>
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
            {loading ? (
              <ActivityIndicator color={p.primary} style={{ paddingVertical: spacing.lg }} />
            ) : error ? (
              <AppText variant="caption" color={colors.danger} style={styles.usageError}>{t('planUsageError')}</AppText>
            ) : usage ? (
              <>
                <UsageRow p={p} icon="mic-outline" label={t('planVoiceLabel')} block={usage.voice} unlimitedLabel={t('planUsageUnlimited')} unitMin={t('unitMin')} />
                <View style={[styles.divider, { backgroundColor: p.divider }]} />
                <UsageRow p={p} icon="chatbubble-ellipses-outline" label={t('planSttLabel')} block={usage.stt} unlimitedLabel={t('planUsageUnlimited')} unitMin={t('unitMin')} />
              </>
            ) : null}
          </View>

          {/* Plan comparison (§7) */}
          <AppText variant="bodyStrong" color={p.text} style={styles.groupTitle}>{t('planPlansTitle')}</AppText>

          <PlanCard
            p={p} name={t('planStandardName')} price={t('planStandardPrice')}
            features={['planStdVoice', 'planStdDict', 'planStdMemory']} t={t}
            selected={selectedPlan === 'standard'} onPress={() => setSelectedPlan('standard')}
          />

          <PlanCard
            p={p} name={t('planPremiumName')} price={t('planPremiumPrice')} recommended={t('planRecommended')}
            features={['planPremVoice', 'planPremDict', 'planPremMemory', 'planPremBuddies', 'planPremSparks']} t={t}
            selected={selectedPlan === 'premium'} onPress={() => setSelectedPlan('premium')}
          />

          <Pressable
            onPress={() => Alert.alert(t('planUpgrade'), t('planUpgradeSoon'))}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upgradeBtn}>
              <AppText style={styles.crown}>👑</AppText>
              <AppText variant="bodyStrong" color={colors.white}>{t('planUpgrade')}</AppText>
            </LinearGradient>
          </Pressable>

          <AppText variant="caption" color={p.textMuted} style={styles.note}>{t('planFairUseNote')}</AppText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** One usage meter: "3.5 / 25 мин" + a fill bar tinted by the warn tier. */
function UsageRow({
  p, icon, label, block, unlimitedLabel, unitMin,
}: {
  p: PremiumPalette; icon: keyof typeof Ionicons.glyphMap; label: string;
  block: BuddyUsageBlock; unlimitedLabel: string; unitMin: string;
}) {
  const usedMin = block.voice_seconds_used_this_month / 60;
  const limitSec = block.voice_seconds_limit_this_month;
  const barColor =
    block.warn_level === 'warn95' ? colors.danger : block.warn_level === 'warn80' ? colors.warning : p.primary;
  const value = limitSec == null
    ? `${usedMin.toFixed(1)} ${unitMin} · ${unlimitedLabel}`
    : `${usedMin.toFixed(1)} / ${Math.round(limitSec / 60)} ${unitMin}`;
  const fraction = limitSec && limitSec > 0 ? Math.min(usedMin / (limitSec / 60), 1) : 0;

  return (
    <View style={styles.usageRow}>
      <View style={styles.usageHead}>
        <View style={styles.usageLabel}>
          <Ionicons name={icon} size={16} color={barColor} />
          <AppText variant="body" color={p.text}>{label}</AppText>
        </View>
        <AppText variant="caption" color={p.textMuted}>{value}</AppText>
      </View>
      <View style={[styles.track, { backgroundColor: p.track }]}>
        <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

/** A selectable plan card: name, price, feature bullets, optional "recommended"
 *  tag. Tapping selects it (radio dot + primary border show the choice). */
function PlanCard({
  p, name, price, features, recommended, selected, onPress, t,
}: {
  p: PremiumPalette; name: string; price: string; features: TranslationKey[];
  recommended?: string; selected?: boolean; onPress?: () => void; t: (k: TranslationKey) => string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        { backgroundColor: p.card, borderColor: selected ? p.primary : p.cardBorder, borderWidth: selected ? 2 : 1 },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.planHead}>
        <View style={styles.planNameRow}>
          <Ionicons
            name={selected ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={selected ? p.primary : p.textMuted}
          />
          <AppText variant="h3" color={p.text}>{name}</AppText>
        </View>
        {recommended ? (
          <View style={[styles.tag, { backgroundColor: p.primary }]}>
            <AppText variant="label" color={colors.white}>{recommended}</AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="bodyStrong" color={p.primary} style={styles.price}>{price}</AppText>
      {features.map((f) => (
        <View key={f} style={styles.feature}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <AppText variant="body" color={p.textSecondary} style={{ flex: 1 }}>{t(f)}</AppText>
        </View>
      ))}
    </Pressable>
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

  sub: { marginBottom: spacing.lg, marginLeft: 4 },
  groupTitle: { marginBottom: spacing.sm, marginLeft: 4, marginTop: spacing.md },

  card: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  usageError: { paddingVertical: spacing.md, textAlign: 'center' },
  divider: { height: 1, marginVertical: spacing.xs },

  usageRow: { paddingVertical: spacing.md, gap: spacing.sm },
  usageHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  usageLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },

  planCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.xs },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  price: { marginBottom: spacing.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },

  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg,
  },
  crown: { fontSize: 18 },
  note: { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },

  pressed: { opacity: 0.85 },
});
