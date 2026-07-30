import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { ProgressBar } from './ProgressBar';
import { tf } from '../i18n';
import { spacing, radius, colors, progressGradients } from '../theme/theme';

/**
 * The "how far through this section am I" banner that opens a browse screen.
 *
 * Every section that lists learnable items (Сонсгол / Бичих / Ярих / Унших /
 * Хэлц үг) shows the SAME thing — a big percentage over the section's own
 * gradient — so one component owns it. Before this, the skill screens had the
 * gradient banner while Унших and Хэлц үг had a plain white ring card, and the
 * app looked like two different products depending on which tile you tapped.
 */
export function ProgressHero({
  eyebrow,
  done,
  total,
  gradient,
  icon,
}: {
  /** Section name, rendered upper-case (e.g. "УНШИХ"). */
  eyebrow: string;
  done: number;
  total: number;
  /** The section's two-stop brand gradient (see `skillGradients`). */
  gradient: readonly [string, string];
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const ratio = total > 0 ? done / total : 0;

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.left}>
        <AppText variant="overline" color="rgba(255,255,255,0.85)">
          {eyebrow.toUpperCase()}
        </AppText>
        <AppText variant="display" color={colors.white} style={styles.percent}>
          {Math.round(ratio * 100)}%
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.9)">
          {tf('doneCountLabel', { done, total })}
        </AppText>
        <ProgressBar
          value={ratio}
          gradient={progressGradients.onHero}
          track="rgba(255,255,255,0.28)"
          height={8}
          style={styles.bar}
        />
      </View>
      <View style={styles.art}>
        <Ionicons name={icon} size={64} color="rgba(255,255,255,0.95)" />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  left: { flex: 1, gap: spacing.xs },
  percent: { fontSize: 48, lineHeight: 52 },
  bar: { marginTop: spacing.xs, marginBottom: spacing.sm },
  art: {
    width: 92,
    height: 92,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
});
