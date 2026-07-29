import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Optional sound-effect helper — a tiny correct/wrong/XP "chime" layer on top of
 * haptics. Sound is OFF by default (many learners study in public); flip it from
 * the Settings switch, which calls `setSoundEnabled(true)`.
 *
 * The clips are short, synthesized tones (not any app's copyrighted sounds) that
 * live in `assets/sounds/`. The preference persists under `settings.sound` and
 * is restored on first import — so it survives a relaunch without React.
 *
 * Usage:
 *   import { sound } from '../lib/sound';
 *   sound.correct();   // on a right answer
 *   sound.wrong();     // on a wrong answer
 *   sound.xp();        // on XP earned
 */
type Effect = 'correct' | 'wrong' | 'xp';

const SOUND_KEY = 'settings.sound';

const SOURCES: Partial<Record<Effect, number>> = {
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  xp: require('../../assets/sounds/xp.wav'),
};

// Default OFF; only turned on if the saved preference says so.
let enabled = false;
AsyncStorage.getItem(SOUND_KEY)
  .then((v) => { enabled = v === '1'; })
  .catch(() => { /* keep the safe default */ });
// One reused player per effect (created lazily) so we don't leak players.
const players: Partial<Record<Effect, AudioPlayer>> = {};

/** Turn sound effects on/off (wired to the Settings switch) and persist it. */
export function setSoundEnabled(on: boolean) {
  enabled = on;
  AsyncStorage.setItem(SOUND_KEY, on ? '1' : '0').catch(() => { /* best-effort */ });
}

export function isSoundEnabled() {
  return enabled;
}

/** Read the persisted preference (default OFF) — to initialise the Settings switch. */
export async function loadSoundEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(SOUND_KEY)) === '1';
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
