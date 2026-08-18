import { Inject, Injectable } from '@nestjs/common';
import {
  STT_ADAPTER,
  type SttAdapter,
} from '../ai-gateway/providers/stt.adapter';

export interface SpeakCheckResult {
  /** True when the spoken word matches the target closely enough. */
  correct: boolean;
  /** What the STT heard (shown back to the learner). */
  transcript: string;
  /** 0–1 closeness of transcript vs target (for partial feedback / tuning). */
  similarity: number;
}

/** Lowercase + strip anything that isn't a letter/number/space, collapse spaces. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance (small strings — a word or two). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similarity as 1 − normalizedEditDistance (1 = identical, 0 = nothing alike). */
function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const dist = editDistance(a, b);
  return 1 - dist / Math.max(a.length, b.length, 1);
}

/**
 * Speaking exercise — pronunciation check.
 *
 * Reuses the AI-gateway STT adapter (Gemini STT) the AI Buddy already
 * uses: the learner records a word, we transcribe it and compare to the target.
 * This is a "did you say the word" check, not phoneme-level scoring — enough for
 * a word-pronunciation drill, and it works today with no new provider.
 */
@Injectable()
export class SpeakingService {
  /** Accept at this closeness or above (allows a small STT slip). */
  private readonly PASS_THRESHOLD = 0.8;

  constructor(@Inject(STT_ADAPTER) private readonly stt: SttAdapter) {}

  async check(
    audio: Buffer,
    mime: string,
    target: string,
  ): Promise<SpeakCheckResult> {
    const { text } = await this.stt.transcribe(audio, mime);
    const heard = normalize(text);
    const want = normalize(target);
    const sim = similarity(heard, want);
    return {
      // Exact match, or the target word appears in a longer transcript, or the
      // fuzzy score clears the bar — any of these counts as said correctly.
      correct:
        heard === want ||
        heard.split(' ').includes(want) ||
        sim >= this.PASS_THRESHOLD,
      transcript: text,
      similarity: Number(sim.toFixed(2)),
    };
  }
}
