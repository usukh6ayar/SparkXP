import { useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { haptics } from '../lib/haptics';
import { useColors } from '../settings/SettingsContext';
import { t } from '../i18n';
import { spacing, radius } from '../theme/theme';

/**
 * Wraps a list row so dragging it left reveals a Delete button (the gesture
 * everyone already knows from Mail/Messages).
 *
 * Deliberately NOT delete-on-full-swipe: these rows are the student's saved
 * vocabulary, and a list you can wipe with a careless flick is worse than one
 * that takes two taps. The swipe reveals; the tap commits.
 */
export function SwipeToDelete({
  onDelete,
  label,
  children,
}: {
  onDelete: () => void;
  /** Screen-reader label for the revealed button (what is being deleted). */
  label?: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  const ref = useRef<SwipeableMethods>(null);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            haptics.tap();
            ref.current?.close();
            onDelete();
          }}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: c.danger },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={label ?? t('delete')}
        >
          <Ionicons name="trash" size={20} color={c.white} />
          <AppText variant="caption" color={c.white}>{t('delete')}</AppText>
        </Pressable>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 84,
    marginLeft: spacing.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pressed: { opacity: 0.85 },
});
