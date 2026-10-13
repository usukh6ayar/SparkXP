import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useSettings } from '../settings/SettingsContext';
import { radius, spacing } from '../theme/theme';
import { AppText } from './Text';

const logoMark = require('../../assets/logo.webp');

/**
 * The user's plan as a membership pass — the same object the website shows at
 * checkout and on its success page, so buying on the web and seeing it here
 * read as one product. Informational only (no buy button: App Store rules).
 */
export function PlanPass({
  planName,
  until,
  limits,
  active,
}: {
  planName: string;
  /** ISO expiry, or null (free tier / no expiry). */
  until: string | null;
  /**
   * Monthly minutes (null inside = unlimited). Pass null for the free tier: the
   * server reports no limits for it, and printing "unlimited" there would be false.
   */
  limits: { voice: number | null; stt: number | null } | null;
  /** A paid plan that hasn't expired → the «Идэвхтэй» stamp. */
  active: boolean;
}) {
  const { palette: p, t } = useSettings();
  // Theme-aware green: the dark-mode success tint is 1.9:1 on a white card.
  const c = useColors();
  const minutes = (n: number | null) => (n === null ? t('planUsageUnlimited') : `${n} ${t('passMinutes')}`);

  return (
    // 1.5pt gradient ring — the brand's orange→violet, like the website pass.
    <LinearGradient
      colors={['rgba(249,115,22,0.75)', 'rgba(124,92,255,0.15)', 'rgba(124,92,255,0.75)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.ring}
    >
      <View style={[styles.card, { backgroundColor: p.card }]}>
        <View style={styles.body}>
          <View style={styles.brand}>
            <Image source={logoMark} style={styles.logo} />
            <AppText variant="label" color={p.textMuted}>
              SparkXP
            </AppText>
          </View>

          <AppText variant="caption" color={p.textMuted} style={styles.kicker}>
            {t('passPlan')}
          </AppText>
          <AppText style={[styles.planName, { color: p.primaryLight }]} numberOfLines={1}>
            {planName}
          </AppText>

          {limits ? (
            <>
              <View style={styles.row}>
                <Ionicons name="mic-outline" size={16} color={p.primaryLight} />
                <AppText variant="body" color={p.textSecondary}>
                  {t('passVoice')}{' '}
                  <AppText variant="bodyStrong" color={p.text}>
                    {minutes(limits.voice)}
                  </AppText>
                </AppText>
              </View>
              <View style={styles.row}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.streak} />
                <AppText variant="body" color={p.textSecondary}>
                  {t('passStt')}{' '}
                  <AppText variant="bodyStrong" color={p.text}>
                    {minutes(limits.stt)}
                  </AppText>
                </AppText>
              </View>
            </>
          ) : null}
        </View>

        {/* Tear line with a notch cut from each edge — reads as a ticket stub. */}
        <View style={[styles.tear, { borderColor: p.divider }]}>
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: p.bgFlat }]} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: p.bgFlat }]} />
        </View>

        <View style={styles.stub}>
          <AppText variant="caption" color={p.textMuted}>
            {t('passValidUntil')}
          </AppText>
          <AppText style={[styles.date, { color: p.text }]}>
            {until ? until.slice(0, 10).replace(/-/g, '.') : t('passNoExpiry')}
          </AppText>
        </View>

        {active ? (
          <View style={[styles.stamp, { borderColor: c.success }]} accessibilityLabel={t('planActive')}>
            <AppText style={[styles.stampText, { color: c.success }]}>{t('planActive')}</AppText>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const NOTCH = 22;

const styles = StyleSheet.create({
  ring: { borderRadius: radius.xl, padding: 1.5, marginBottom: spacing.lg },
  card: { borderRadius: radius.xl - 1.5, overflow: 'hidden' },
  body: { padding: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logo: { width: 28, height: 28, borderRadius: 8 },
  kicker: { marginTop: spacing.xs },
  planName: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tear: { borderTopWidth: 2, borderStyle: 'dashed', marginHorizontal: 0 },
  notch: {
    position: 'absolute',
    top: -NOTCH / 2 - 1,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
  },
  notchLeft: { left: -NOTCH / 2 },
  notchRight: { right: -NOTCH / 2 },
  stub: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: 2,
  },
  date: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 24,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  stamp: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    borderWidth: 3,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    transform: [{ rotate: '-8deg' }],
  },
  stampText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16 },
});
