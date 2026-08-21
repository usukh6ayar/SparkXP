/**
 * Facial animation data for the 3D buddy — the tables and timing maths behind
 * `BuddyAvatar`, kept out of the component so they stay readable and testable.
 *
 * The avatars are rigged with the standard **52 ARKit blendshapes**
 * (`jawOpen`, `mouthSmileLeft`, `browInnerUp`, …), so instead of the old
 * "open and close the mouth at random" jabber we can drive real mouth shapes
 * from the reply text and real expressions from the LLM's `emotion` tag.
 *
 * Lip-sync has two sources and this file is the **fallback** one: when the TTS
 * provider returns audio without phoneme timestamps, the mouth shapes are
 * derived from the reply text and stretched over the audio's duration. Not
 * frame-accurate phonetics, but every syllable lands on a plausible shape.
 *
 * When the provider *does* send timing (Azure HD Voice `VisemeReceived`), those
 * cues win — see `azureVisemes.ts`. `composeFace` below is shared by both: it
 * is what decides how a mouth shape, an emotion and a blink coexist on one face.
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

/**
 * Expression per LLM `emotion` tag — all seven of `BUDDY_EMOTIONS` (backend
 * `src/common/enums`). An unknown tag falls back to `calm`.
 *
 * Written against the shapes the current buddy rigs actually ship (34 of the
 * ARKit 52 — the GLBs are exported without `cheekPuff`, `noseSneer*`,
 * `mouthDimple*`, `jaw` sideways, `eyeLook` other than up, and a few more).
 * Weights for shapes a rig does not have are silently written nowhere, so
 * nothing here is wasted — but nothing here can bring a missing shape back
 * either. `BuddyAvatar` logs what a rig is missing on load.
 */
export const EMOTION_POSES: Record<string, Pose> = {
  happy: {
    mouthSmileLeft: 0.7, mouthSmileRight: 0.7,
    // The cheeks are what separate a real smile from a stretched mouth.
    cheekSquintLeft: 0.45, cheekSquintRight: 0.45,
    eyeSquintLeft: 0.32, eyeSquintRight: 0.32,
    browOuterUpLeft: 0.22, browOuterUpRight: 0.22,
    // A hint of upper lip and jaw so the smile shows teeth rather than a seam.
    mouthUpperUpLeft: 0.18, mouthUpperUpRight: 0.18, jawOpen: 0.08,
  },
  encouraging: {
    mouthSmileLeft: 0.5, mouthSmileRight: 0.5,
    browInnerUp: 0.34, browOuterUpLeft: 0.28, browOuterUpRight: 0.28,
    cheekSquintLeft: 0.22, cheekSquintRight: 0.22,
    eyeWideLeft: 0.12, eyeWideRight: 0.12,
  },
  curious: {
    // Deliberately asymmetric: one brow higher is what reads as a question.
    browInnerUp: 0.45, browOuterUpLeft: 0.4, browOuterUpRight: 0.15,
    eyeWideLeft: 0.34, eyeWideRight: 0.34,
    mouthSmileLeft: 0.18, mouthSmileRight: 0.12,
    mouthPressLeft: 0.12, mouthPressRight: 0.12,
  },
  thinking: {
    browDownLeft: 0.38, browDownRight: 0.38,
    eyeLookUpLeft: 0.38, eyeLookUpRight: 0.38,
    eyeSquintLeft: 0.24, eyeSquintRight: 0.24,
    mouthPucker: 0.26, mouthShrugUpper: 0.24,
    mouthPressLeft: 0.2, mouthPressRight: 0.2,
  },
  surprised: {
    browInnerUp: 0.75, browOuterUpLeft: 0.65, browOuterUpRight: 0.65,
    eyeWideLeft: 0.75, eyeWideRight: 0.75,
    jawOpen: 0.34, mouthFunnel: 0.22,
    mouthStretchLeft: 0.1, mouthStretchRight: 0.1,
  },
  confused: {
    // One brow down, the other up — the classic lopsided "I don't follow".
    browDownLeft: 0.5, browOuterUpRight: 0.48,
    mouthFrownLeft: 0.3, mouthFrownRight: 0.16,
    mouthPucker: 0.2, mouthShrugUpper: 0.15, mouthRollLower: 0.14,
    eyeSquintLeft: 0.3, eyeSquintRight: 0.1,
  },
  calm: {
    mouthSmileLeft: 0.14, mouthSmileRight: 0.14,
    mouthPressLeft: 0.06, mouthPressRight: 0.06,
  },
};

/**
 * Expression per LLM `gesture` tag — all six of `BUDDY_GESTURES`.
 *
 * These exist because gestures were, until now, **invisible**: the avatar looked
 * for an animation clip named after the tag and these GLBs ship with no clips at
 * all, so every gesture the LLM asked for did nothing. A face can carry most of
 * a gesture on its own; `small_nod` additionally moves the head (see
 * `BuddyAvatar`), which is the one that genuinely needs motion.
 *
 * `wave` and `thumbs_up` are arm gestures and these rigs have no controllable
 * arms, so they are played as the FACE that goes with them — bright and direct.
 * That is honest: it reads as the buddy greeting you, not as a broken wave.
 */
export const GESTURE_POSES: Record<string, Pose> = {
  small_nod: {
    mouthSmileLeft: 0.34, mouthSmileRight: 0.34,
    eyeSquintLeft: 0.2, eyeSquintRight: 0.2,
    browOuterUpLeft: 0.15, browOuterUpRight: 0.15,
  },
  wave: {
    mouthSmileLeft: 0.62, mouthSmileRight: 0.62,
    cheekSquintLeft: 0.4, cheekSquintRight: 0.4,
    browInnerUp: 0.3, browOuterUpLeft: 0.35, browOuterUpRight: 0.35,
    eyeWideLeft: 0.2, eyeWideRight: 0.2, jawOpen: 0.12,
  },
  thumbs_up: {
    mouthSmileLeft: 0.55, mouthSmileRight: 0.55,
    cheekSquintLeft: 0.38, cheekSquintRight: 0.38,
    eyeSquintLeft: 0.34, eyeSquintRight: 0.34,
    browOuterUpLeft: 0.25, browOuterUpRight: 0.25,
  },
  think_pose: {
    browDownLeft: 0.42, browDownRight: 0.3,
    eyeLookUpLeft: 0.45, eyeLookUpRight: 0.45,
    mouthPucker: 0.3, mouthShrugUpper: 0.26,
    mouthPressLeft: 0.24, mouthPressRight: 0.24,
  },
  smile: {
    mouthSmileLeft: 0.5, mouthSmileRight: 0.5,
    cheekSquintLeft: 0.3, cheekSquintRight: 0.3,
    eyeSquintLeft: 0.22, eyeSquintRight: 0.22,
  },
  idle: {},
};

/** Linear interpolation between two poses; missing shapes count as 0. */
export function blend(a: Pose, b: Pose, t: number): Pose {
  const out: Pose = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = (a[key] ?? 0) * (1 - t) + (b[key] ?? 0) * t;
  }
  return out;
}

/**
 * Shapes the mouth owns. While the buddy is speaking these belong to the
 * viseme layer, because a held expression fighting a mouth shape is what makes
 * an avatar look like a puppet ("oo" spoken through a wide smile).
 */
const MOUTH_SHAPE = /^(mouth|jaw|cheekPuff|tongue)/;

/** How much of the emotion's own mouth weight survives while speaking (§6). */
const SPEAKING_MOUTH_DAMP = 0.25;

/**
 * Hard ceiling on that surviving weight. The damp alone is not enough: a strong
 * expression (a 0.9 smile) would still leave enough behind to fight an "oo".
 * A fixed ceiling makes the rule "while speaking, an emotion may only *tint* the
 * mouth" hold no matter how strongly a future emotion is authored.
 */
const SPEAKING_MOUTH_CEILING = 0.12;

/**
 * Compose the final face from its layers (Azure brief §6).
 *
 * The layers are NOT a simple max: they have different authority.
 *   - `emotion`    — owns the eyes and brows; its mouth weights are damped to a
 *                    hint while speech is running.
 *   - `mouth`      — the speech viseme, driven by the audio clock. It *replaces*
 *                    the mouth rather than competing with it.
 *   - `procedural` — blink / gaze / head. Rides on top and must never move the
 *                    mouth, so it is merged by max and applied last.
 *
 * Everything is clamped to 0–1: ARKit weights outside that range tear the mesh
 * on most rigs instead of exaggerating the shape.
 */
export function composeFace(
  emotion: Pose,
  mouth: Pose,
  procedural: Pose,
  speaking: boolean,
): Pose {
  const out: Pose = {};

  for (const [key, value] of Object.entries(emotion)) {
    out[key] = speaking && MOUTH_SHAPE.test(key)
      ? Math.min(value * SPEAKING_MOUTH_DAMP, SPEAKING_MOUTH_CEILING)
      : value;
  }
  // Speech wins outright on the shapes it sets — assignment, not max.
  for (const [key, value] of Object.entries(mouth)) out[key] = value;

  // Lips pressed shut (p/b/m) can't coexist with a dropped jaw, and a damped
  // emotion jaw is exactly what would keep them apart.
  if ((out.mouthClose ?? 0) > 0.4) out.jawOpen = Math.min(out.jawOpen ?? 0, 0.05);

  // A blink has to actually close the eye: `eyeWide`/`eyeSquint` hold the lid
  // open, so fade them out in proportion to how shut the eye should be.
  const blink = Math.max(procedural.eyeBlinkLeft ?? 0, procedural.eyeBlinkRight ?? 0);
  if (blink > 0) {
    for (const key of ['eyeWideLeft', 'eyeWideRight', 'eyeSquintLeft', 'eyeSquintRight']) {
      if (out[key]) out[key] *= 1 - blink;
    }
  }
  for (const [key, value] of Object.entries(procedural)) {
    out[key] = Math.max(out[key] ?? 0, value);
  }

  for (const key of Object.keys(out)) out[key] = Math.min(1, Math.max(0, out[key]));
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

/**
 * The 52 standard ARKit blendshapes, in Apple's order.
 *
 * Kept here so a rig can be checked against it at load time (Azure brief §5:
 * "52 ARKit blendshape байгаа нь дангаараа хангалтгүй"). A model that is
 * missing shapes doesn't crash — those weights are simply written nowhere —
 * which is exactly why it needs to be reported rather than discovered by
 * noticing that the buddy never closes its lips.
 */
export const ARKIT_52: readonly string[] = [
  'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft',
  'eyeSquintLeft', 'eyeWideLeft',
  'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight',
  'eyeSquintRight', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawRight', 'jawOpen',
  'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'noseSneerLeft', 'noseSneerRight', 'tongueOut',
];

/**
 * ARKit shapes the rig does NOT have. Compared lowercased, the same way
 * `BuddyAvatar` looks shapes up, so casing differences never show up as a
 * false "missing".
 */
export function missingArkitShapes(rigShapeNames: Iterable<string>): string[] {
  const have = new Set([...rigShapeNames].map((n) => n.toLowerCase()));
  return ARKIT_52.filter((name) => !have.has(name.toLowerCase()));
}
