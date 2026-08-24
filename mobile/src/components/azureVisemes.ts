/**
 * Azure Speech `VisemeReceived` → ARKit blendshape poses.
 *
 * Azure's HD TTS reports, for every reply it synthesizes, a stream of
 * `(VisemeId, AudioOffset)` events: *which* mouth shape, and *when* in the audio
 * it starts. That is real timing produced by the same engine that produced the
 * voice, so the mouth can follow the actual speech instead of being guessed from
 * the reply text (see `textToVisemes` in `buddyFace.ts`, which stays as the
 * fallback for providers that give us audio only).
 *
 * Azure defines **22 viseme ids (0–21)**, each covering a group of phonemes.
 * The table below turns each one into a blend of ARKit shapes the avatars are
 * rigged with. The ids and their phoneme groups are Azure's, not ours — see
 * https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme
 *
 * Timing rule (docs/SparkXP Azure brief §4.4): never schedule these with
 * `setTimeout`. Poses are looked up **by the audio player's own clock**, so a
 * dropped frame or a stalled buffer just means the next lookup lands further
 * along the timeline — the mouth catches up instead of drifting.
 */
import { blend, type Pose } from './buddyFace';

/** One Azure viseme event: shape `id`, starting `offsetMs` into the audio. */
export interface VisemeCue {
  id: number;
  offsetMs: number;
}

/**
 * Cross-fade window between two visemes. The brief asks for 40–80 ms: below
 * that the mouth snaps, above it every shape is smeared into its neighbour.
 */
export const VISEME_BLEND_MS = 60;

/**
 * Azure viseme id → ARKit blendshape weights.
 *
 * Weights are deliberately conservative (mostly ≤ 0.7): they are composed with
 * the emotion layer afterwards, and a jaw pinned at 1.0 tears the mouth interior
 * on most rigs. Shape names must match the ARKit rig exactly — a typo here is
 * silent, the shape simply never moves.
 */
export const AZURE_VISEME_POSES: Record<number, Pose> = {
  /** 0 — silence */
  0: {},
  /** 1 — æ, ə, ʌ (mid-open neutral vowel) */
  1: { jawOpen: 0.34, mouthLowerDownLeft: 0.15, mouthLowerDownRight: 0.15 },
  /** 2 — ɑ (wide open) */
  2: { jawOpen: 0.62, mouthLowerDownLeft: 0.22, mouthLowerDownRight: 0.22 },
  /** 3 — ɔ (open + rounded) */
  3: { jawOpen: 0.48, mouthFunnel: 0.38, mouthPucker: 0.12 },
  /** 4 — ɛ, ʊ (half open; Azure groups a spread and a rounded vowel here) */
  4: { jawOpen: 0.28, mouthStretchLeft: 0.18, mouthStretchRight: 0.18, mouthFunnel: 0.12 },
  /** 5 — ɝ (r-coloured) */
  5: { jawOpen: 0.26, mouthPucker: 0.3, mouthFunnel: 0.15 },
  /** 6 — j, i, ɪ (narrow, corners back) */
  6: { jawOpen: 0.14, mouthSmileLeft: 0.3, mouthSmileRight: 0.3, mouthStretchLeft: 0.24, mouthStretchRight: 0.24 },
  /** 7 — w, u (tight pucker) */
  7: { jawOpen: 0.14, mouthPucker: 0.7, mouthFunnel: 0.28 },
  /** 8 — o (rounded, open) */
  8: { jawOpen: 0.4, mouthFunnel: 0.5, mouthPucker: 0.24 },
  /** 9 — aʊ (open → rounded diphthong) */
  9: { jawOpen: 0.52, mouthFunnel: 0.3, mouthPucker: 0.15 },
  /** 10 — ɔɪ (rounded → narrow diphthong) */
  10: { jawOpen: 0.4, mouthFunnel: 0.32, mouthSmileLeft: 0.15, mouthSmileRight: 0.15 },
  /** 11 — aɪ (open → narrow diphthong) */
  11: { jawOpen: 0.5, mouthStretchLeft: 0.2, mouthStretchRight: 0.2, mouthSmileLeft: 0.15, mouthSmileRight: 0.15 },
  /** 12 — h (relaxed, open) */
  12: { jawOpen: 0.3 },
  /** 13 — ɹ (rounded) */
  13: { jawOpen: 0.2, mouthPucker: 0.34, mouthFunnel: 0.12 },
  /** 14 — l (tongue to the ridge) */
  14: { jawOpen: 0.26, tongueOut: 0.16 },
  /** 15 — s, z (teeth nearly closed, corners wide) */
  15: { jawOpen: 0.1, mouthStretchLeft: 0.3, mouthStretchRight: 0.3, mouthShrugUpper: 0.14 },
  /** 16 — ʃ, tʃ, dʒ, ʒ (pushed forward) */
  16: { jawOpen: 0.16, mouthPucker: 0.38, mouthFunnel: 0.24 },
  /** 17 — ð (tongue between the teeth) */
  17: { jawOpen: 0.18, tongueOut: 0.3 },
  /** 18 — f, v (lower lip to the upper teeth) */
  18: { jawOpen: 0.08, mouthRollLower: 0.4, mouthLowerDownLeft: 0.24, mouthLowerDownRight: 0.24, mouthUpperUpLeft: 0.16, mouthUpperUpRight: 0.16 },
  /** 19 — d, t, n, θ (small opening, tongue up) */
  19: { jawOpen: 0.2, tongueOut: 0.12, mouthShrugUpper: 0.1 },
  /** 20 — k, g, ŋ (back of the mouth) */
  20: { jawOpen: 0.3 },
  /** 21 — p, b, m (lips pressed shut) */
  21: { mouthClose: 0.8, mouthPressLeft: 0.45, mouthPressRight: 0.45 },
};

/** Highest id Azure emits. Anything above this is a protocol change, not a shape. */
const MAX_VISEME_ID = 21;

/**
 * Normalize what the backend sent into a sorted, clean timeline.
 *
 * Defensive on purpose: this data crosses the network from a provider we don't
 * control. Out-of-range ids are dropped rather than silently rendered as
 * silence, and the cues are sorted because a lookup by binary search assumes it.
 */
export function toVisemeTimeline(
  raw: { id: number; offset_ms: number }[] | null | undefined,
): VisemeCue[] {
  if (!raw?.length) return [];
  return raw
    .filter((c) => Number.isFinite(c.offset_ms) && c.id >= 0 && c.id <= MAX_VISEME_ID)
    .map((c) => ({ id: c.id, offsetMs: Math.max(0, c.offset_ms) }))
    .sort((a, b) => a.offsetMs - b.offsetMs);
}

/**
 * Index of the last cue that has started by `timeMs`, or -1 before the first.
 *
 * Binary search rather than a moving cursor: when the render thread drops
 * frames (or the user seeks), the very next lookup must land on the shape that
 * belongs to *now*, not replay everything it missed.
 */
function cueIndexAt(cues: VisemeCue[], timeMs: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].offsetMs <= timeMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * The mouth pose at `timeMs` into the audio, cross-faded into the next shape
 * over the last `blendMs` before it starts.
 *
 * Returns an empty pose before the first cue and after the timeline ends, which
 * lets the face composer ease the mouth back to neutral on its own.
 */
export function azurePoseAt(
  cues: VisemeCue[],
  timeMs: number,
  blendMs: number = VISEME_BLEND_MS,
): Pose {
  if (!cues.length) return {};
  const i = cueIndexAt(cues, timeMs);
  if (i < 0) return {};

  const pose = AZURE_VISEME_POSES[cues[i].id] ?? {};
  const next = cues[i + 1];
  if (!next) return pose;

  const untilNext = next.offsetMs - timeMs;
  if (untilNext > blendMs) return pose;

  // Ease into the upcoming shape so the lips glide rather than snap.
  const t = 1 - Math.max(0, untilNext) / blendMs;
  return blend(pose, AZURE_VISEME_POSES[next.id] ?? {}, t);
}

/** When the last cue starts — used to know the timeline is spent. */
export function visemeTimelineEndMs(cues: VisemeCue[]): number {
  return cues.length ? cues[cues.length - 1].offsetMs : 0;
}
