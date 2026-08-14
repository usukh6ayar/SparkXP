import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { ProgressBar } from '../ProgressBar';
import { t } from '../../i18n';
import { spacing, radius, progressGradients, skillGradients } from '../../theme/theme';
import { useColors } from '../../settings/SettingsContext';

/**
 * "Үргэлжлүүлэх" — the passage the reader last stopped inside, on top of the
 * reading list.
 *
 * Reading is the one section a student leaves halfway through, and until now
 * the only way back in was to remember which сэдэв it was filed under. Same
 * shape as Home's continue card on purpose: one card, the title, how far in,
 * and a way straight back to that page.
 */
export function ContinueReading({
  title,
  share,
  onPress,
}: {
  title: string;
  /** How much of the passage is read, 0..1. */
  share: number;
  onPress: () => void;
}) {
  const c = useColors();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={skillGradients.reading}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.body}>
        <AppText variant="overline" color={c.textOnDarkMuted}>
          {t('readingContinue').toUpperCase()}
        </AppText>
        <AppText variant="h3" color={c.white} numberOfLines={2}>
          {title}
        </AppText>
        <ProgressBar
          value={share}
          gradient={progressGradients.onHero}
          track="rgba(255,255,255,0.28)"
          height={6}
          style={styles.bar}
        />
        <AppText variant="caption" color={c.textOnDarkMuted}>
          {Math.round(share * 100)}% {t('readingReadShare')}
        </AppText>
      </View>
      <View style={styles.arrow}>
        <Ionicons name="arrow-forward" size={20} color={c.white} />
      </View>
    </Pressable>
  );
}

// No theme colours here on purpose: the card sits on its own gradient, so its
// ink is white in both themes.
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  body: { flex: 1, gap: 4 },
  bar: { marginTop: 4 },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
