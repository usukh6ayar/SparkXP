import { useMemo, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';

/**
 * Centered dialog shell — dimmed backdrop + rounded card.
 *
 * The app had this same backdrop/card pair copy-pasted into every sheet; it
 * lives here once so they can't drift apart. Screens supply only the contents.
 *
 * `dismissable` false makes the dialog blocking (backdrop tap and Android back
 * do nothing) — for decisions the user genuinely has to make, like being out
 * of hearts.
 */
export function SheetModal({
  visible,
  onClose,
  dismissable = true,
  children,
}: {
  visible: boolean;
  /** Called on backdrop tap / Android back. Ignored when `dismissable` is false. */
  onClose: () => void;
  dismissable?: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const dismiss = dismissable ? onClose : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss} disabled={!dismissable}>
        {/* Swallows taps so pressing inside the card never dismisses it. */}
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
    },
  });
