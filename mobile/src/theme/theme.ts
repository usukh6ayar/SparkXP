/**
 * SparkXP design system — the single source of truth for the mobile UI.
 *
 * Brand (from the running-fox logo):
 *   Orange = energy / XP / primary actions
 *   Navy   = headings / text / stability
 *   Cream  = warm accent surfaces
 *
 * Everything visual (color, space, radius, type, elevation) comes from here.
 * Screens compose tokens + the shared components — they never hardcode hex,
 * raw pixel spacing, or ad-hoc font sizes. This keeps the whole app coherent
 * and lets us re-skin from one file.
 */
import { Platform, TextStyle } from 'react-native';

export const colors = {
  // Brand
  primary: '#F47B20', // orange (fox + "XP")
  primaryDark: '#D9660F',
  primaryPressed: '#C85D0E',
  primarySoft: '#FDEBDA', // light orange tint (chips, highlights)

  navy: '#16213E', // brand navy — primary text + dark surfaces
  navySoft: '#33406A',

  // Surfaces (light → dark)
  background: '#FFFFFF', // app background
  surface: '#F4F6FA', // subtle cards / inputs (cool)
  surfaceAlt: '#EEF1F7', // pressed / nested surface
  cream: '#FBF4E6', // warm accent surface

  // Text (high → low emphasis)
  text: '#16213E', // navy — primary text
  textSecondary: '#5B6478', // secondary copy
  textMuted: '#8A91A3', // captions, hints, inactive
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#AEB6CC',

  border: '#E6E9F0',
  borderStrong: '#D5DAE5',

  // Semantic
  success: '#1FA463',
  successSoft: '#E6F6EE',
  danger: '#E0383E',
  dangerSoft: '#FCEBEC',
  warning: '#E8A317',

  // Gamification
  xp: '#F47B20', // XP in brand orange
  sparks: '#F4A52A', // Sparks in amber
  streak: '#F2542D', // streak flame red-orange

  white: '#FFFFFF',
};

/** 4pt spacing scale. `lg` (16) is the default screen gutter. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

/** Corner radii — restrained (10–20) for a premium, less "bubbly" feel. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

/**
 * Semantic type scale. Each style pairs size + line-height + weight so screens
 * get correct hierarchy by *intent* (h2, body, caption) instead of hand-picking
 * a number and slapping `fontWeight: '800'` on everything.
 */
export const typography = {
  /** Hero numbers / celebratory headline only. */
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, color: colors.text },
  /** Screen title. */
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, color: colors.text },
  /** Section header. */
  h2: { fontSize: 19, lineHeight: 25, fontWeight: '700' as const, color: colors.text },
  /** Card title / list-row title. */
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '700' as const, color: colors.text },
  /** Default body copy. */
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, color: colors.text },
  /** Emphasized body (button labels, key values inline). */
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const, color: colors.text },
  /** Field labels, chips, small UI text. */
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, color: colors.text },
  /** Captions, hints, secondary metadata. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, color: colors.textMuted },
} satisfies Record<string, TextStyle>;

/**
 * Backward-compatible raw font sizes (still used by a few screens). These are
 * tuned DOWN from the old oversized scale so legacy references also shrink.
 * Prefer `typography.*` in new/edited code.
 */
export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
};

/** Soft elevation presets (iOS shadow + Android elevation). */
export const elevation = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: colors.navy,
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: colors.navy,
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 5 },
    default: {},
  }),
};

/** Soft tint pairs (bg + foreground) for category / game / icon tiles. */
export const tints = {
  green: { bg: '#E7F6EC', fg: '#15924F' },
  blue: { bg: '#E6F0FB', fg: '#2563EB' },
  purple: { bg: '#F0EAFB', fg: '#7C3AED' },
  amber: { bg: '#FEF3DA', fg: '#C9820B' },
  pink: { bg: '#FCE8EE', fg: '#DB2777' },
  teal: { bg: '#E2F5F2', fg: '#0D9488' },
  orange: { bg: colors.primarySoft, fg: colors.primaryDark },
};

/** CEFR level tag colors (a1, a2, ...). */
export const levelColor: Record<string, { bg: string; fg: string }> = {
  a1: tints.green,
  a2: tints.amber,
  b1: tints.blue,
  b2: tints.purple,
  c1: tints.purple,
  c2: tints.pink,
};
