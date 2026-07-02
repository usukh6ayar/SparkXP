import { View, Pressable, Share, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { AppText } from './Text';
import { t, tf } from '../i18n';
import { buildJoinLink } from '../lib/joinLink';
import { colors, spacing, radius, elevation } from '../theme/theme';

/**
 * Prominent join panel: a QR code + the human-typable code, with a Share
 * button — the ways teachers add students. The QR encodes the join code so a
 * future student scanner can read it directly (students can also type it).
 */
export function JoinCodeCard({ code, className }: { code: string; className?: string }) {
  async function onShare() {
    await Share.share({
      message: `${className ? className + ' — ' : ''}${tf('joinShareBody', { code })}\n${buildJoinLink(code)}`,
    });
  }

  return (
    <View style={styles.card}>
      <AppText variant="overline" color={colors.textOnDarkMuted}>
        {t('joinCode').toUpperCase()}
      </AppText>

      <View style={styles.qrBox}>
        {/* QR ink must be dark on the white box. NOTE: `colors.navy` is white in
            the dark theme, so use a guaranteed-dark colour for scannability. */}
        <QRCode value={buildJoinLink(code)} size={140} backgroundColor={colors.white} color="#18244A" />
      </View>

      <AppText variant="display" color={colors.white} style={styles.code}>
        {code}
      </AppText>
      <AppText variant="caption" color={colors.textOnDarkMuted} style={styles.hint}>
        {t('joinCodeHint')}
      </AppText>

      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={onShare}
      >
        <Ionicons name="share-social" size={18} color={colors.primary} />
        <AppText variant="bodyStrong" color={colors.primary}>
          {t('shareCode')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...(elevation.float as object),
  },
  qrBox: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  code: { letterSpacing: 6, marginTop: spacing.md },
  hint: { textAlign: 'center', marginTop: 4, marginBottom: spacing.lg },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
