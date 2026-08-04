import type { ImageSourcePropType } from 'react-native';

/**
 * The four celebration worlds — the commissioned SparkXP key art, one per
 * scene, shown in rotation behind every "you finished it" moment.
 *
 * They ship as WebP (556KB for all four, vs ~10MB as 4K PNGs) and are drawn
 * `cover`, so any phone aspect crops rather than stretches.
 */

export type SceneKey = 'kingdom' | 'sky' | 'mountain' | 'space';

/** Rotation order. The student sees a different world each time they finish. */
export const SCENE_ORDER: readonly SceneKey[] = ['kingdom', 'sky', 'mountain', 'space'];

export interface Scene {
  art: ImageSourcePropType;
  /** English name, for the design gallery only — never shown to a student. */
  name: string;
  /**
   * How hard to wash the lower half down before the UI sits on it.
   *
   * All four artworks put the fox's face between roughly 27% and 50% of the
   * height, so the scrim always starts BELOW it (`SCRIM_START`) and the hero is
   * never buried. What changes per scene is only how much darkening the art
   * needs underneath: `mountain` is a bright blue-sky daylight plate and would
   * lose white text without a heavy wash, while `space` is already near-black.
   */
  scrim: number;
  /** Accent pulled from the art, for the XP figure and the eyebrow chip. */
  accent: string;
}

/** Where the readability wash begins, as a fraction of screen height. */
export const SCRIM_START = 0.42;
/** Where it reaches full strength. Everything below this is UI territory. */
export const SCRIM_FULL = 0.80;

export const SCENES: Record<SceneKey, Scene> = {
  kingdom: {
    art: require('../../../assets/celebration/kingdom.webp'),
    name: 'Royal Kingdom',
    scrim: 0.86,
    accent: '#FFC93C',
  },
  sky: {
    art: require('../../../assets/celebration/sky.webp'),
    name: 'Adventure Sky',
    scrim: 0.92,
    accent: '#FFD79A',
  },
  mountain: {
    art: require('../../../assets/celebration/mountain.webp'),
    name: 'Mountain Adventure',
    // The brightest plate of the four — daylight blue and lit green.
    scrim: 0.95,
    accent: '#FFC93C',
  },
  space: {
    art: require('../../../assets/celebration/space.webp'),
    name: 'Space Celebration',
    scrim: 0.84,
    accent: '#C4AEFF',
  },
};

/**
 * Deterministic PRNG (mulberry32).
 *
 * Sparkle positions must come from a seed, not `Math.random()`: the overlay
 * re-renders on state changes, and a fresh scatter each time makes the whole
 * layer jump.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The four-point "sparkle" — a square with its sides pulled into the centre.
 * `s` is the half-diagonal.
 */
export function sparklePath(s: number): string {
  const k = s * 0.16;
  return (
    `M0 ${-s}C${k} ${-k} ${k} ${-k} ${s} 0` +
    `C${k} ${k} ${k} ${k} 0 ${s}` +
    `C${-k} ${k} ${-k} ${k} ${-s} 0` +
    `C${-k} ${-k} ${-k} ${-k} 0 ${-s}Z`
  );
}
