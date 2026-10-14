import { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/auth/AuthContext';
import { useSettings } from '../src/settings/SettingsContext';
import { AppText } from '../src/components/Text';
import { getBuddyUsage, getBuddyAvailability, type BuddyUsageBlock } from '../src/api/ai';
import { getMyPlan, type PlanInfo } from '../src/api/users';
import { PlanPass } from '../src/components/PlanPass';
import { colors, spacing, radius, type PremiumPalette } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/**
 * "Миний багц" — the plan the user is on and this month's usage.
 * Informational only: plans are bought outside the app, and App Store rule
 * 3.1.1 rejects an app that shows prices or upsells for things it can't sell
 * in-app — so no tier list, no prices, no buy button or link. Keep it that way.
 */
export default function PlanScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { palette: p, t } = useSettings();

  const [usage, setUsage] = useState<{ voice: BuddyUsageBlock; stt: BuddyUsageBlock } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // The plan the user is actually on (from GET /users/me/plan).
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  // The AI Buddy usage meters only make sense while the feature is open.
  // Fails closed → hidden (see `getBuddyAvailability`).
  const [buddyEnabled, setBuddyEnabled] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    // The plan is a separate call from usage — a usage failure shouldn't hide
    // which plan you're on, so it keeps its own try/catch.
    getMyPlan(token)
      .then(setPlanInfo)
      .catch(() => {});

    // Skip the usage fetch entirely when the buddy is closed — the meters it
    // feeds aren't rendered, so it would be a request for nothing.
    const on = await getBuddyAvailability(token);
    setBuddyEnabled(on);
    if (!on) {
      setLoading(false);
      return;
    }
    try {
      setError(false);
      setUsage(await getBuddyUsage(token));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // (The status bar is handled app-wide in `app/_layout.tsx`.)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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

          {/* The plan the user is on, as the same pass the website shows. */}
          {planInfo ? (
            <PlanPass
              planName={planInfo.planName}
              until={planInfo.isFree ? null : planInfo.expiresAt}
              limits={planInfo.limits ? { voice: planInfo.limits.voiceMinutes, stt: planInfo.limits.sttMinutes } : null}
              active={!planInfo.isFree && (!planInfo.expiresAt || Date.parse(planInfo.expiresAt) > Date.now())}
            />
          ) : null}

          {/* This month's usage. Both meters count AI Buddy time, so while the
              feature is closed they can only ever read "0 / 25 мин" — hide them
              rather than show a quota for something nobody can spend. */}
          {buddyEnabled ? (
            <>
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
            </>
          ) : null}

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

  note: { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.md },

});
