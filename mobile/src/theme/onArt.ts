/**
 * Tokens for chrome that sits directly on full-bleed artwork (the buddy stage).
 *
 * These are dark translucent fills, NOT the theme's `glassBg` tokens: those are
 * tinted surfaces that need an expo-blur layer underneath, and a blur over a
 * full-screen 3D canvas costs a re-composite every frame.
 *
 * They are theme-independent on purpose. The art behind them is dark in both
 * light and dark mode, so a themed surface would be right in one and invisible
 * in the other. Text on top of them takes `textOnDark`.
 */
export const GLASS = 'rgba(16,10,38,0.58)';
export const GLASS_EDGE = 'rgba(255,255,255,0.14)';

/** Text drawn straight on the art carries its own shadow — the scrim is light. */
export const ON_ART_SHADOW = {
  textShadowColor: 'rgba(10,6,26,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;
