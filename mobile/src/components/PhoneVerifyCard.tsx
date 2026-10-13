import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../settings/SettingsContext';
import { radius, spacing, type AppColors } from '../theme/theme';
import { t } from '../i18n';
import { AppText } from './Text';
import { Button } from './Button';
import { codeFromSmsUri, platformSmsUri } from '../lib/smsUri';
import type { PhoneVerification } from '../lib/usePhoneVerification';

/**
 * The SMS step shared by sign-up, SMS login, password reset, the phone gate and
 * phone linking. Shows the code as an outgoing message bubble to 144773, the
 * verify.mn instruction VERBATIM (it names the number the SMS must come from —
 * sending from another SIM is the #1 failure), and a one-tap «SMS илгээх».
 *
 * `onRestart` gets a fresh session (new code) after expiry.
 */
export function PhoneVerifyCard({
  verification,
  onRestart,
}: {
  verification: PhoneVerification;
  onRestart: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { state, session, secondsLeft } = verification;
  if (!session) return null;

  const code = codeFromSmsUri(session.smsUri);
  const waiting = state === 'waiting';
  const expired = state === 'expired';
  const verified = state === 'verified';
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="chatbubble-outline" size={20} color={c.glow} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color={c.textMuted}>{t('phoneRecipient')}</AppText>
          <AppText variant="h3">144773</AppText>
        </View>
        {waiting ? <AppText variant="bodyStrong" color={c.textSecondary}>{`${mm}:${ss}`}</AppText> : null}
      </View>

      <View style={styles.bubbleRow}>
        {expired ? (
          <View style={[styles.bubble, styles.bubbleDead]}>
            <AppText style={[styles.code, styles.codeDead]}>{code}</AppText>
          </View>
        ) : (
          <LinearGradient colors={c.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
            <AppText style={styles.code}>{code}</AppText>
          </LinearGradient>
        )}
        <AppText
          variant="label"
          color={verified ? c.success : expired ? c.danger : c.textSecondary}
          accessibilityLiveRegion="polite"
        >
          {verified ? t('phoneVerified') : expired ? t('phoneExpired') : t('phoneWaiting')}
        </AppText>
      </View>

      {waiting ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, (secondsLeft / 300) * 100)}%` }]} />
        </View>
      ) : null}

      {waiting ? (
        <AppText variant="body" color={c.textSecondary}>{session.displayInstruction}</AppText>
      ) : expired ? (
        <AppText variant="body" color={c.textSecondary}>{t('phoneExpiredBody')}</AppText>
      ) : null}

      {waiting ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            label={t('phoneSendSms')}
            icon="send"
            onPress={() => Linking.openURL(platformSmsUri(session.smsUri))}
          />
          <AppText variant="caption" center color={c.textMuted}>{t('phoneSmsCost')}</AppText>
        </View>
      ) : null}

      {expired ? <Button label={t('phoneNewCode')} icon="refresh" variant="secondary" onPress={onRestart} /> : null}
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      gap: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatar: {
      width: 44, height: 44, borderRadius: radius.full,
      backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center',
    },
    bubbleRow: { alignItems: 'flex-end', gap: spacing.xs },
    bubble: {
      paddingVertical: 14, paddingHorizontal: 22,
      borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6,
    },
    bubbleDead: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong },
    code: {
      fontFamily: 'Manrope_800ExtraBold', fontSize: 34, lineHeight: 40, letterSpacing: 6,
      color: c.white, fontVariant: ['tabular-nums'],
    },
    codeDead: { color: c.lockedInk, textDecorationLine: 'line-through' },
    track: { height: 4, borderRadius: radius.full, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.full, backgroundColor: c.glow },
  });
