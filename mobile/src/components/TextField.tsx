import { useState, type ComponentType } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props extends TextInputProps {
  label?: string;
  /** Leading icon shown inside the field (e.g. mail, lock, person). */
  leftIcon?: IconName;
  /** When the field is a password, show an eye toggle to reveal the text. */
  secureToggle?: boolean;
  /**
   * Swap the underlying input (defaults to RN `TextInput`). Pass
   * `BottomSheetTextInput` when used inside a @gorhom bottom sheet so the sheet
   * lifts above the keyboard on focus.
   */
  InputComponent?: ComponentType<TextInputProps>;
}

/** Labeled text input with brand styling, optional left icon + password reveal. */
export function TextField({
  label,
  leftIcon,
  secureToggle,
  secureTextEntry,
  InputComponent = TextInput,
  ...rest
}: Props) {
  const [hidden, setHidden] = useState(true);
  const isSecure = secureToggle ? hidden : secureTextEntry;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.field}>
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={colors.textMuted}
            style={styles.leftIcon}
          />
        ) : null}
        <InputComponent
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isSecure}
          {...rest}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={styles.eye}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
  },
  leftIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    height: '100%',
  },
  eye: { paddingLeft: spacing.sm },
});
