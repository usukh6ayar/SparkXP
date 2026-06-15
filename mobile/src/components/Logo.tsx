import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, fontSize, spacing } from '../theme/theme';

// The running-fox brand mark. Lives in assets/ so it ships with the app bundle.
const logoMark = require('../../assets/logo.png');

/**
 * SparkXP logo: the running-fox brand mark above the "SparkXP" wordmark.
 * - `lg` (default) is for the auth/splash screens; `md` for tighter headers.
 * - `wordmarkOnly` drops the fox mark + tagline (compact header use).
 * - `align` controls horizontal alignment (default centered).
 */
export function Logo({
  size = 'lg',
  wordmarkOnly = false,
  align = 'center',
}: {
  size?: 'md' | 'lg';
  wordmarkOnly?: boolean;
  align?: 'center' | 'left';
}) {
  const big = size === 'lg';
  const mark = big ? 132 : 84;
  return (
    <View style={[styles.wrap, align === 'left' && styles.left]}>
      {wordmarkOnly ? null : (
        <Image
          source={logoMark}
          style={{ width: mark, height: mark }}
          resizeMode="contain"
          accessibilityLabel="SparkXP"
        />
      )}
      <Text style={[styles.word, { fontSize: big ? fontSize.xxl : fontSize.xl }]}>
        Spark<Text style={{ color: colors.primary }}>XP</Text>
      </Text>
      {big && !wordmarkOnly ? (
        <Text style={styles.tagline}>Суралц • Дадлага • Амжилт</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  left: { alignItems: 'flex-start' },
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
