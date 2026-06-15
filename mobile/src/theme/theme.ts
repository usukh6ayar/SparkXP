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
  // Brand — premium purple (DESIGN.md)
  primary: '#6C3BFF', // Primary 500
  primaryDark: '#5A28F0', // Primary 600
  primaryPressed: '#4B1ED8', // Primary 700
  primarySoft: '#F1EEFF', // light purple tint (chips, highlights)
  // Hero gradient stops (#7A4DFF → #6C3BFF → #5A28F0)
  primaryGradient: ['#7A4DFF', '#6C3BFF', '#5A28F0'] as const,

  navy: '#18244A', // deep ink — primary text / dark surfaces
  navySoft: '#4A5578',

  // Surfaces — off-white screen, white cards, gray nested (DESIGN.md)
  background: '#F8F8FC', // app background
  surface: '#FFFFFF', // cards / elevated surfaces (white)
  surfaceAlt: '#F2F3FA', // secondary surface — inputs, chips, tracks
  cream: '#FFF6E8', // warm accent surface

  // Text (high → low emphasis)
  text: '#18244A', // primary text
  textSecondary: '#5F698A', // secondary copy
  textMuted: '#97A0B8', // captions, hints, inactive
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#DCD7FF', // on-purple secondary

  border: '#ECEEF5',
  borderStrong: '#D7DCEC',

  // Semantic
  success: '#22C55E',
  successSoft: '#EAFBF0',
  danger: '#EF4444',
  dangerSoft: '#FEECEC',
  warning: '#FF8A00', // orange (DESIGN.md)

  // Gamification
  xp: '#F5A623', // XP — gold
  sparks: '#38BDF8', // Очирхон / Gems — diamond blue
  streak: '#FF8A00', // streak — orange (DESIGN.md)

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
/** Rounded corners (DESIGN.md: 12 / 20 / 28 / 32 — premium, soft). */
export const radius = {
  sm: 12,
  md: 16,
  lg: 20, // cards
  xl: 28, // hero / large cards
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
  /** UPPERCASE eyebrow / tag label. */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.5, color: colors.textMuted },
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
/** Soft shadows (DESIGN.md): cards 0 8 24 / 0.06 · floating 0 12 30 purple 0.20. */
export const elevation = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#1A1240',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#1A1240',
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    default: {},
  }),
  // Floating elements (FAB / center tab) — soft purple glow.
  float: Platform.select({
    ios: {
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 10 },
    default: {},
  }),
};

/** Soft tint pairs (bg + foreground) for category / game / icon tiles. */
export const tints = {
  purple: { bg: '#F1EEFF', fg: '#6C3BFF' }, // listening / brand
  green: { bg: '#EAFBF0', fg: '#22C55E' }, // reading / success
  coral: { bg: '#FFF1E5', fg: '#FF8A00' }, // fill / streak
  blue: { bg: '#EAF4FF', fg: '#3B82F6' }, // writing / info
  amber: { bg: '#FFF7E3', fg: '#D97706' },
  pink: { bg: '#FDECF5', fg: '#DB2777' },
  teal: { bg: '#E8FBF7', fg: '#0F9D8A' },
  orange: { bg: '#FFF1E5', fg: '#FF8A00' },
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
