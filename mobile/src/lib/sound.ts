import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Optional sound-effect helper — a tiny correct/wrong/XP "chime" layer on top of
 * haptics. Sound is OFF by default (many learners study in public); call
 * `setSoundEnabled(true)` from a settings toggle to turn it on.
 *
 * HOW TO ADD SOUNDS: drop short mp3/wav files in `assets/sounds/` and fill in
 * the `SOURCES` map below (uncomment the requires). Until then every call is a
 * safe no-op, so screens can wire `sound.correct()` etc. right now.
 *
 * Usage:
 *   import { sound } from '../lib/sound';
 *   sound.correct();   // on a right answer
 *   sound.wrong();     // on a wrong answer
 *   sound.xp();        // on XP earned
 */
type Effect = 'correct' | 'wrong' | 'xp';

// Fill these in once the audio files exist (kept empty so Metro doesn't try to
// bundle missing assets):
//   correct: require('../../assets/sounds/correct.mp3'),
const SOURCES: Partial<Record<Effect, number>> = {};

let enabled = false;
// One reused player per effect (created lazily) so we don't leak players.
const players: Partial<Record<Effect, AudioPlayer>> = {};

/** Turn sound effects on/off (wire to a settings switch). */
export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export function isSoundEnabled() {
  return enabled;
}

function play(effect: Effect) {
  if (!enabled) return;
  const src = SOURCES[effect];
  if (src == null) return; // no asset wired yet → no-op
  try {
    let player = players[effect];
    if (!player) {
      player = createAudioPlayer(src);
      players[effect] = player;
    }
    player.seekTo(0);
    player.play();
  } catch {
    // playback is best-effort — never crash a learning flow over a sound
  }
}

export const sound = {
  correct: () => play('correct'),
  wrong: () => play('wrong'),
  xp: () => play('xp'),
};
