/**
 * SparkXP design system — the single source of truth for the mobile UI.
 *
 * Theme: a deep purple "magical night-sky" DARK theme (DESIGN_PROMPT.md):
 *   Purple     = brand / primary actions, with a glowing violet gradient
 *   Night-sky  = deep indigo background + raised purple card panels
 *   Gold/Cyan  = XP gold, gem-blue, orange streak — warm reward accents
 *
 * Everything visual (color, space, radius, type, elevation) comes from here.
 * Screens compose tokens + the shared components — they never hardcode hex,
 * raw pixel spacing, or ad-hoc font sizes. This keeps the whole app coherent
 * and lets us re-skin from one file.
 */
import { Platform, TextStyle } from 'react-native';

export const colors = {
  // Brand — premium purple (DESIGN_PROMPT.md)
  primary: '#6C3BFF', // Primary 500
  primaryDark: '#5A28F0', // Primary 600
  primaryPressed: '#4B1ED8', // Primary 700
  primarySoft: 'rgba(124,77,255,0.18)', // translucent purple tint on dark (icon circles, chips)
  // Glowing CTA gradient stops (#7A4DFF → #6C3BFF → #5A28F0)
  primaryGradient: ['#7A4DFF', '#6C3BFF', '#5A28F0'] as const,
  glow: '#9D7BFF', // neon halo / selected border / mascot rim light

  // navy — historically "deep ink". On this dark theme it now means the
  // primary LIGHT text/ink (so screens using `colors.navy` stay readable).
  navy: '#FFFFFF',
  navySoft: '#B9A9E6',

  // Surfaces — deep night-sky background, raised purple cards, darker nested
  backgroundGradient: ['#1B1147', '#2A1A5E'] as const, // night-sky (top → bottom)
  background: '#191040', // app background (solid base / fallback)
  surface: '#2A1E5C', // cards / elevated surfaces
  surfaceAlt: '#372A7A', // secondary surface — inputs, chips, tracks
  cream: '#372A7A', // (legacy warm accent) — dark elevated on this theme

  // Text (high → low emphasis) — light on dark
  text: '#FFFFFF', // primary text
  textSecondary: '#B9A9E6', // secondary copy (lavender)
  textMuted: '#8E80BC', // captions, hints, inactive (muted lavender)
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#DCD7FF', // on-purple secondary

  border: '#3D2F73',
  borderStrong: '#4A3A85',

  // Semantic
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.16)',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.16)',
  warning: '#FF8A3D', // orange

  // Gamification
  xp: '#FFC93C', // XP — gold
  sparks: '#4FC3F7', // Очирхон / Gems — diamond blue
  streak: '#FF8A3D', // streak — orange

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
/**
 * On the dark theme, dark drop-shadows are invisible, so cards "lift" with a
 * soft violet glow instead. Floating elements glow a bit stronger.
 */
export const elevation = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: '#9D7BFF',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#9D7BFF',
      shadowOpacity: 0.18,
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

/**
 * Tint pairs (bg + foreground) for category / game / icon tiles. On the dark
 * theme `bg` is a translucent colored panel that sits on the night-sky surface,
 * with a vivid `fg` for the icon/label.
 */
export const tints = {
  purple: { bg: 'rgba(124,77,255,0.18)', fg: '#9D7BFF' }, // listening / brand
  green: { bg: 'rgba(52,211,153,0.16)', fg: '#34D399' }, // reading / success
  coral: { bg: 'rgba(255,138,61,0.18)', fg: '#FF8A3D' }, // fill / streak
  blue: { bg: 'rgba(79,195,247,0.16)', fg: '#4FC3F7' }, // writing / info
  amber: { bg: 'rgba(255,201,60,0.16)', fg: '#FFC93C' },
  pink: { bg: 'rgba(244,114,182,0.16)', fg: '#F472B6' },
  teal: { bg: 'rgba(45,212,191,0.16)', fg: '#2DD4BF' },
  orange: { bg: 'rgba(255,138,61,0.18)', fg: '#FF8A3D' },
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
