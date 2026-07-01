import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/** Centered loading spinner. Reused by data-fetching screens. */
export function Loading() {
  const c = useColors();
  return (
    <View style={[styles.center, { backgroundColor: c.surface }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
