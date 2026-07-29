import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius } from '../theme/theme';
import { t } from '../i18n';
import type { HeartsState } from '../api/hearts';

/**
 * Compact hearts indicator for the quiz header: a heart icon + the current
 * count. The value is whatever the server last reported — never counted on the
 * client. Premium (`unlimited`) is handled by the caller, which hides this bar
 * entirely, so there is no infinity state to draw here.
 */
export function HeartsBar({ hearts }: { hearts: HeartsState }) {
  const c = useColors();
  const empty = hearts.hearts <= 0;
  return (
    <View
      style={[styles.wrap, { backgroundColor: c.dangerSoft }]}
      accessibilityLabel={`${t('heartsLabel')}: ${hearts.hearts}`}
    >
      <Ionicons name={empty ? 'heart-dislike' : 'heart'} size={16} color={c.danger} />
      <AppText variant="bodyStrong" color={c.danger}>{hearts.hearts}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
