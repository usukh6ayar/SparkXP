import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing } from '../theme/theme';

/**
 * Shared scrollable screen wrapper that handles the keyboard and padding.
 * Used by auth screens so the layout isn't duplicated. `centered` vertically
 * centers the content (login/register); turn off for top-aligned screens.
 */
export function Screen({
  children,
  centered = false,
}: {
  children: ReactNode;
  centered?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, centered && styles.centered]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: spacing.lg },
  centered: { justifyContent: 'center' },
});
