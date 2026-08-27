import { Pressable, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { SelectMark } from './SelectMark';
import { spacing } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

/**
 * Шошготой чагт (ж: «Сануулах»).
 *
 * Тэмдэг нь `SelectMark` — апп даяар нэг л хэлбэртэй байхын тулд. Урьд нь
 * энэ файл өөрийн дөрвөлжин хайрцгийг зурдаг байсан тул жагсаалтын чагтууд
 * (`QuestionPicker`, сурагч сонгох) шинэчлэгдэхэд ганцаараа хоцордог байв.
 */
export function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  const colors = useColors();
  return (
    <Pressable style={styles.row} onPress={onToggle} hitSlop={6}>
      <SelectMark state={checked ? 'on' : 'off'} size={20} />
      <AppText variant="caption" color={colors.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
