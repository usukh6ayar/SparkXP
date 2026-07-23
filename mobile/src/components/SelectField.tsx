import { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { radius, spacing, fontSize, elevation, type AppColors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

interface Props {
  label: string;
  placeholder: string;
  value?: string;
  options: string[];
  onSelect: (value: string) => void;
}

/**
 * Labeled dropdown — taps expand the options INLINE, in a floating card directly
 * under the field (not a bottom-sheet modal). The panel pushes the content below
 * it down and scrolls internally past ~5 rows, so it never gets clipped or covers
 * the field. Selected row is tinted + ticked; the chevron flips while open.
 */
export function SelectField({
  label,
  placeholder,
  value,
  options,
  onSelect,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.field, open && styles.fieldOpen]}
        onPress={() => setOpen((v) => !v)}
      >
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={open ? colors.primary : colors.textMuted}
          style={open && styles.chevronOpen}
        />
      </Pressable>

      {open ? (
        // Two layers: outer carries the shadow (iOS clips a view's own shadow
        // when it also has overflow:hidden), inner clips the rows to the corners.
        <Animated.View entering={FadeIn.duration(140)} style={[styles.dropdownShadow, elevation.md]}>
          <ScrollView
            style={styles.dropdown}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {options.map((item, i) => {
              const selected = value === item;
              return (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.option,
                    i > 0 && styles.optionBorder,
                    selected && styles.optionSelectedRow,
                    pressed && styles.optionPressed,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[styles.optionText, selected && styles.optionTextSelected]}
                    numberOfLines={1}
                  >
                    {item}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.navy,
    marginBottom: spacing.xs,
  },
  field: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Highlight the field while its dropdown is open.
  fieldOpen: { borderColor: colors.primary, backgroundColor: colors.surface },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  value: { fontSize: fontSize.md, color: colors.text, flex: 1, marginRight: spacing.sm },
  placeholder: { color: colors.textMuted },
  // Floating card below the field — outer shadow layer, inner clips the rows.
  dropdownShadow: {
    marginTop: 6,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  // ~5 rows tall before the list scrolls internally (keeps long lists — e.g.
  // 21 provinces — from pushing the rest of the form far down). overflow:hidden
  // clips the rows to the rounded corners.
  dropdown: {
    maxHeight: 5 * 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  option: {
    minHeight: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  optionSelectedRow: { backgroundColor: colors.primarySoft },
  optionPressed: { backgroundColor: colors.surfaceAlt },
  optionText: { fontSize: fontSize.md, color: colors.text, flex: 1, marginRight: spacing.sm },
  optionTextSelected: { color: colors.primary, fontWeight: '700' },
});
