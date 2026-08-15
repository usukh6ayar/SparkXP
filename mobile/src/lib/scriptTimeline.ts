import { useEffect, useRef, useState } from 'react';

/**
 * A seconds timeline for spoken script.
 *
 * Device-voice playback has no timeline at all: `expo-speech` reports "sentence
 * 3 started" and nothing else. That is why the listening bar could only ever say
 * "sentence 3 of 12" — a position no one thinks in. Estimating each sentence's
 * length from its word count gives every sentence a real start and end second,
 * which is enough for a clock (`1:04 / 3:12`), for a playhead that moves while a
 * sentence is being read, and for the segment ticks on the bar.
 *
 * These are estimates, and they drift a little on very long sentences. That is
 * fine: they only drive the readout and the scrub target, never the playback
 * itself, which stays sentence-accurate.
 */

/** Words per second the device voice manages at `rate` (0.9 = normal). */
const WORDS_PER_SECOND = 2.6;
/** No sentence reads as shorter than this, however few words it has. */
const MIN_SENTENCE_MS = 700;

/** How long the device voice takes to read `text` at `rate`, in milliseconds. */
export function speakMs(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  return Math.max(MIN_SENTENCE_MS, (words / (WORDS_PER_SECOND * (rate / 0.9))) * 1000);
}

export interface ScriptTimeline {
  /** Second each sentence starts at. */
  starts: number[];
  /** Seconds each sentence lasts. */
  durations: number[];
  /** Whole script length in seconds. */
  total: number;
}

export function buildTimeline(sentences: string[], rate: number): ScriptTimeline {
  const starts: number[] = [];
  const durations: number[] = [];
  let at = 0;
  for (const sentence of sentences) {
    const seconds = speakMs(sentence, rate) / 1000;
    starts.push(at);
    durations.push(seconds);
    at += seconds;
  }
  return { starts, durations, total: at };
}

/** Which sentence covers `second` — what a scrub lands on. */
export function sentenceAt(timeline: ScriptTimeline, second: number): number {
  const { starts } = timeline;
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    if (second >= starts[i]) return i;
  }
  return 0;
}

/** The seconds a sentence spans, for the "0:58 – 1:12" readout. */
export function sentenceRange(
  timeline: ScriptTimeline,
  index: number,
): { from: number; to: number } | null {
  const start = timeline.starts[index];
  if (start === undefined) return null;
  return { from: start, to: start + timeline.durations[index] };
}

/**
 * A moving second-hand for spoken script.
 *
 * The speech engine only tells us when a sentence *starts*, so a clock built
 * from that alone would sit still for ten seconds and then jump. This runs the
 * clock forward from the moment the sentence began, capped at that sentence's
 * estimated end so it can never run past into the next one — the display keeps
 * moving, and it stays honest about which sentence is being read.
 */
export function useScriptPosition(
  timeline: ScriptTimeline,
  index: number,
  playing: boolean,
): number {
  const [position, setPosition] = useState(0);
  const startedAt = useRef(Date.now());

  // A new sentence (or a scrub) restarts the run from its own start second.
  useEffect(() => {
    startedAt.current = Date.now();
    setPosition(timeline.starts[index] ?? 0);
  }, [index, timeline]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const start = timeline.starts[index] ?? 0;
      const end = start + (timeline.durations[index] ?? 0);
      setPosition(Math.min(end, start + (Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [playing, index, timeline]);

  return position;
}
