import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../src/auth/AuthContext';
import { getMyReferral, type MyReferral } from '../../src/api/referrals';
import { buildInviteLink } from '../../src/lib/referralLink';
import { AppText } from '../../src/components/Text';
import { TopBar } from '../../src/components/TopBar';
import { t, tf } from '../../src/i18n';
import { colors, spacing, radius, elevation, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';
import { bounded } from '../../src/theme/responsive';

/**
 * "Invite friends" screen — the user's referral code as a QR + share link, plus
 * a running tally of the XP/Sparks they've earned from referrals. Reached from
 * the profile Rewards tile and the invite deep-link route.
 *
 * The short referral code comes from the backend; until it loads (or if the
 * endpoint isn't live yet) we fall back to the username, which the backend also
 * accepts as a referral code — so the invite card always works.
 */
export default function InviteScreen() {
  const screenColors = useColors();
  const styles = useMemo(() => makeStyles(screenColors), [screenColors]);
  const { token, user } = useAuth();
  const [data, setData] = useState<MyReferral | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(() => {
    if (!token) return;
    setStatus('loading');
    getMyReferral(token)
      .then((d) => {
        setData(d);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // The backend always returns a generated referral code; username is a fallback
  // so the card still works if the stats request fails but we know the username.
  const code = data?.referralCode || user?.username || '';

  async function onShare() {
    if (!code) return;
    await Share.share({ message: `${tf('inviteBody', { code })}\n${buildInviteLink(code)}` });
  }

  const STEPS = [t('inviteStep1'), t('inviteStep2'), t('inviteStep3')];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('inviteFriends')} back showBadges={false} />
      <ScrollView contentContainerStyle={[styles.container, bounded]} showsVerticalScrollIndicator={false}>
        <AppText variant="body" center color={screenColors.textSecondary} style={styles.subtitle}>
          {t('inviteSubtitle')}
        </AppText>

        {/* Invite card — QR + code + share */}
        <View style={styles.card}>
          <AppText variant="overline" color={colors.textOnDarkMuted}>
            {t('inviteCode').toUpperCase()}
          </AppText>
          <View style={styles.qrBox}>
            {code ? (
              <QRCode value={buildInviteLink(code)} size={150} backgroundColor={colors.white} color="#18244A" />
            ) : (
              <View style={styles.qrPlaceholder}>
                {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
              </View>
            )}
          </View>
          <AppText variant="h2" color={colors.white} style={styles.code}>{code || '—'}</AppText>

          {/* Error → retry; otherwise the normal hint + share button. */}
          {!code && status === 'error' ? (
            <>
              <AppText variant="caption" color={colors.textOnDarkMuted} center style={styles.hint}>
                {t('inviteLoadError')}
              </AppText>
              <Pressable
                style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
                onPress={load}
              >
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <AppText variant="bodyStrong" color={colors.primary}>{t('retry')}</AppText>
              </Pressable>
            </>
          ) : (
            <>
              <AppText variant="caption" color={colors.textOnDarkMuted} center style={styles.hint}>
                {t('inviteHint')}
              </AppText>
              <Pressable
                style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
                onPress={onShare}
                disabled={!code}
              >
                <Ionicons name="share-social" size={18} color={colors.primary} />
                <AppText variant="bodyStrong" color={colors.primary}>{t('shareInvite')}</AppText>
              </Pressable>
            </>
          )}
        </View>

        {/* Reward tally — only once the backend stats have loaded */}
        {data ? (
          <View style={styles.statsCard}>
            <Stat st={styles} value={data.invitedCount} label={t('invitedCount')} color={screenColors.primary} icon="people" />
            <View style={styles.statDivider} />
            <Stat st={styles} value={data.totalXpEarned} label={t('referralXpEarned')} color={colors.xp} icon="star" />
            <View style={styles.statDivider} />
            <Stat st={styles} value={data.totalSparksEarned} label={t('referralSparksEarned')} color={colors.sparks} icon="diamond" />
          </View>
        ) : null}

        {/* How it works */}
        <AppText variant="h3" color={screenColors.text} style={styles.howTitle}>{t('inviteHowTitle')}</AppText>
        {STEPS.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <AppText variant="label" color={colors.white}>{i + 1}</AppText>
            </View>
            <AppText variant="body" color={screenColors.textSecondary} style={{ flex: 1 }}>{step}</AppText>
          </View>
        ))}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** One reward-tally column. */
function Stat({ st, value, label, color, icon }: {
  st: ReturnType<typeof makeStyles>; value: number; label: string; color: string; icon: keyof typeof Ionicons.glyphMap;
}) {
  const screenColors = useColors();
  return (
    <View style={st.stat}>
      <Ionicons name={icon} size={20} color={color} />
      <AppText variant="h3" color={screenColors.text}>{value}</AppText>
      <AppText variant="caption" color={screenColors.textMuted} center numberOfLines={2}>{label}</AppText>
    </View>
  );
}

const makeStyles = (colorsX: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colorsX.background },
  container: { padding: spacing.lg },
  subtitle: { marginBottom: spacing.lg },

  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...(elevation.float as object),
  },
  qrBox: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  qrPlaceholder: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  code: { letterSpacing: 3, marginTop: spacing.md },
  hint: { marginTop: 4, marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.xl,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },

  statsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colorsX.surface, borderRadius: radius.xl,
    paddingVertical: spacing.lg, marginTop: spacing.lg,
    borderWidth: 1, borderColor: colorsX.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  statDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colorsX.border },

  howTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
