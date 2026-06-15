import { View, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * A brand-tinted rounded icon chip.
 * - Pass `image` (a require()'d PNG) to show a 3D glossy icon (mascot style).
 * - Otherwise pass an Ionicons `icon` name for a flat tinted glyph.
 * The tinted rounded square sits behind both, so the visual language stays
 * coherent whether we use an image or a vector glyph.
 */
export function IconTile({
  icon,
  image,
  bg,
  fg,
  size = 48,
  iconSize,
}: {
  icon?: IconName;
  image?: ImageSourcePropType;
  bg: string;
  fg: string;
  size?: number;
  iconSize?: number;
}) {
  const inner = iconSize ?? size * 0.5;
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius.md, backgroundColor: bg },
      ]}
    >
      {image ? (
        <Image
          source={image}
          style={{ width: size * 0.74, height: size * 0.74 }}
          resizeMode="contain"
        />
      ) : (
        <Ionicons name={icon!} size={inner} color={fg} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
