import { type ReactNode } from 'react';
import { View, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../settings/SettingsContext';

/**
 * Full-screen modal with correct safe-area padding on every device.
 *
 * WHY THIS EXISTS: the `SafeAreaView` *component* from safe-area-context reads
 * ZERO insets inside a React Native `<Modal>` (its native provider isn't in the
 * modal's separate view tree), so a header/TopBar ends up jammed under the
 * status bar / notch. The `useSafeAreaInsets()` *hook* works because React
 * context crosses the modal boundary — so we pad manually with it here.
 *
 * Use this for any full-screen modal instead of `<Modal> + <SafeAreaView>` so
 * new modals are safe-area-correct by default.
 */
export function ModalScreen({
  visible,
  onClose,
  children,
  animationType = 'slide',
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  animationType?: 'slide' | 'fade' | 'none';
}) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <Modal visible={visible} animationType={animationType} onRequestClose={onClose}>
      <View
        style={[
          styles.fill,
          { backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
