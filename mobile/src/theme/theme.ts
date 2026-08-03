/**
 * SparkXP design system — the single source of truth for the mobile UI.
 *
 * Theme: a deep purple "magical night-sky" DARK theme (DESIGN.md):
 *   Purple     = brand / primary actions, with a glowing violet gradient
 *   Night-sky  = deep indigo background + raised purple card panels
 *   Gold/Cyan  = XP gold, gem-blue, orange streak — warm reward accents
 *
 * Everything visual (color, space, radius, type, elevation) comes from here.
 * Screens compose tokens + the shared components — they never hardcode hex,
 * raw pixel spacing, or ad-hoc font sizes. This keeps the whole app coherent
 * and lets us re-skin from one file.
 *
 * ⚡ REDESIGN V2.0 (2026-07-29) — values below are the token set from
 * `REDESIGN_SPEC.md` ("one light source"): the background is deepened toward
 * black-indigo so artwork and glow read as light sources, and glow is scarce.
 * Every contrast ratio in REDESIGN_SPEC §1.10 was computed against these exact
 * values. This file is the "pure token-value swap" half of the migration —
 * the component/layout half is listed in REDESIGN_SPEC §05.
 */
import { Platform, TextStyle } from 'react-native';

export const colors = {
  // Brand — premium purple (REDESIGN_SPEC §1.1)
  primary: '#6C3BFF', // Primary 500. FILL ONLY on dark (3.20:1 on surface) — use `glow` for purple text.
  primaryDark: '#5A28F0', // Primary 600 — gradient end stop, pressed fill on light
  primaryPressed: '#4E1FD6', // Primary 700 — press fill, paired with scale .97 (never opacity)
  primarySoft: 'rgba(108,59,255,0.18)', // translucent purple tint on dark (icon circles, chips)
  // Glowing CTA gradient stops (#7A4DFF → #6C3BFF → #5A28F0), 135°, at 0 / 0.55 / 1
  primaryGradient: ['#7A4DFF', '#6C3BFF', '#5A28F0'] as const,
  glow: '#9D7BFF', // neon halo / shadowColor on dark / the only legal purple TEXT on dark

  // navy — historically "deep ink". On this dark theme it now means the
  // primary LIGHT text/ink (so screens using `colors.navy` stay readable).
  navy: '#F5F2FF',
  navySoft: '#CFC6F0',

  // Surfaces — deep night-sky background, raised purple cards, darker nested
  // Typed as a 2-stop tuple (not `as const`) so the light theme can override it
  // with different stops — see `lightOverrides.backgroundGradient`.
  backgroundGradient: ['#140B2A', '#0B0716'] as readonly [string, string], // vertical, 0→320pt then flat
  background: '#0B0716', // app background (solid base / fallback)
  surface: '#171033', // cards / elevated surfaces — separated by the step, not a border
  surfaceAlt: '#1F1742', // secondary surface — inputs, chips, tracks, sheets
  cream: '#1F1742', // (legacy warm accent) — dark elevated on this theme

  // Text (high → low emphasis) — light on dark
  text: '#F5F2FF', // primary text. Never pure white on dark — cuts halation on OLED.
  textSecondary: '#CFC6F0', // secondary copy (lavender)
  // Lightened from #8E80BC, which only reached 4.15:1 on `surface` and 3.36:1
  // on `surfaceAlt` (the input background this token also tints placeholders
  // with) — below the 4.5:1 AA floor for 11–12px caption/overline text.
  // #A79BD0 clears every dark surface (7.80 / 7.12 / 6.54) while staying
  // dimmer than textSecondary, so the emphasis hierarchy is unchanged.
  textMuted: '#A79BD0', // captions, hints, inactive (muted lavender)
  textOnDark: '#FFFFFF', // text over artwork, gradients and filled buttons ONLY
  textOnDarkMuted: 'rgba(255,255,255,0.78)', // only over a gradient deep stop or a ≥60% scrim

  border: '#241C4A', // 1pt hairline — decorative on dark, the surface step does the separating
  borderStrong: '#3D3070', // focused inputs, selected chips, the current node ring

  // Glassmorphism — translucent "frosted" panels. These are tinted-surface
  // alphas, NOT white: they need an expo-blur layer underneath (intensity 40).
  glassBg: 'rgba(23,16,51,0.72)',
  glassBgStrong: 'rgba(23,16,51,0.92)', // text-bearing glass must use this, not glassBg
  glassBorder: 'rgba(157,123,255,0.24)',

  // Semantic
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.16)',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.16)',
  warning: '#FF8A3D', // orange — doubles as `streak` on dark

  // Gamification — GRAPHIC ONLY (glyphs, rings, bar fills). Identical in both
  // themes to protect brand recognition; for LABELS use the *Text pair below.
  xp: '#FFC93C', // XP — gold
  sparks: '#4FC3F7', // Очирхон / Gems — diamond blue
  streak: '#FF8A3D', // streak — orange

  // Reward text tokens (REDESIGN_SPEC §1.9). The fill colours above are 1.5:1
  // on white, which is why every reward number used to need a coloured chip.
  // These are the label-legible forms, so a reward can sit as bare text.
  xpText: '#FFD466',
  sparksText: '#7FD4F9',
  streakText: '#FFA96B',

  /**
   * heroScrim — transparent → background, laid over the bottom ~45% of hero
   * artwork so the image dissolves into the scroll instead of ending at an
   * edge. The end stop MUST equal `background` exactly or a seam appears.
   */
  heroScrim: ['rgba(11,7,22,0)', '#0B0716'] as readonly [string, string],

  /** 2pt focus ring, 2pt offset. Clears 3:1 against `background`, not the card. */
  focusRing: '#9D7BFF',

  // Locked content. Replaces `opacity: 0.4`, which multiplies through to text
  // and silently breaks every ratio in REDESIGN_SPEC §1.10 (and makes trophy
  // PNGs look dirty rather than dormant).
  lockedSurface: '#150F2B',
  lockedInk: '#8B82AD', // 5.09:1 on lockedSurface

  white: '#FFFFFF',
};

export type AppColors = typeof colors;

/**
 * App-wide LIGHT / DARK palettes. `colors` above stays the DARK default (so
 * un-migrated screens keep working). Screens/components that call `useColors()`
 * (from src/settings/SettingsContext) get the ACTIVE palette and flip live.
 *
 * The light palette overrides only what must change for a light UI; brand,
 * gamification and semantic colors stay identical across both themes.
 */
const lightOverrides: Partial<AppColors> = {
  primarySoft: 'rgba(108,59,255,0.10)',
  navy: '#1A1330', // primary ink (dark text on light)
  navySoft: '#4A4266',
  backgroundGradient: ['#FFFFFF', '#F1EDFC'] as const,
  background: '#F6F4FD',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EDFC',
  cream: '#F1EDFC',
  text: '#1A1330',
  textSecondary: '#4A4266',
  // Light mode needs its OWN muted ink — the dark theme's value only reaches
  // 3.2:1 on this background (WCAG AA needs 4.5:1 for the 11–12px caption /
  // overline / placeholder text that defaults to this token). #6B6485 keeps the
  // lavender-gray hue at 5.09:1 on the app background, 5.55:1 on white cards.
  textMuted: '#6B6485',
  // textOnDark stays white — it only ever sits on artwork/gradients/fills.
  textOnDarkMuted: 'rgba(255,255,255,0.82)',
  border: '#E4DEF5',
  borderStrong: '#CFC5EC',
  glow: '#B49BFF', // on light, glow is a focus/highlight stroke — not text
  // Glass inverts to white-tinted on light (still needs the blur underneath).
  glassBg: 'rgba(255,255,255,0.72)',
  glassBgStrong: 'rgba(255,255,255,0.92)',
  glassBorder: 'rgba(108,59,255,0.14)',
  // Semantic colours darkened for light surfaces: the dark-theme #34D399 was
  // 1.9:1 as text on white, #F87171 and #FF8A3D likewise.
  success: '#077A52',
  successSoft: 'rgba(7,122,82,0.12)',
  danger: '#C42B2B',
  dangerSoft: 'rgba(196,43,43,0.10)',
  warning: '#9E4A0D',
  // xp / sparks / streak stay identical (graphic only) — but their TEXT forms
  // must flip, or every reward label on light fails AA at ~1.7:1.
  xpText: '#8A5A00',
  sparksText: '#0A6E93',
  streakText: '#A34A10',
  heroScrim: ['rgba(246,244,253,0)', '#F6F4FD'] as const,
  focusRing: '#5A28F0',
  lockedSurface: '#EDE9F7',
  lockedInk: '#6E6884',
};

export const appThemes: Record<'dark' | 'light', AppColors> = {
  dark: colors,
  light: { ...colors, ...lightOverrides },
};

/**
 * 4pt spacing scale. `lg` (16) is the default screen gutter.
 *
 * NOTE: REDESIGN_SPEC §1.6 renames this scale one step up
 * (xxs 4 / xs 8 / sm 12 / md 16 / lg 24 / xl 32 / xxl 48). That is a rename,
 * not a value swap — writing it in here would silently make every existing
 * `spacing.lg` 24 instead of 16. It is deliberately left alone; the rename is
 * tracked as a separate mechanical codemod in REDESIGN_SPEC §05.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

/** Corner radii (REDESIGN_SPEC §1.6) — restrained for a premium, less "bubbly" feel. */
export const radius = {
  sm: 10, // chips, pills, small tiles
  md: 14, // buttons, list rows, inputs
  lg: 20, // cards — the default
  xl: 28, // hero card, sheets, the status card
  full: 999, // avatars, rings, hearts, the centre tab
};

/**
 * Semantic type scale. Each style pairs size + line-height + weight so screens
 * get correct hierarchy by *intent* (h2, body, caption) instead of hand-picking
 * a number and slapping `fontWeight: '800'` on everything.
 */
export const typography = {
  /** Only two places: the greeting and a celebration count. */
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, fontFamily: 'Manrope_800ExtraBold', color: colors.text },
  /** Screen title. */
  h1: { fontSize: 27, lineHeight: 34, fontWeight: '700' as const, fontFamily: 'Manrope_700Bold', color: colors.text },
  /** Section header / card title. */
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, fontFamily: 'Manrope_700Bold', color: colors.text },
  /** List-row title / island level name. */
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, fontFamily: 'Manrope_600SemiBold', color: colors.text },
  /** Everything long-form. 15 not 16 — Mongolian needs the width. */
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, fontFamily: 'Inter_400Regular', color: colors.text },
  /** Emphasized body (button labels, key values inline). */
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.text },
  /** Pills, chips, tab labels, stat captions. */
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.text },
  /** Bottom-tab labels only — one notch below `label` so five fit without crowding. */
  tabLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, fontFamily: 'Inter_600SemiBold', color: colors.text },
  /** Helper text, timestamps, done/total. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, fontFamily: 'Inter_400Regular', color: colors.textMuted },
  /** UPPERCASE eyebrow — section headers only; Cyrillic uppercase tires fast. */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, color: colors.textMuted },
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

/**
 * Elevation presets (iOS shadow + Android elevation), REDESIGN_SPEC §1.7.
 *
 * On the dark theme a dark drop-shadow is invisible, so cards "lift" with a
 * violet bloom instead. Android has no coloured shadow — there the border
 * carries the lift.
 *
 * ⚠️ These are the DARK values. REDESIGN_SPEC §05 asks for `elevation` to
 * become a theme-aware function (dark → shadowColor: glow, light → a neutral
 * #1A1330 shadow) — that is a component-code change, tracked there, not here.
 * It is not a regression today because the static palette is dark-pinned.
 */
export const elevation = {
  none: {},
  // Pills, chips, the tab bar edge.
  sm: Platform.select({
    ios: {
      shadowColor: colors.glow,
      shadowOpacity: 0.28,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  // The standard card.
  md: Platform.select({
    ios: {
      shadowColor: colors.glow,
      shadowOpacity: 0.34,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 5 },
    default: {},
  }),
  // The Continue card, the centre AI tab, sheets.
  float: Platform.select({
    ios: {
      shadowColor: colors.glow,
      shadowOpacity: 0.45,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
    },
    android: { elevation: 12 },
    default: {},
  }),
};

/**
 * Tint pairs (bg + foreground) for category chips, icon tiles and status pills
 * (REDESIGN_SPEC §1.3). On dark, `bg` is a translucent colored panel over the
 * night-sky surface with a light `fg`; on light it inverts to a pale wash with
 * a deep `fg`. Every pair clears 4.5:1 — the old dark `fg` values were the
 * saturated fill colours, which are unreadable as small text on light.
 *
 * `tints` stays the DARK set so the ~56 static-palette screens keep working;
 * theme-aware code should read `tintThemes[theme]`.
 */
export const tints = {
  purple: { bg: 'rgba(124,77,255,0.18)', fg: '#C4AEFF' }, // listening / brand
  green: { bg: 'rgba(52,211,153,0.16)', fg: '#6EE7B7' }, // reading / success
  coral: { bg: 'rgba(248,113,113,0.16)', fg: '#FCA5A5' }, // fill / danger
  blue: { bg: 'rgba(79,195,247,0.16)', fg: '#93DCFB' }, // writing / info
  amber: { bg: 'rgba(255,201,60,0.16)', fg: '#FFDD8A' },
  pink: { bg: 'rgba(244,114,182,0.16)', fg: '#F9A8D4' },
  teal: { bg: 'rgba(45,212,191,0.16)', fg: '#7EE7DC' },
  orange: { bg: 'rgba(255,138,61,0.16)', fg: '#FFB98A' },
};

export type Tints = typeof tints;

/** Light tints are identical in the app and premium families. */
const lightTints: Tints = {
  purple: { bg: '#EFE9FE', fg: '#5426D6' },
  green: { bg: '#E3F7EF', fg: '#0B7A53' },
  coral: { bg: '#FDEAEA', fg: '#B32B2B' },
  blue: { bg: '#E4F4FD', fg: '#0A6280' },
  amber: { bg: '#FBF1DC', fg: '#7A5200' },
  pink: { bg: '#FCE9F3', fg: '#A5215F' },
  teal: { bg: '#E1F6F3', fg: '#0A6B60' },
  orange: { bg: '#FDEDE2', fg: '#8F3D0A' },
};

export const tintThemes: Record<'dark' | 'light', Tints> = {
  dark: tints,
  light: lightTints,
};

/**
 * "Premium surface" palette for the Profile / Settings screens, with LIGHT and
 * DARK variants so those screens respond to the Settings appearance toggle.
 * Read the active one with `useTheme()` from src/settings/SettingsContext.
 * (The rest of the app still uses the static `colors` above — screens migrate
 * to this palette over time.)
 */
export type PremiumPalette = {
  bg: readonly [string, string, string];
  bgFlat: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  track: string;
  divider: string;
  // Reward / state tokens, mirrored from the app palette so Profile does not
  // have to import two families to draw one XP number.
  xpText: string;
  sparksText: string;
  streakText: string;
  lockedSurface: string;
  lockedInk: string;
  focusRing: string;
  heroScrim: readonly [string, string];
};

/**
 * REDESIGN_SPEC §1.2 — pushed deliberately richer than `appThemes`: a
 * three-stop bg that runs violet at the crown and near-black at the tab bar,
 * a card one step lighter than the app surface, and a violet cardBorder at
 * 30% instead of 24%. Profile should feel like a different, more expensive room.
 */
export const premiumThemes: Record<'dark' | 'light', PremiumPalette> = {
  dark: {
    bg: ['#1A0F3D', '#100A26', '#07040F'], // stops at 0 / 0.42 / 1
    bgFlat: '#0D0720', // for sub-screens that scroll far enough to band
    card: '#221641', // one step lighter than app surface — the whole point
    cardBorder: 'rgba(157,123,255,0.30)', // reads as a lit edge, not a hairline
    text: '#FBF9FF',
    textSecondary: '#D6CCF5',
    // Same as the app palette, deliberately, so muted copy never shifts
    // across a navigation.
    textMuted: '#A79BD0',
    primary: '#7A4DFF', // the lighter gradient head, so CTAs survive the richer bg
    primaryLight: '#A98BFF',
    track: 'rgba(255,255,255,0.10)',
    divider: 'rgba(157,123,255,0.18)',
    xpText: '#FFD466',
    sparksText: '#7FD4F9',
    streakText: '#FFA96B',
    lockedSurface: '#1B1235',
    lockedInk: '#8B82AD',
    focusRing: '#A98BFF',
    heroScrim: ['rgba(13,7,32,0)', '#0D0720'],
  },
  light: {
    bg: ['#FFFFFF', '#F4F0FE', '#EFE9FC'],
    bgFlat: '#F8F6FE',
    card: '#FFFFFF',
    cardBorder: '#E1D8F8',
    text: '#160F2B',
    textSecondary: '#453C63',
    // Own muted ink for light mode — see the note on `colors.textMuted` above.
    textMuted: '#6B6485',
    primary: '#6C3BFF',
    primaryLight: '#8B6BFF',
    track: 'rgba(22,15,43,0.08)',
    divider: '#EBE5F9',
    xpText: '#8A5A00',
    sparksText: '#0A6E93',
    streakText: '#A34A10',
    lockedSurface: '#F1EDFB',
    lockedInk: '#6E6884',
    focusRing: '#5A28F0',
    heroScrim: ['rgba(248,246,254,0)', '#F8F6FE'],
  },
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

/**
 * Shared palette for the "Хичээлийн ертөнц" adventure map — (tabs)/lessons.tsx's
 * island tiers and level/[code].tsx's node path both tint by CEFR tier using
 * these same three colors + gold star, matched to the map artwork (not the
 * regular tints.* palette, which is a slightly different shade for each).
 */
export const islandMap = {
  green: '#34D399', // A1 · A2 — the beginner islands
  blue: '#4FC3F7', // B1 · B2
  purple: '#7A4DFF', // C1 · C2
  gold: '#FFC93C', // the trail, and the mastered star
  streak: '#FF8A3D', // the "you are here" waypoint pulse
};

export type IslandMap = typeof islandMap;

/**
 * The map is the one screen where light mode is NOT optional: the islands ship
 * `*_light` variants over a day sky, and the dark gold is only 2.1:1 on a
 * bright sky — the trail would simply disappear. Theme-aware code must read
 * `islandMapThemes[theme]`, not the dark-pinned `islandMap` above.
 */
export const islandMapThemes: Record<'dark' | 'light', IslandMap> = {
  dark: islandMap,
  light: {
    green: '#10A176',
    blue: '#2790C4',
    purple: '#6C3BFF',
    gold: '#E0A100',
    streak: '#EE6F1F',
  },
};

/**
 * Per-skill hero gradients for skill/[key].tsx and the Home skill tiles
 * (REDESIGN_SPEC §1.4). Bright → deep on a 135° diagonal, and the label always
 * sits on the DEEP stop — that is what makes white text pass AA (5.93–8.43:1).
 *
 * Identical across all four palettes on purpose, not by omission: these are
 * always white-on-gradient, so re-tinting them per theme would only weaken
 * recognition.
 */
export const skillGradients: Record<string, readonly [string, string]> = {
  listening: ['#4FC3F7', '#1B5FA8'], // Сонсох — 6.46:1
  reading: ['#34D399', '#0A6B4A'], // Унших — 6.53:1
  speaking: ['#F472B6', '#9A1E63'], // Ярих — 7.66:1
  writing: ['#FF8A3D', '#A34A10'], // Бичих — 5.93:1
  grammar: ['#7A4DFF', '#4E1FD6'], // Дүрэм — 8.43:1
  fill: ['#FFC93C', '#7A5200'], // Нөхөж дуусга — 6.92:1
};

/**
 * Fill ramps for `<ProgressBar>` / `<ProgressRing>`.
 *
 * A progress bar is the most-repeated reward surface in the app, and a single
 * flat colour made earned progress read like a loading indicator. Each ramp
 * goes light → deep in the SAME hue as its semantic colour above, so the bar
 * gains depth without inventing a new palette.
 *
 * Screens must use these rather than inlining hex (CODING_RULES §2).
 */
export const progressGradients = {
  /** Lesson progress, the Continue card. */
  primary: ['#7A4DFF', '#9D7BFF'] as const,
  /** Completed / mastered. */
  success: ['#34D399', '#6EE7B7'] as const,
  /** Daily goal bar, profile XP ring. */
  xp: ['#FFC93C', '#FFE08A'] as const,
  /** Streak ring. */
  streak: ['#FF8A3D', '#FFB86B'] as const,
  /** Hearts depleting, timers running out. */
  danger: ['#F87171', '#FCA5A5'] as const,
  /**
   * The ONLY bar allowed directly over artwork — a coloured one would fight
   * the sky. Runs light→dark so the fill stays legible on a bright hero.
   */
  onHero: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.62)'] as const,
} as const;
