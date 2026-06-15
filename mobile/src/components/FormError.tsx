import { Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../theme/theme';

/** Shows a form error message, or nothing when there's no error. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
});
