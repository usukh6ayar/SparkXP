/**
 * Responsive scaling helpers — make fixed pixel sizes adapt to every phone.
 *
 * React Native's density-independent points are NOT screen-size independent: a
 * `width: 320` blob that looks right on an iPhone 11 (375pt) overflows an
 * iPhone SE (320pt) and looks tiny on a Pixel 7 Pro. These helpers rescale a
 * value from our 375×812 design baseline to the actual device, with the factor
 * clamped so tiny phones stay usable and tablets don't blow the UI up.
 *
 * Usage (prefer these over raw pixels for anything sized ≥ ~48px or derived
 * from the screen — hero images, avatars, covers, decorative blobs):
 *   s(24)        → scale by width      (most sizes, horizontal spacing)
 *   vs(200)      → scale by height     (vertical hero/video heights)
 *   ms(180)      → moderate scale      (softer curve — good for large art)
 *   wp(90)       → 90% of screen width (fluid widths, replaces fixed px)
 *   hp(30)       → 30% of screen height
 *
 * For values that must update on rotation/split-screen, use `useResponsive()`
 * which reads live dimensions; the module-level helpers snapshot at launch,
 * which is correct for phone-size differences (the common case).
 */
import { Dimensions, useWindowDimensions, type ViewStyle } from 'react-native';

const BASE_WIDTH = 375; // iPhone 11 / X logical width
const BASE_HEIGHT = 812; // iPhone 11 / X logical height

/** Tablet / large screen: short side ≥ 600pt (Galaxy Tab A9, iPad, split view). */
const TABLET_MIN_SHORT = 600;
/** Cap a single-column layout so it doesn't stretch edge-to-edge on a tablet. */
const CONTENT_MAX_WIDTH = 640;

/** Build the bounded content style for a given viewport (null on phones). */
function boundedFor(width: number, height: number): ViewStyle | null {
  const tablet = Math.min(width, height) >= TABLET_MIN_SHORT;
  return tablet
    ? { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }
    : null;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function factors(width: number, height: number) {
  const shortDim = Math.min(width, height);
  const longDim = Math.max(width, height);
  // Clamp: phones scale gently (0.85–1.25); tablets/large phones don't explode.
  const w = clamp(shortDim / BASE_WIDTH, 0.85, 1.25);
  const h = clamp(longDim / BASE_HEIGHT, 0.85, 1.25);
  return { w, h };
}

const win = Dimensions.get('window');
const base = factors(win.width, win.height);

/** True on tablets / large screens (short side ≥ 600pt). Snapshot at launch. */
export const isTablet = Math.min(win.width, win.height) >= TABLET_MIN_SHORT;

/**
 * Style to drop into a screen's scroll `contentContainerStyle` (or a main
 * container) so single-column content caps its width and centers on tablets,
 * while staying full-width on phones. `null` on phones (spread is a no-op).
 * Usage: `contentContainerStyle={[styles.content, bounded]}`.
 */
export const bounded: ViewStyle | null = boundedFor(win.width, win.height);

/** Scale a size by the (clamped) screen-width factor. Rounds to a whole point. */
export const s = (size: number) => Math.round(size * base.w);
/** Scale a size by the (clamped) screen-height factor. */
export const vs = (size: number) => Math.round(size * base.h);
/** Moderate scale — blends the scaled value toward the original (softer curve). */
export const ms = (size: number, factor = 0.5) => Math.round(size + (s(size) - size) * factor);
/** Percentage of screen width (fluid layout). */
export const wp = (pct: number) => Math.round((win.width * pct) / 100);
/** Percentage of screen height. */
export const hp = (pct: number) => Math.round((win.height * pct) / 100);

/** Live version for components that must react to rotation / split-screen. */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const f = factors(width, height);
  return {
    width,
    height,
    s: (size: number) => Math.round(size * f.w),
    vs: (size: number) => Math.round(size * f.h),
    ms: (size: number, factor = 0.5) => Math.round(size + (Math.round(size * f.w) - size) * factor),
    wp: (pct: number) => Math.round((width * pct) / 100),
    hp: (pct: number) => Math.round((height * pct) / 100),
    isTablet: Math.min(width, height) >= TABLET_MIN_SHORT,
    bounded: boundedFor(width, height),
  };
}
