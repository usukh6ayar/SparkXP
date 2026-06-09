import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { typography, colors } from '../theme/theme';

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
 */
export function AppText({ variant = 'body', color, center, style, ...rest }: Props) {
  const override: TextStyle = {};
  if (color) override.color = color;
  if (center) override.textAlign = 'center';
  return <RNText style={[typography[variant], override, style]} {...rest} />;
}

export { colors };
