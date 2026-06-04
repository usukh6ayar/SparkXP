import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing } from '../theme/theme';

/**
 * SparkXP wordmark. Text-based for now (🦊 + "Spark"+"XP"). Drop the real logo
 * at assets/logo.png and swap this for an <Image> when ready.
 */
export function Logo({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <View style={styles.wrap}>
      <Text style={{ fontSize: big ? 60 : 40 }}>🦊</Text>
      <Text style={[styles.word, { fontSize: big ? fontSize.xxl : fontSize.xl }]}>
        Spark<Text style={{ color: colors.primary }}>XP</Text>
      </Text>
      {big ? <Text style={styles.tagline}>Суралц • Дадлага • Амжилт</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  word: {
    fontWeight: '800',
    color: colors.navy,
    marginTop: spacing.xs,
    letterSpacing: 0.5,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    letterSpacing: 1,
  },
});
