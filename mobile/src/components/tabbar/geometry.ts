/**
 * Every number the wave tab bar is built from, in one place.
 *
 * The bar is drawn in three stacked bands (top → bottom):
 *
 *   FLOAT_BAND   transparent; only the buddy's head and its halo live here
 *   WAVE_H       the swell — the card's top edge rises from WAVE_H to 0
 *   BAR_H        the solid card holding the four flat tabs
 *
 * TWO HEIGHTS, AND THEY ARE NOT THE SAME — this is the important part:
 *
 *   TOTAL_H       how tall the bar's own view is: all three bands.
 *   tabBarHeight  how much room the screens above must keep clear: the SOLID
 *                 card only (`BAR_H` + the safe area it sits on).
 *
 * The bar's view is an overlay (`position: absolute`), so its transparent bands
 * cost the screens nothing; `app/(tabs)/_layout.tsx` pads every screen by
 * `tabBarHeight()` instead. When these were one number the tab bar sat in the
 * layout flow at its full height and every screen lost ~80px to a band that is
 * see-through — content squashed upward, spacing wrong on every tab. Keep them
 * separate: only the solid card may ever take space away from a screen.
 */

/**
 * The card's height at its LOWEST — the two dips in the wave — excluding the
 * safe-area inset. This is what the screens above reserve. Sized by what has to
 * fit under the dips: LABEL_BOTTOM + label + gap + TAB_ICON, and then BAND of
 * clearance over the icon so the 3D art never sits in the coloured edge.
 */
export const BAR_H = 64;
/**
 * THE WAVE, taken straight off the design mock.
 *
 *   depth(u) = Σ Aₖ·(1 − cos 2πk·u)      u = 0…1, corner to corner
 *
 * `depth` is measured DOWN from the wave's highest point. The coefficients are
 * not taste — they are a least-squares fit of a cosine series to the mock's own
 * silhouette, read out of the picture pixel by pixel (fit residual ≈ 2dp, which
 * is the mock's own left/right asymmetry: a symmetric curve can only split the
 * difference). What they describe:
 *
 *   the HIGHEST points are the two side humps, over the outer tabs   (≈ +12)
 *   the dips sit a third of the way in, between the tabs             (   0)
 *   the middle rises again, but only about half as high              (≈ +5)
 *
 * That middle matters: the mock's fox does NOT ride a crest, it floats well
 * clear of a modest rise. Building it the other way round — centre highest —
 * is what made earlier attempts look nothing like the picture.
 *
 * The fitted numbers were [6.26, 6.07, −1.97, 0.36]; what ships is those scaled
 * to 66% with each successive harmonic damped further (×0.85, ×0.55). Same
 * silhouette, lower and softer — the raw fit read as a tight, squeezed wave on
 * a phone, because the high harmonics are exactly the short, sharp wiggles.
 *
 * A cosine series is the right shape of formula, not just a curve that fits:
 * every cos(2πk·u) is symmetric about the middle and flat at both ends, so the
 * wave is symmetric for free and always meets the rounded corners with a
 * horizontal tangent. It is smooth everywhere by construction — no segment
 * joins to kink (a hand-built list of peaks was tried on 2026-08-03 and read
 * as lumpy at phone size).
 */
const WAVE_COS = [4.17, 3.4, -0.72];
/**
 * How far the wave's highest point sits above the card's LOWEST point — i.e.
 * its depth at the dips, which is what `BAR_H` is measured to. Read off the
 * fitted curve (19.2) and rounded; the layout only needs it to the pixel.
 */
export const WAVE_H = 12;
/**
 * Transparent band above the crest: the part of the buddy that pokes out, plus
 * room for its halo. Must stay ≥ (buddy top above the crest) + halo overhang or
 * the avatar is clipped on Android — and clipped there means untappable too,
 * because Android never delivers a touch to a child drawn outside its parent.
 */
export const FLOAT_BAND = 26;
/**
 * Card corner radius. Bigger than the spec's 32–36 on purpose: the wave is at
 * its HIGHEST right where the corner starts, so a tight corner drops off that
 * peak like a cliff and the whole end reads as an island sticking up. A wide
 * corner lets the hump roll down into the screen edge instead.
 *
 * The shadow rect behind the card uses the same number, which is what keeps it
 * hidden: same corner shape, sitting a constant WAVE_H + 3 deeper.
 */
export const RADIUS = 48;

/** Buddy avatar diameter and the gradient ring around it. */
export const AVATAR = 54;
export const RING = 3;
export const BUDDY_OUTER = AVATAR + RING * 2;
/** Gap between the buddy's ring and its label. */
export const BUDDY_GAP = 2;
/**
 * Flat-tab icon size. Much bigger than a vector glyph would be: these are the
 * brand's 3D PNGs, which carry transparent padding and so read a good 15%
 * smaller than their box. The old icon-only bar drew them at 40.
 */
export const TAB_ICON = 34;
/**
 * How far every label sits above the card's bottom edge — the four flat tabs
 * AND the buddy. One number, so the five labels cannot drift out of line: the
 * tabs bottom-align their column to it and the buddy's whole column is anchored
 * by it. Bottom-aligning (rather than centring the column in BAR_H) also puts
 * the spare room where it is needed — above the icons, under the wave.
 */
export const LABEL_BOTTOM = 5;
/** Height of one tab label — `typography.tabLabel`'s line height. */
const LABEL_H = 14;
/** Gap between a tab's icon and its label. */
export const TAB_GAP = 2;
/**
 * How far the buddy's avatar floats ABOVE the card's top edge.
 *
 * The bar reserves only `tabBarHeight()` from the screens — the card — so this
 * much of the fox hangs over whatever is at the bottom of the screen. Any
 * screen that pins a control to the bottom of its scene (the buddy picker's
 * Apply button, for one) has to add this, or the fox lands on top of it.
 */
export const BUDDY_OVERHANG = LABEL_BOTTOM + LABEL_H + BUDDY_GAP + BUDDY_OUTER - BAR_H;
/**
 * Thickness of the coloured band that traces the card's top edge.
 *
 * Measured off the design mock: its band is 16–18px thick where the card body
 * is 127px, and the body is our BAR_H — so the mock is drawn at 2×, and the
 * band is ~8dp. It reads as a glow, but it is not one: in the mock the band's
 * top IS the card's edge (hard against the screen) and the colour sits INSIDE
 * the card, which is why a thin stroke never looked like it.
 */
export const BAND = 6;
/**
 * Headroom the card's own view keeps above the crest, so the soft bloom drawn
 * outside the edge isn't sliced off by the SVG's boundary. Must stay under
 * FLOAT_BAND.
 */
export const GLOW_PAD = 10;
/** Width the buddy reserves in the tab row, so the flat tabs clear its halo. */
export const BUDDY_SLOT = BUDDY_OUTER + 20;

/** Total height of the bar's own (overlay) view, before the safe-area inset. */
export const TOTAL_H = FLOAT_BAND + WAVE_H + BAR_H;

/**
 * The strip of safe area the tab row sits above.
 *
 * NOT the raw inset: 8px of it is reclaimed, because the inset is sized for a
 * full-height control and our labels are small. What is left still clears the
 * home indicator comfortably — on a 34pt inset the labels end up 30px off the
 * screen edge, and the indicator only occupies the bottom ~21. The floor keeps
 * gesture-nav phones (tiny or zero inset) off the very edge.
 */
const RECLAIM = 8;
const MIN_BOTTOM = 12;
export const cardBottom = (inset: number) => Math.max(inset - RECLAIM, MIN_BOTTOM);
/** What the screens must keep clear: the solid card, nothing else. */
export const tabBarHeight = (inset: number) => BAR_H + cardBottom(inset);

/**
 * How the wave moves: each harmonic breathes at its OWN rate, so the humps and
 * dips swell and ebb against each other and the shape morphs.
 *
 * It deliberately does NOT slide sideways or shift position — that was the
 * first attempt and it read as "the bar is being dragged about" rather than as
 * water. Nothing here translates: only the coefficients change, and since every
 * cos(2πk·u) is pinned flat at both ends, no amount of morphing can lift the
 * wave off its corners or expose an edge.
 *
 * Rates are 1×, 2× and 3× of one clock, so every term completes a whole number
 * of cycles per loop and the seam never jumps; all are plain sines, so phase 0
 * is the neutral shape — which is what Reduce Motion freezes on.
 *
 * These amounts are twice what the same motion could afford before the dips
 * were pinned (see `DIP_U`): the clearance the icons need no longer pays for
 * the animation, so the wave can actually be seen to move.
 */
const MORPH = [0.16, 0.22, 0.4]; // how much each harmonic breathes
/** How much the whole wave swells when a tab is tapped. */
const SPLASH = 0.16;
/**
 * The ROLL: how far the wave leans side to side, in px.
 *
 * Everything else in the motion is symmetric, and symmetric motion reads as a
 * machine breathing. These are sine terms — antisymmetric — so one shoulder
 * lifts while the other settles and the wave sloshes, which is what water
 * actually does. They vanish at both corners (sin 0 = sin 2π = 0), so the ends
 * stay pinned; their slope there is ~0.03 px/px, far too little to see as a
 * kink against the corner arcs.
 */
const ROLL = 1.2;
/**
 * Where the wave is deepest, as a fraction of the span (and mirrored). Used to
 * NORMALISE the motion: the depth is divided by whatever the DEEPER of the two
 * dips currently measures, so neither dip can ever drop below `BAR_H` — however
 * the wave is breathing or rolling.
 *
 * That is what lets the motion be visible at all. The tab icons clear the
 * coloured band at the dips by ~3px; without pinning, every breath and every
 * tap pulse deepened the dips and ate that clearance, so the motion had to be
 * shrunk to almost nothing. Pinned, the middle and the shoulders move freely
 * and the two points the layout depends on never budge.
 */
const DIP_U = 0.31;
/** One full cycle, ms. Slow enough to read as water, not as an animation. */
export const WAVE_PERIOD = 9000;
/** Sampling resolution of the curve. 12 cubics hold the series to well under a
 *  tenth of a pixel — far finer than anyone can see. */
const STEPS = 12;

/**
 * The wave, as depth below its highest point at `u` (0…1, corner to corner).
 * A worklet: this is evaluated ~40 times a frame on the UI thread.
 */
function rawDepth(u: number, phase: number, splash: number): number {
  'worklet';
  const k = 2 * Math.PI * phase;
  const swell = 1 + SPLASH * splash;

  let d = 0;
  for (let i = 0; i < WAVE_COS.length; i++) {
    const n = i + 1;
    const breathe = 1 + MORPH[i] * Math.sin(n * k);
    d += WAVE_COS[i] * breathe * swell * (1 - Math.cos(2 * Math.PI * n * u));
  }
  // The roll — see ROLL. Two harmonics of it, at 1× and 2× the clock, so the
  // lean itself travels rather than rocking on the spot.
  return (
    d +
    ROLL *
      (Math.sin(2 * Math.PI * u) * Math.sin(k) +
        0.6 * Math.sin(4 * Math.PI * u) * Math.sin(2 * k))
  );
}

/** Whichever dip is deeper right now — the one the normalisation pins. */
function deepest(phase: number, splash: number): number {
  'worklet';
  return Math.max(rawDepth(DIP_U, phase, splash), rawDepth(1 - DIP_U, phase, splash));
}

/** The wave's depth at its dips when nothing is moving — i.e. `WAVE_H`. */
const DIP_DEPTH = rawDepth(DIP_U, 0, 0);

/**
 * The wave, as depth below its highest point at `u` (0…1, corner to corner),
 * scaled so the dips always measure exactly the same. See `DIP_U`.
 * A worklet: this is evaluated ~40 times a frame on the UI thread.
 */
function depth(u: number, phase: number, splash: number): number {
  'worklet';
  return (rawDepth(u, phase, splash) * DIP_DEPTH) / deepest(phase, splash);
}

/**
 * The wave's top edge, corner to corner, as SVG commands.
 *
 * Sampled, not hand-built: `STEPS` points along `depth`, joined by cubics whose
 * control points follow the curve's own slope at each end (a Hermite spline).
 * The slope is measured numerically, so the animation can bend the curve any
 * way it likes and the tangents still agree — which is what keeps it looking
 * poured rather than assembled.
 *
 * `dy` pushes the edge DOWN while the card's bottom stays put. Drawing the
 * shape twice — once in the gradient, once in the surface colour at `dy = BAND`
 * — is what leaves the coloured band along the edge: no clip path, no mask, and
 * the band follows every curve for free.
 */
function edgeCommands(width: number, dy: number, phase: number, splash: number): string[] {
  'worklet';
  const left = RADIUS;
  const span = width - RADIUS * 2;
  const step = span / STEPS;
  const h = 0.5 / STEPS; // half a step, for the slope estimate

  const xs: number[] = [];
  const ys: number[] = [];
  const ms: number[] = []; // slope, in px of y per px of x
  for (let i = 0; i <= STEPS; i++) {
    const u = i / STEPS;
    xs.push(left + u * span);
    ys.push(dy + depth(u, phase, splash));
    ms.push((depth(u + h, phase, splash) - depth(u - h, phase, splash)) / (2 * h * span));
  }

  const out = [`Q 0 ${ys[0]} ${left} ${ys[0]}`];
  for (let i = 0; i < STEPS; i++) {
    const c = step / 3;
    out.push(
      `C ${xs[i] + c} ${ys[i] + ms[i] * c} ${xs[i + 1] - c} ${ys[i + 1] - ms[i + 1] * c} ${xs[i + 1]} ${ys[i + 1]}`,
    );
  }
  out.push(`Q ${width} ${ys[STEPS]} ${width} ${ys[STEPS] + RADIUS}`);
  return out;
}

/** The card's outline: the wave on top, straight down the sides and across. */
export function wavePath(
  width: number,
  height: number,
  dy = 0,
  phase = 0,
  splash = 0,
): string {
  'worklet';
  return [
    `M 0 ${height}`,
    `L 0 ${dy + depth(0, phase, splash) + RADIUS}`,
    ...edgeCommands(width, dy, phase, splash),
    `L ${width} ${height}`,
    'Z',
  ].join(' ');
}

/** Just that top edge, open — what the bloom is stroked along. */
export function waveEdgePath(width: number, phase = 0, splash = 0): string {
  'worklet';
  return [
    `M 0 ${depth(0, phase, splash) + RADIUS}`,
    ...edgeCommands(width, 0, phase, splash),
  ].join(' ');
}
