import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { typography, colors } from '../theme/theme';
import { useColors } from '../settings/SettingsContext';

type Variant = keyof typeof typography;

interface Props extends TextProps {
  /** Semantic type role — drives size, line-height and weight together. */
  variant?: Variant;
  /** Override color without leaving the token system. */
  color?: string;
  center?: boolean;
}

/**
 * The single text primitive. Screens pick a *role* (`h1`, `body`, `caption`)
 * instead of a raw size + weight, so hierarchy stays consistent everywhere.
 * Style overrides still work for one-off tweaks (margins, etc.).
 *
 * The default color comes from the ACTIVE theme (light/dark) so every piece of
 * text that doesn't set an explicit `color` flips automatically. Muted roles
 * (caption/overline) use the muted ink.
 */
export function AppText({ variant = 'body', color, center, style, ...rest }: Props) {
  const c = useColors();
  const muted = variant === 'caption' || variant === 'overline';
  const override: TextStyle = { color: color ?? (muted ? c.textMuted : c.text) };
  if (center) override.textAlign = 'center';
  return <RNText style={[typography[variant], override, style]} {...rest} />;
}

export { colors };
