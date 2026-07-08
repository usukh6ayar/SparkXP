import { Image, StyleProp, ImageStyle } from 'react-native';
import { appIcons, AppIconName } from '../constants/appIcons';

/**
 * A brand 3D glossy icon (assets/icons) referenced by semantic name.
 *
 * Centralizes rendering so every icon stays crisp: `resizeMode="contain"` and an
 * exact square size (no stretching). Keep `size` small (≤~40) — the source PNGs
 * are low-res, so they blur if blown up. Prefer this over <Image> + require() so
 * the icon↔picture mapping lives only in `appIcons.ts`.
 */
export function AppIcon({
  name,
  size = 24,
  style,
}: {
  name: AppIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={appIcons[name]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
