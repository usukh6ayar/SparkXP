import { View, Pressable, Share, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { t } from '../i18n';
import { colors, spacing, radius, elevation } from '../theme/theme';

/** Prominent join-code panel with a Share button — the way teachers add students. */
export function JoinCodeCard({ code, className }: { code: string; className?: string }) {
  async function onShare() {
    await Share.share({
      message: `${className ? className + ' — ' : ''}SparkXP анги нэгдэх код: ${code}`,
    });
  }

  return (
    <View style={styles.card}>
      <AppText variant="overline" color={colors.textOnDarkMuted}>
        {t('joinCode').toUpperCase()}
      </AppText>
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
  code: { letterSpacing: 6, marginTop: 4 },
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
