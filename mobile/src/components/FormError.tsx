import { Text, StyleSheet } from 'react-native';
import { useColors } from '../settings/SettingsContext';
import { spacing, fontSize, type AppColors } from '../theme/theme';

/** Shows a form error message, or nothing when there's no error. */
export function FormError({ message }: { message?: string | null }) {
  const c = useColors();
  if (!message) return null;
  return <Text style={makeStyles(c).error}>{message}</Text>;
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  error: {
    color: c.danger,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
});
