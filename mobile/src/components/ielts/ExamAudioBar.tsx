import { useCallback, useEffect, useMemo } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AudioPlayer, type PlayerState } from '../audio/AudioPlayer';
import { useReadAlong } from '../../lib/useReadAlong';
import { splitScript } from '../../lib/script';
import {
  buildTimeline,
  sentenceAt,
  sentenceRange,
  useScriptPosition,
} from '../../lib/scriptTimeline';

/** How far the ⏪/⏩ buttons move recorded audio. */
const STEP_SECONDS = 10;
/** Device-voice speed the exam reads at (same as the normal exercise pace). */
const SCRIPT_RATE = 0.9;

/**
 * The recording a Listening part is answered from, pinned above the questions.
 *
 * Two sources, one control: a real file when admin uploaded one, otherwise the
 * device voice reading the authored script. The script path is not a downgrade
 * we chose — most sets are authored as text long before audio exists, and a
 * listening test with nothing to listen to is unanswerable.
 *
 * Playback is deliberately free here: play, pause, step and scrub as much as you
 * like. Locking it to a single play would be more exam-like and much less useful
 * for practice, which is what this is.
 */
export function ExamAudioBar({
  audioUrl,
  script,
}: {
  audioUrl?: string | null;
  script?: string | null;
}) {
  return audioUrl ? <RecordedBar uri={audioUrl} /> : <ScriptBar script={script ?? ''} />;
}

/** Real audio file: seconds come straight from the player. */
function RecordedBar({ uri }: { uri: string }) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const position = status.currentTime ?? 0;
  const duration = status.duration ?? 0;

  useEffect(() => {
    player.replace({ uri });
  }, [uri]);

  /*
   * ⚠️ Энд unmount дээр `player.pause()` дуудахгүй: `useAudioPlayer` нь
   * component салахад player-ээ өөрөө release хийдэг тул cleanup доторх
   * дуудлага «Calling the 'pause' function has failed» гэж унана.
   * Release хийгдэх нь тоглуулалтыг мөн зогсооно.
   */

  const seek = useCallback(
    (second: number) => {
      void player.seekTo(Math.max(0, Math.min(duration, second)));
    },
    [player, duration],
  );

  const state: PlayerState = {
    playing: status.playing,
    position,
    duration,
    toggle: () => (status.playing ? player.pause() : player.play()),
    seek,
    stepBack: () => seek(position - STEP_SECONDS),
    stepForward: () => seek(position + STEP_SECONDS),
  };

  return <AudioPlayer state={state} />;
}

/**
 * Device voice. The engine reports sentences, not seconds, so the timeline is
 * estimated from the text — see `scriptTimeline`. Stepping moves one sentence,
 * which is both the natural unit here and exactly where playback can land.
 */
function ScriptBar({ script }: { script: string }) {
  const lines = useMemo(() => splitScript(script), [script]);
  const sentences = useMemo(
    () => lines.map((text) => ({ text, audioUrl: null })),
    [lines],
  );
  const timeline = useMemo(() => buildTimeline(lines, SCRIPT_RATE), [lines]);
  const read = useReadAlong(sentences);

  useEffect(() => () => read.stop(), []);

  const index = read.active ?? 0;
  const position = useScriptPosition(timeline, index, read.playing);

  if (!lines.length) return null;

  const state: PlayerState = {
    playing: read.playing,
    position,
    duration: timeline.total,
    segment: {
      index,
      count: lines.length,
      ...(sentenceRange(timeline, index) ?? { from: 0, to: 0 }),
    },
    marks: timeline.starts,
    toggle: read.toggle,
    seek: (second) => read.seek(sentenceAt(timeline, second)),
    stepBack: () => read.seek(Math.max(0, index - 1)),
    stepForward: () => read.seek(Math.min(lines.length - 1, index + 1)),
  };

  return <AudioPlayer state={state} />;
}
