import { View, Text, StyleSheet } from 'react-native';
import { Link, type Href } from 'expo-router';
import { colors, spacing, fontSize } from '../theme/theme';

/** "Prompt + link" row at the bottom of the auth screens (login ↔ register). */
export function AuthFooter({
  prompt,
  linkLabel,
  href,
}: {
  prompt: string;
  linkLabel: string;
  href: Href;
}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.text}>{prompt} </Text>
      <Link href={href} style={styles.link}>
        {linkLabel}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  text: { color: colors.textMuted, fontSize: fontSize.md },
  link: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
});
