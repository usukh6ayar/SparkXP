import { useMemo, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet } from 'react-native';
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
 *
 * **Keyboard:** a sheet with a text field (account deletion asks for the
 * password again) had its input hidden behind the keyboard on iOS, which does
 * not shrink the window for it the way Android does — the card stayed centred
 * on the full screen and the field sat under the keys. The
 * `KeyboardAvoidingView` shrinks the area so the card re-centres in what is
 * left, and `maxHeight` keeps a tall card inside it instead of running off both
 * ends. Content that needs to give way should shrink itself (see
 * `DeleteAccountSheet`).
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
      {/* Android already resizes the window for the keyboard, so it needs no
          behaviour here — setting one would move the card twice. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={dismiss} disabled={!dismissable}>
          {/* Swallows taps so pressing inside the card never dismisses it. */}
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    fill: { flex: 1 },
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
      // Never taller than the (keyboard-shrunk) backdrop: a centred card that
      // overflows loses BOTH ends off-screen, taking the buttons with it.
      maxHeight: '100%',
      backgroundColor: c.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
    },
  });
