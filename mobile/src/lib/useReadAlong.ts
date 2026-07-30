import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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
 * Usage:
 *   const read = useReadAlong(passage.sentences);
 *   <Pressable onPress={read.toggle} />
 *   <Text highlight={read.active === i} />
 */
export function useReadAlong(sentences: ReadAlongSentence[]) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  // Index of the sentence being spoken, or null when nothing is playing.
  const [active, setActive] = useState<number | null>(null);
  // The audio player reports its own `playing`; TTS does not, so we track it.
  const [ttsSpeaking, setTtsSpeaking] = useState(false);

  const activeRef = useRef<number | null>(null);
  // Which source is playing: 'file' advances on didJustFinish, 'tts' on onDone.
  const modeRef = useRef<'file' | 'tts'>('file');
  // Bumped on every stop/jump, so a late TTS callback from an abandoned run
  // (the user skipped or left) cannot advance the new one.
  const runRef = useRef(0);
  // Always-current `playIndex`, so TTS callbacks never fire a stale closure.
  const playRef = useRef<(i: number) => void>(() => {});

  const stop = useCallback(() => {
    runRef.current++;
    activeRef.current = null;
    setActive(null);
    setTtsSpeaking(false);
    try {
      player.pause();
    } catch {
      // best-effort — never break reading over playback
    }
    Speech.stop();
  }, [player]);

  /** Speak sentence `i`, then roll on to the next one when it ends. */
  const playIndex = useCallback(
    (i: number) => {
      if (i < 0 || i >= sentences.length) {
        stop();
        return;
      }
      const run = ++runRef.current;
      activeRef.current = i;
      setActive(i);
      const s = sentences[i];
      Speech.stop();

      if (s.audioUrl) {
        modeRef.current = 'file';
        setTtsSpeaking(false);
        try {
          player.replace({ uri: s.audioUrl });
          player.play();
        } catch {
          playRef.current(i + 1); // unreachable file → don't stall the run
        }
        return;
      }

      // No recorded audio for this sentence → device voice.
      modeRef.current = 'tts';
      try {
        player.pause();
      } catch {
        // best-effort
      }
      setTtsSpeaking(true);
      Speech.speak(s.text, {
        language: 'en-US',
        rate: 0.9,
        onDone: () => {
          if (run !== runRef.current) return; // superseded by a newer run
          setTtsSpeaking(false);
          playRef.current(i + 1);
        },
        onStopped: () => {
          if (run === runRef.current) setTtsSpeaking(false);
        },
        onError: () => {
          if (run !== runRef.current) return;
          setTtsSpeaking(false);
          playRef.current(i + 1);
        },
      });
    },
    [sentences, player, stop],
  );

  useEffect(() => {
    playRef.current = playIndex;
  }, [playIndex]);

  // A recorded sentence finished → next one. TTS advances via its own onDone.
  useEffect(() => {
    if (!status.didJustFinish) return;
    if (modeRef.current !== 'file') return;
    const from = activeRef.current;
    if (from == null) return;
    playRef.current(from + 1);
  }, [status.didJustFinish]);

  const playing = status.playing || ttsSpeaking;

  const toggle = useCallback(() => {
    const cur = activeRef.current;
    if (cur == null) {
      playRef.current(0);
      return;
    }
    if (playing) {
      if (modeRef.current === 'tts') {
        // TTS has no pause/resume, so stopping ends the utterance; resuming
        // replays this sentence from its start.
        runRef.current++;
        Speech.stop();
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
    if (modeRef.current === 'tts') playRef.current(cur);
    else player.play();
  }, [playing, player]);

  const next = useCallback(() => playRef.current((activeRef.current ?? -1) + 1), []);
  const prev = useCallback(() => playRef.current(Math.max(0, (activeRef.current ?? 0) - 1)), []);

  // Leaving the screen (or loading another passage) must not keep talking.
  useEffect(() => stop, [stop]);

  return {
    /** Sentence currently being spoken (null = idle) — drives the highlight. */
    active,
    /** True while audio is actually coming out, from either source. */
    playing,
    /** True when the admin generated real audio; false = device voice only. */
    hasRecordedAudio: sentences.some((s) => s.audioUrl),
    toggle,
    stop,
    next,
    prev,
  };
}
