import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { PressableScale } from './PressableScale';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius } from '../theme/theme';
import { GLASS, GLASS_EDGE } from '../theme/onArt';

/**
 * The CC toggle for the buddy header.
 *
 * On: the brand purple, so "captions are on" reads at a glance. Off: the same
 * glass as every other control resting on the library art — a themed surface
 * here would be a light chip on a dark photograph in light mode.
 */
export function CaptionToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const c = useColors();
  return (
    <PressableScale
      onPress={onToggle}
      style={[styles.btn, on && { backgroundColor: c.primary }]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Closed captions"
      accessibilityState={{ selected: on }}
    >
      <Ionicons name="chatbox-ellipses-outline" size={15} color={c.textOnDark} />
      <AppText variant="label" color={c.textOnDark} style={styles.text}>CC</AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_EDGE,
  },
  text: { letterSpacing: 0.5 },
});
