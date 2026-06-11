import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

/** Centered loading spinner. Reused by data-fetching screens. */
export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
});
