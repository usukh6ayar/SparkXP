import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

/** The shape `useReadAlong` needs from a passage sentence (see `api/reading.ts`). */
export interface ReadAlongSentence {
  text: string;
  audioUrl: string | null;
}

/**
 * Sequential "listen while you read" playback for a reading passage.
 *
 * The backend generates ONE audio file per sentence
 * (`POST /reading/:id/sentences/:index/generate-audio`), so following along is
 * just: play sentence N → when it ends, play N+1. That also means we always know
 * exactly which sentence is being spoken, which is what drives the highlight in
 * the reader — no word-level timings needed.
 *
 * **Sentences with no generated audio fall back to device TTS** (the same trick
 * the saved-words list uses). Without that, read-along would silently not exist
 * on every passage an admin has not voiced yet — which is most of them today.
 * The recorded ElevenLabs voice is always preferred when it is there.
 *
 * ## The one rule this file exists to keep
 *
 * **Exactly one voice at a time.** A sentence is either a file OR the device
 * voice, never both, and nothing here ever "rescues" a quiet sentence by
 * starting a second source — two overlapping readings is a far worse bug than
 * one silent sentence, and it is what a timeout-based fallback produces the
 * moment its "did it start?" guess is wrong.
 *
 * Usage:
 *   const read = useReadAlong(passage.sentences);
 *   <Pressable onPress={read.toggle} />
 *   <Text highlight={read.active === i} />
 */
export function useReadAlong(
  sentences: ReadAlongSentence[],
  options?: {
    /** Device-voice speed. 0.9 = normal; the listening exercise drops to 0.55
     *  for its "Удаан" toggle. Recorded audio ignores it. */
    rate?: number;
  },
) {
  const rate = options?.rate ?? 0.9;
  const player = useAudioPlayer();
  // Index of the sentence being spoken, or null when nothing is playing.
  const [active, setActive] = useState<number | null>(null);
  // Each source reports separately: the player via its status event, TTS not at
  // all (expo-speech has no "is speaking" state we can subscribe to).
  const [filePlaying, setFilePlaying] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);

  const activeRef = useRef<number | null>(null);
  // Which source is playing: 'file' advances on didJustFinish, 'tts' on onDone.
  const modeRef = useRef<'file' | 'tts'>('file');
  // Bumped on every play/stop/jump. It identifies "the sentence playing right
  // now", so a callback from an abandoned run (the user skipped, paused, or
  // left) cannot touch the new one.
  const runRef = useRef(0);
  // Always-current `playIndex`, so callbacks never fire a stale closure.
  const playRef = useRef<(i: number) => void>(() => {});
  /**
   * The run we have already advanced past. `didJustFinish` is a LATCHED flag,
   * not an edge — the player repeats it across several status updates — so
   * without this one line the chain would skip a sentence per repeat.
   */
  const advancedRunRef = useRef(-1);
  /** True while a TTS utterance is actually in flight (see `silence`). */
  const speakingRef = useRef(false);
  /** True while the student has deliberately paused, so nothing auto-resumes. */
  const pausedRef = useRef(false);
  /** True once the current file has produced sound — used only to kick a stalled load. */
  const startedRef = useRef(false);
  /** Mirror of `filePlaying` readable inside callbacks (state would be stale). */
  const filePlayingRef = useRef(false);
  /** Speed, in a ref so changing it never rebuilds the playback chain — that
   *  rebuild would cut the sentence being spoken in half. */
  const rateRef = useRef(rate);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  /**
   * Put the audio session into plain, audible playback before the first
   * sentence.
   *
   * The AI-buddy screen sets `allowsRecording: true` when the mic is held and
   * only clears it when a reply plays there. Walking away mid-recording leaves
   * the whole app in record mode, which on iOS routes playback to the EARPIECE —
   * every sound afterwards seems to "fade away to nothing". Read-along cannot
   * know what happened before it, so it just asserts the mode it needs.
   */
  const primeAudioSession = useCallback(
    () =>
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {
        // best-effort — a refused session change must not stop the reading
      }),
    [],
  );

  /**
   * Stop the device voice, but only when it is actually talking.
   *
   * Android's `TextToSpeech.stop()` is asynchronous: a `speak()` issued right
   * after one can be flushed by the still-pending stop, so the new sentence dies
   * a word or two in. Skipping the call when nothing is speaking — which is the
   * common case, since a sentence normally ends via `onDone` — removes that race
   * from the sentence-to-sentence path entirely.
   */
  const silence = useCallback(() => {
    if (!speakingRef.current) return;
    speakingRef.current = false;
    Speech.stop();
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    activeRef.current = null;
    advancedRunRef.current = -1;
    startedRef.current = false;
    pausedRef.current = false;
    setActive(null);
    setTtsSpeaking(false);
    // Same rule as in `playIndex`: only touch the player if it was the thing
    // making noise, so an idle pause can't tear the session out from under TTS.
    if (filePlayingRef.current) {
      filePlayingRef.current = false;
      setFilePlaying(false);
      try {
        player.pause();
      } catch {
        // best-effort — never break reading over playback
      }
    }
    silence();
  }, [player, silence]);

  /** Speak sentence `i` with the device voice, then roll on when it ends. */
  const speak = useCallback((i: number, run: number, text: string) => {
    modeRef.current = 'tts';
    setFilePlaying(false);
    setTtsSpeaking(true);
    speakingRef.current = true;
    Speech.speak(text, {
      language: 'en-US',
      rate: rateRef.current,
      onDone: () => {
        if (run !== runRef.current) return; // superseded by a newer run
        speakingRef.current = false;
        setTtsSpeaking(false);
        playRef.current(i + 1);
      },
      onStopped: () => {
        if (run !== runRef.current) return;
        speakingRef.current = false;
        setTtsSpeaking(false);
      },
      onError: () => {
        if (run !== runRef.current) return;
        speakingRef.current = false;
        setTtsSpeaking(false);
        playRef.current(i + 1); // a voice we can't use must not end the run
      },
    });
  }, []);

  /** Play sentence `i`, then roll on to the next one when it ends. */
  const playIndex = useCallback(
    (i: number) => {
      if (i < 0 || i >= sentences.length) {
        stop();
        return;
      }
      // Was a recorded file actually making noise a moment ago? Captured BEFORE
      // the per-sentence flags below are reset.
      const fileWasPlaying = modeRef.current === 'file' && filePlayingRef.current;

      const run = ++runRef.current;
      activeRef.current = i;
      advancedRunRef.current = -1;
      startedRef.current = false;
      pausedRef.current = false;
      setActive(i);
      const s = sentences[i];
      silence(); // no-op when the previous sentence ended on its own

      if (!s.audioUrl) {
        // No recorded audio for this sentence → device voice.
        //
        // Pause the file player ONLY if it was really playing. Pausing an idle
        // player still tears the audio session down, and that teardown lands a
        // moment AFTER `Speech.speak()` has started — which is exactly the
        // "reads the first word, the volume drops away, silence" symptom.
        if (fileWasPlaying) {
          try {
            player.pause();
          } catch {
            // best-effort
          }
        }
        speak(i, run, s.text);
        return;
      }

      modeRef.current = 'file';
      setTtsSpeaking(false);
      try {
        player.replace({ uri: s.audioUrl });
        player.play();
      } catch {
        speak(i, run, s.text); // unreachable file → read it instead
      }
    },
    [sentences, player, stop, silence, speak],
  );

  useEffect(() => {
    playRef.current = playIndex;
  }, [playIndex]);

  /**
   * Advance straight off the native status event rather than off a React state
   * edge (a `useEffect` on `status.didJustFinish`): consecutive `true`s coalesce
   * into a single render, so the chain used to die at whichever sentence that
   * happened on — the original "reads one or two, then silence".
   */
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      if (modeRef.current !== 'file') return;
      filePlayingRef.current = st.playing;
      setFilePlaying(st.playing);
      if (st.playing) startedRef.current = true;

      if (!st.didJustFinish) {
        // `replace()` + `play()` can race: the play lands before the new source
        // is ready and is dropped, leaving a loaded-but-silent player. Nudging
        // the SAME player is safe — unlike starting a second voice, it can only
        // ever produce the one reading we already wanted.
        if (st.isLoaded && !st.playing && !startedRef.current && !pausedRef.current) {
          try {
            player.play();
          } catch {
            // best-effort
          }
        }
        return;
      }

      const from = activeRef.current;
      if (from == null) return;
      if (advancedRunRef.current === runRef.current) return; // latch repeat
      advancedRunRef.current = runRef.current;
      playRef.current(from + 1);
    });
    return () => sub.remove();
  }, [player]);

  const playing = filePlaying || ttsSpeaking;

  /**
   * Start a run from idle. The session change is AWAITED: firing it alongside
   * the first `Speech.speak()` lets it land mid-word, which ducks or cuts the
   * sentence that just started.
   */
  const startFromIdle = useCallback(
    async (i: number) => {
      await primeAudioSession();
      playRef.current(i);
    },
    [primeAudioSession],
  );

  const toggle = useCallback(() => {
    const cur = activeRef.current;
    if (cur == null) {
      startFromIdle(0);
      return;
    }
    if (playing) {
      pausedRef.current = true;
      if (modeRef.current === 'tts') {
        // TTS has no pause/resume, so stopping ends the utterance; resuming
        // replays this sentence from its start. Bumping the run first stops the
        // ended utterance's `onDone` from advancing to the next sentence.
        runRef.current++;
        silence();
        setTtsSpeaking(false);
      } else {
        try {
          player.pause();
        } catch {
          // best-effort
        }
      }
      return;
    }
    pausedRef.current = false;
    if (modeRef.current === 'tts') playRef.current(cur);
    else player.play();
  }, [playing, player, silence, startFromIdle]);

  /**
   * Jump to a sentence (scrub bar, skip, resume).
   *
   * The session is re-primed EVERY time, not just from idle: a sound effect or
   * another screen can leave the app in a mode where the device voice comes out
   * silent, and the symptom is a player that looks like it is running while
   * nothing is heard. Re-asserting costs a millisecond and removes the class.
   */
  const jump = useCallback((i: number) => startFromIdle(Math.max(0, i)), [startFromIdle]);

  const next = useCallback(() => jump((activeRef.current ?? -1) + 1), [jump]);
  const prev = useCallback(() => jump(Math.max(0, (activeRef.current ?? 0) - 1)), [jump]);

  /** Stop the sound but keep the place (`toggle` resumes it). */
  const pause = useCallback(() => {
    if (playing) toggle();
  }, [playing, toggle]);

  /** Carry on from the sentence we stopped in. No-op if nothing was started. */
  const resume = useCallback(() => {
    if (!playing && activeRef.current != null) toggle();
  }, [playing, toggle]);

  // Leaving the screen (or loading another passage) must not keep talking.
  // Empty deps on purpose: this cleanup must run on UNMOUNT only. Depending on
  // `stop` would re-run it whenever that callback's identity changed, cutting
  // off a sentence mid-word for no reason.
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);
  useEffect(() => () => stopRef.current(), []);

  return {
    /** Sentence currently being spoken (null = idle) — drives the highlight. */
    active,
    /** True while audio is actually coming out, from either source. */
    playing,
    /** True when the admin generated real audio; false = device voice only. */
    hasRecordedAudio: sentences.some((s) => s.audioUrl),
    /** How many sentences there are — the scrub bar's segment count. */
    count: sentences.length,
    toggle,
    pause,
    resume,
    stop,
    next,
    prev,
    /** Jump straight to a sentence and play from there (scrubbing). */
    seek: jump,
  };
}
