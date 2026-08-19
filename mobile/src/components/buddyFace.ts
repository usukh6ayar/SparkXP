/**
 * Facial animation data for the 3D buddy — the tables and timing maths behind
 * `BuddyAvatar`, kept out of the component so they stay readable and testable.
 *
 * The avatars are rigged with the standard **52 ARKit blendshapes**
 * (`jawOpen`, `mouthSmileLeft`, `browInnerUp`, …), so instead of the old
 * "open and close the mouth at random" jabber we can drive real mouth shapes
 * from the reply text and real expressions from the LLM's `emotion` tag.
 *
 * Lip-sync approach: the TTS provider returns audio only — no phoneme
 * timestamps — so we derive the mouth shapes from the text we already have and
 * stretch that sequence over the audio's duration. It is not frame-accurate
 * phonetics, but every syllable lands on a shape that matches the letters being
 * spoken, which is what reads as "it is actually saying this" on screen.
 */

/** blendshape name → weight (0–1). Names must match the ARKit rig exactly. */
export type Pose = Record<string, number>;

/** One mouth shape held for `ms` milliseconds. */
export interface Viseme {
  pose: Pose;
  ms: number;
}

/** Mouth shapes, keyed by the sound group they represent. */
const VISEMES = {
  /** a, ah — open jaw */
  AA: { pose: { jawOpen: 0.55, mouthLowerDownLeft: 0.2, mouthLowerDownRight: 0.2 }, ms: 110 },
  /** e, eh — half open, corners back */
  EH: { pose: { jawOpen: 0.3, mouthStretchLeft: 0.32, mouthStretchRight: 0.32 }, ms: 100 },
  /** i, ee — narrow, smiling */
  IY: { pose: { jawOpen: 0.16, mouthSmileLeft: 0.35, mouthSmileRight: 0.35, mouthStretchLeft: 0.2, mouthStretchRight: 0.2 }, ms: 95 },
  /** o — rounded and open */
  OW: { pose: { jawOpen: 0.42, mouthFunnel: 0.5, mouthPucker: 0.2 }, ms: 110 },
  /** u, oo, w — tight pucker */
  UW: { pose: { jawOpen: 0.16, mouthPucker: 0.68, mouthFunnel: 0.3 }, ms: 105 },
  /** m, b, p — lips pressed shut */
  MBP: { pose: { mouthClose: 0.8, mouthPressLeft: 0.45, mouthPressRight: 0.45 }, ms: 70 },
  /** f, v — lower lip to teeth */
  FV: { pose: { mouthRollLower: 0.35, mouthLowerDownLeft: 0.25, mouthLowerDownRight: 0.25, mouthUpperUpLeft: 0.15, mouthUpperUpRight: 0.15 }, ms: 70 },
  /** th — tongue between teeth */
  TH: { pose: { jawOpen: 0.2, tongueOut: 0.35 }, ms: 75 },
  /** l — tongue up, jaw slightly open */
  L: { pose: { jawOpen: 0.24, tongueOut: 0.14 }, ms: 70 },
  /** s, z, sh, ch, j — teeth close, corners wide */
  SZ: { pose: { jawOpen: 0.12, mouthStretchLeft: 0.28, mouthStretchRight: 0.28, mouthShrugUpper: 0.15 }, ms: 75 },
  /** k, g, ng, h — back of the mouth */
  KG: { pose: { jawOpen: 0.28 }, ms: 70 },
  /** r — rounded */
  R: { pose: { jawOpen: 0.2, mouthPucker: 0.32 }, ms: 75 },
  /** n, d, t — small opening */
  NDT: { pose: { jawOpen: 0.2, mouthShrugUpper: 0.1 }, ms: 65 },
  /** silence between words / sentences */
  REST: { pose: {}, ms: 90 },
} satisfies Record<string, Viseme>;

type VisemeKey = keyof typeof VISEMES;

/** Two-letter combinations that make one sound; checked before single letters. */
const DIGRAPHS: Record<string, VisemeKey> = {
  th: 'TH', sh: 'SZ', ch: 'SZ', ph: 'FV', wh: 'UW', gh: 'KG', ck: 'KG', ng: 'KG',
  ee: 'IY', ea: 'IY', oo: 'UW', ou: 'OW', ow: 'OW', oa: 'OW', ai: 'EH', ay: 'EH',
};

const LETTERS: Record<string, VisemeKey> = {
  a: 'AA', e: 'EH', i: 'IY', y: 'IY', o: 'OW', u: 'UW', w: 'UW',
  m: 'MBP', b: 'MBP', p: 'MBP', f: 'FV', v: 'FV', l: 'L',
  s: 'SZ', z: 'SZ', c: 'SZ', j: 'SZ', x: 'SZ',
  k: 'KG', g: 'KG', h: 'KG', q: 'KG', r: 'R',
  n: 'NDT', d: 'NDT', t: 'NDT',
};

/**
 * Turn a reply into a mouth-shape sequence. Letters that share a sound are
 * merged (no shape is re-triggered twice in a row) and word gaps become short
 * rests, so the jaw closes between words like a real speaker's does.
 */
export function textToVisemes(text: string): Viseme[] {
  const chars = text.toLowerCase();
  const out: Viseme[] = [];
  let last: VisemeKey | null = null;

  for (let i = 0; i < chars.length; i++) {
    const pair = chars.slice(i, i + 2);
    let key: VisemeKey | undefined = DIGRAPHS[pair];
    if (key) i++; // consumed both letters
    else key = LETTERS[chars[i]];

    if (!key) {
      // space, punctuation, or a non-Latin letter → a beat of silence
      if (last !== 'REST') { out.push({ ...VISEMES.REST }); last = 'REST'; }
      continue;
    }
    if (key === last) continue; // hold the shape rather than re-hitting it
    out.push({ ...VISEMES[key] });
    last = key;
  }
  return out;
}

/**
 * The pose at `timeMs` into a sequence, cross-faded between neighbours so the
 * mouth glides instead of snapping. `totalMs` (the real audio length when known)
 * stretches the sequence to match the voice; without it the natural sum is used.
 */
export function visemePoseAt(visemes: Viseme[], timeMs: number, totalMs?: number): Pose {
  if (!visemes.length) return {};
  const natural = visemes.reduce((sum, v) => sum + v.ms, 0);
  const rate = totalMs && totalMs > 0 ? natural / totalMs : 1; // >1 = speak faster
  const t = timeMs * rate;
  if (t >= natural) return {};

  let start = 0;
  for (let i = 0; i < visemes.length; i++) {
    const v = visemes[i];
    if (t < start + v.ms) {
      // Blend out over the last third of the shape into the next one.
      const into = (t - start) / v.ms;
      const next = visemes[i + 1];
      if (!next || into < 0.66) return v.pose;
      return blend(v.pose, next.pose, (into - 0.66) / 0.34);
    }
    start += v.ms;
  }
  return {};
}

/** Expression per LLM `emotion` tag (see BUDDY_EMOTIONS in the backend). */
export const EMOTION_POSES: Record<string, Pose> = {
  happy: {
    mouthSmileLeft: 0.62, mouthSmileRight: 0.62, cheekSquintLeft: 0.35, cheekSquintRight: 0.35,
    eyeSquintLeft: 0.25, eyeSquintRight: 0.25, browOuterUpLeft: 0.2, browOuterUpRight: 0.2,
  },
  encouraging: {
    mouthSmileLeft: 0.45, mouthSmileRight: 0.45, browInnerUp: 0.3,
    browOuterUpLeft: 0.25, browOuterUpRight: 0.25,
  },
  curious: {
    browInnerUp: 0.45, browOuterUpLeft: 0.35, browOuterUpRight: 0.15,
    eyeWideLeft: 0.3, eyeWideRight: 0.3, mouthSmileLeft: 0.15, mouthSmileRight: 0.15,
  },
  thinking: {
    browDownLeft: 0.35, browDownRight: 0.35, mouthPucker: 0.25, mouthShrugUpper: 0.2,
    eyeLookUpLeft: 0.3, eyeLookUpRight: 0.3, eyeSquintLeft: 0.2, eyeSquintRight: 0.2,
  },
  surprised: {
    browInnerUp: 0.7, browOuterUpLeft: 0.6, browOuterUpRight: 0.6,
    eyeWideLeft: 0.7, eyeWideRight: 0.7, jawOpen: 0.3,
  },
  confused: {
    browDownLeft: 0.5, browOuterUpRight: 0.45, mouthFrownLeft: 0.25,
    mouthPucker: 0.2, eyeSquintLeft: 0.25,
  },
  calm: { mouthSmileLeft: 0.12, mouthSmileRight: 0.12 },
};

/** Linear interpolation between two poses; missing shapes count as 0. */
export function blend(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = (a[key] ?? 0) * (1 - t) + (b[key] ?? 0) * t;
  }
  return out;
}

/** Merge poses, keeping the strongest weight per shape (speech beats expression). */
export function maxPose(...poses: Pose[]): Pose {
  const out: Pose = {};
  for (const pose of poses) {
    for (const [key, value] of Object.entries(pose)) {
      if (value > (out[key] ?? 0)) out[key] = value;
    }
  }
  return out;
}

/** Both eyes shut for ~140 ms, on a natural random rhythm (see BuddyAvatar). */
export function blinkPose(amount: number): Pose {
  return amount > 0.01 ? { eyeBlinkLeft: amount, eyeBlinkRight: amount } : {};
}

/** Rough speech duration (ms) when the audio length isn't known yet. */
export function estimateSpeechMs(text: string): number {
  return Math.max(800, text.trim().length * 62); // ~16 characters per second
}
