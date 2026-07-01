import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, fontSize } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props extends TextInputProps {
  label?: string;
  /** Leading icon shown inside the field (e.g. mail, lock, person). */
  leftIcon?: IconName;
  /** When the field is a password, show an eye toggle to reveal the text. */
  secureToggle?: boolean;
}

/** Labeled text input with brand styling, optional left icon + password reveal. */
export function TextField({
  label,
  leftIcon,
  secureToggle,
  secureTextEntry,
  ...rest
}: Props) {
  const c = useColors();
  const [hidden, setHidden] = useState(true);
  const isSecure = secureToggle ? hidden : secureTextEntry;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: c.navy }]}>{label}</Text> : null}
      <View style={[styles.field, { borderColor: c.border, backgroundColor: c.surfaceAlt }]}>
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={c.textMuted}
            style={styles.leftIcon}
          />
        ) : null}
        <TextInput
          style={[styles.input, { color: c.text }]}
          placeholderTextColor={c.textMuted}
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
              color={c.textMuted}
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
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  leftIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    height: '100%',
  },
  eye: { paddingLeft: spacing.sm },
});
