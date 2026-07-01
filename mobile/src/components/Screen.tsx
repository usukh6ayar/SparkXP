import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/**
 * Shared scrollable screen wrapper that handles safe-area insets, the keyboard
 * and padding. Used by auth screens so the layout isn't duplicated. `centered`
 * vertically centers the content (login/register); off for top-aligned screens.
 * Background follows the active theme.
 */
export function Screen({
  children,
  centered = false,
}: {
  children: ReactNode;
  centered?: boolean;
}) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg },
  centered: { justifyContent: 'center' },
});
