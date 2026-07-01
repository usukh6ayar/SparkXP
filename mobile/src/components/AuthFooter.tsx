import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link, type Href } from 'expo-router';
import { colors, spacing, fontSize } from '../theme/theme';

/**
 * "Prompt + link" row at the bottom of the auth screens (login ↔ register).
 * Pass `href` to navigate to another route, or `onPress` for an in-place
 * action (e.g. opening the sign-in bottom sheet without leaving the screen).
 */
export function AuthFooter({
  prompt,
  linkLabel,
  href,
  onPress,
}: {
  prompt: string;
  linkLabel: string;
  href?: Href;
  onPress?: () => void;
}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.text}>{prompt} </Text>
      {href ? (
        <Link href={href} style={styles.link}>
          {linkLabel}
        </Link>
      ) : (
        <Pressable onPress={onPress} hitSlop={8}>
          <Text style={styles.link}>{linkLabel}</Text>
        </Pressable>
      )}
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
