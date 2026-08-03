/**
 * Every number the wave tab bar is built from, in one place.
 *
 * The bar is drawn in three stacked bands (top → bottom):
 *
 *   FLOAT_BAND   transparent; only the buddy avatar lives here
 *   WAVE_H       the swell — the card's top edge rises from WAVE_H to 0
 *   BAR_H        the solid glass card holding the four flat tabs
 *
 * The whole thing is ONE view whose height includes the transparent band. That
 * is not cosmetic: on Android the part of a child drawn outside its parent
 * still renders but never receives touches, so a buddy that "overflows" upward
 * would look right and be untappable. It lives inside the box instead, and the
 * box is `pointerEvents="box-none"` so the transparent band passes taps through
 * to the screen behind it.
 */

/** Solid card height, excluding the safe-area inset. */
export const BAR_H = 64;
/** How far the crest of the wave rises above the card's shoulders. */
export const WAVE_H = 24;
/**
 * Transparent band above the card, sized to hold the buddy's upper half plus
 * its halo. Must stay ≥ BUDDY_OUTER / 2 + LIFT or the avatar's top is clipped
 * on Android (and untappable there, which is the same bug wearing a hat).
 */
export const FLOAT_BAND = 54;
/** Card corner radius (the spec's 32–36). */
export const RADIUS = 34;

/** Buddy avatar diameter and the gradient ring around it. */
export const AVATAR = 68;
export const RING = 3;
export const BUDDY_OUTER = AVATAR + RING * 2;
/**
 * How far the avatar's centre sits above the crest. Tuned so roughly a third of
 * the avatar is below the crest — enough that the swell reads as its wake and
 * it stays anchored to the bar, rather than floating free of it.
 */
export const LIFT = 12;
/** Width the buddy reserves in the tab row, so the flat tabs clear its halo. */
export const BUDDY_SLOT = BUDDY_OUTER + 20;

/** Total height the tab bar reserves, before the safe-area inset. */
export const TOTAL_H = FLOAT_BAND + WAVE_H + BAR_H;

/**
 * The card's outline: rounded shoulders, then one long swell that runs the
 * full width and peaks under the buddy.
 *
 * Both ends of each cubic keep a horizontal tangent (control points share the
 * y of the point they belong to), which is what stops the crest and the
 * shoulders from kinking — the "no sharp curves" requirement. The 0.55/0.42
 * weights skew the swell slightly so it reads as organic rather than plotted.
 *
 * A worklet so the animated wrapper can rebuild it on the UI thread.
 */
export function wavePath(width: number, height: number): string {
  'worklet';
  const cx = width / 2;
  const left = RADIUS;
  const right = width - RADIUS;

  return [
    `M 0 ${height}`,
    `L 0 ${WAVE_H + RADIUS}`,
    `Q 0 ${WAVE_H} ${left} ${WAVE_H}`,
    `C ${left + (cx - left) * 0.55} ${WAVE_H} ${cx - (cx - left) * 0.42} 0 ${cx} 0`,
    `C ${cx + (right - cx) * 0.42} 0 ${right - (right - cx) * 0.55} ${WAVE_H} ${right} ${WAVE_H}`,
    `Q ${width} ${WAVE_H} ${width} ${WAVE_H + RADIUS}`,
    `L ${width} ${height}`,
    'Z',
  ].join(' ');
}

/** Just the top edge of `wavePath`, for the gradient hairline. */
export function waveEdgePath(width: number): string {
  'worklet';
  const cx = width / 2;
  const left = RADIUS;
  const right = width - RADIUS;

  return [
    `M 0 ${WAVE_H + RADIUS}`,
    `Q 0 ${WAVE_H} ${left} ${WAVE_H}`,
    `C ${left + (cx - left) * 0.55} ${WAVE_H} ${cx - (cx - left) * 0.42} 0 ${cx} 0`,
    `C ${cx + (right - cx) * 0.42} 0 ${right - (right - cx) * 0.55} ${WAVE_H} ${right} ${WAVE_H}`,
    `Q ${width} ${WAVE_H} ${width} ${WAVE_H + RADIUS}`,
  ].join(' ');
}
