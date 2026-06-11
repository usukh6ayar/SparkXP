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
  // Brand — premium purple (фоx брэнд)
  primary: '#6D4AFF', // cleaner premium purple
  primaryDark: '#5536E8',
  primaryPressed: '#472BC7',
  primarySoft: '#F1EEFF', // light purple tint (chips, highlights)
  // Hero gradient stops
  primaryGradient: ['#7C5CFC', '#5E3FE6'] as const,

  navy: '#18244A', // deep ink — primary text / dark surfaces
  navySoft: '#4A5578',

  // Surfaces — off-white screen, white cards, gray nested
  background: '#FAFBFF', // app background (subtle off-white)
  surface: '#FFFFFF', // cards / elevated surfaces (white)
  surfaceAlt: '#F5F6FB', // subtle gray — inputs, chips, tracks, pressed
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
  warning: '#F59E0B',

  // Gamification
  xp: '#F5A623', // XP — gold
  sparks: '#38BDF8', // Очирхон — diamond blue
  streak: '#FF6B35', // streak — fox orange

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
  purple: { bg: '#F1EEFF', fg: '#6D4AFF' }, // listening
  green: { bg: '#EAFBF0', fg: '#22C55E' }, // reading
  coral: { bg: '#FFF0EA', fg: '#FF6B35' }, // fill
  blue: { bg: '#EAF4FF', fg: '#3B82F6' }, // writing
  amber: { bg: '#FFF7E3', fg: '#D97706' },
  pink: { bg: '#FDECF5', fg: '#DB2777' },
  teal: { bg: '#E8FBF7', fg: '#0F9D8A' },
  orange: { bg: '#FFF0EA', fg: '#FF6B35' },
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
