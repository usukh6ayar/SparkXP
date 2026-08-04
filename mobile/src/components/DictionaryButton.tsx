import type { ViewStyle } from 'react-native';
import { IconButton } from './IconButton';
import { useDictionary } from './DictionaryProvider';
import { t } from '../i18n';

/**
 * Opens the dictionary panel (search field inside it, ready to type).
 *
 * It belongs to the five main tabs only — Home, Lessons, AI buddy, Quiz,
 * Profile. Deeper screens are focused flows and don't carry it.
 */
export function DictionaryButton({
  size = 40,
  iconSize = 20,
  iconColor,
  variant = 'surface',
  style,
}: {
  size?: number;
  iconSize?: number;
  iconColor?: string;
  variant?: 'surface' | 'filled';
  style?: ViewStyle;
}) {
  const { openSearch } = useDictionary();
  return (
    <IconButton
      icon="search"
      size={size}
      iconSize={iconSize}
      iconColor={iconColor}
      variant={variant}
      style={style}
      accessibilityLabel={t('searchEnglishWord')}
      onPress={() => openSearch()}
    />
  );
}
