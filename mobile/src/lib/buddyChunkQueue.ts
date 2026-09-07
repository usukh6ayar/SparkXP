import type { AudioPlayer } from 'expo-audio';
import {
  cancelTurnStream,
  turnChunkAudioUrl,
  waitForTurnChunk,
  type TurnAudioChunk,
} from '../api/ai';

/**
 * Plays a buddy reply piece by piece, starting as soon as the FIRST piece
 * exists instead of waiting for the whole reply.
 *
 * How it fits together: the caller fires the turn request and, at the same
 * moment, starts this runner with the same `streamId`. The server publishes
 * each piece of audio the moment its synthesis finishes, so playback begins
 * roughly a second before the turn request even returns.
 *
 * Two rules the implementation exists to guarantee:
 *
 *  - **Order.** Pieces are fetched sequentially (0, 1, 2 …) and played in that
 *    order. A reply spoken out of order is worse than a slow one.
 *  - **Nothing is dropped.** A piece that arrives while an earlier one is still
 *    playing waits in `pending` rather than cutting it off.
 */
export interface ChunkQueueHandlers {
  /** First audible audio — the number the latency target is written against. */
  onFirstAudio?: (chunk: TurnAudioChunk) => void;
  /**
   * Cues + text + emotion for the avatar — fired the moment the piece becomes
   * the player's source, NOT when it is fetched.
   *
   * The difference is the whole bug this callback used to have: a piece is
   * fetched while the previous one is still being spoken, so notifying on fetch
   * handed the avatar the NEXT piece's viseme timeline seconds early and the
   * mouth mimed the wrong words for the rest of the piece being heard.
   */
  onChunk?: (chunk: TurnAudioChunk) => void;
  /** Every piece has finished playing. */
  onDone?: () => void;
}

export interface ChunkQueue {
  /** Stop everything: playback, fetching, and the server's remaining work. */
  cancel: () => void;
  /** Resolves when the reply has finished (or was cancelled). */
  finished: Promise<void>;
  /** True once at least one piece has played — the fallback is then unwanted. */
  didPlay: () => boolean;
}

/**
 * Start consuming `streamId`'s audio into `player`.
 *
 * Never throws: any failure simply ends the queue, and the caller falls back to
 * the single `audio_url` on the turn response.
 */
export function startChunkQueue(
  player: AudioPlayer,
  streamId: string,
  token: string,
  handlers: ChunkQueueHandlers = {},
): ChunkQueue {
  let cancelled = false;
  let played = 0;
  const headers = { Authorization: `Bearer ${token}` };

  const finished = (async () => {
    for (let index = 0; !cancelled; index++) {
      const { chunk, aborted } = await waitForTurnChunk(streamId, index, token);
      if (aborted || !chunk || cancelled) break;

      // Wait for the previous piece to finish before replacing the source —
      // `replace` is immediate, so calling it early would truncate the reply.
      await waitForIdle(player, played);
      if (cancelled) break;
      player.replace({ uri: turnChunkAudioUrl(streamId, index), headers });
      player.play();
      // Announced HERE, not above: everything the avatar is told (mouth cues,
      // spoken text, emotion) describes the audio that is now playing.
      handlers.onChunk?.(chunk);
      if (index === 0) handlers.onFirstAudio?.(chunk);
      played += 1;
      if (chunk.last) break;
    }
    if (!cancelled) {
      await waitForIdle(player, played);
      handlers.onDone?.();
    }
  })().catch(() => undefined);

  return {
    cancel: () => {
      cancelled = true;
      try {
        player.pause();
      } catch {
        // best-effort — never break navigation over playback
      }
      void cancelTurnStream(streamId, token);
    },
    finished,
    didPlay: () => played > 0,
  };
}

/**
 * Resolve once the player is free to take a new source.
 *
 * `expo-audio` has no "ended" promise, so this samples `playing`. The first
 * piece never waits (`playedSoFar === 0`), which is the whole point: the very
 * first audio must start with no added delay.
 */
async function waitForIdle(player: AudioPlayer, playedSoFar: number): Promise<void> {
  if (playedSoFar === 0) return;
  // Phase 1 — wait for the piece to actually START.
  //
  // `replace()` points the player at a URL it has yet to fetch and decode, so
  // `playing` stays false for as long as that takes: over mobile data, well
  // past a single 120 ms beat. Treating that as "finished" is what cut pieces
  // off mid-word — the next `replace()` landed before a sound was made. Waiting
  // for the start first means "not playing" can only mean "played out".
  const startBy = Date.now() + START_GRACE_MS;
  while (Date.now() < startBy && !player.playing) await sleep(POLL_MS);
  // Phase 2 — wait for it to play out.
  const deadline = Date.now() + MAX_CHUNK_WAIT_MS;
  while (Date.now() < deadline && player.playing) await sleep(POLL_MS);
}

const POLL_MS = 120;
/** How long a freshly-replaced source may take to make its first sound. */
const START_GRACE_MS = 4_000;
/** A piece longer than this is assumed stuck; better to continue than to hang. */
const MAX_CHUNK_WAIT_MS = 30_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * A fresh id for one streamed reply.
 *
 * Generated on the **device** so the chunk long-poll can start in the same tick
 * as the turn request — waiting for the server to mint one would cost exactly
 * the round trip this whole mechanism exists to hide. `expo-crypto` is not a
 * dependency here and this id is a correlation handle, not a secret: it is
 * paired with the caller's own auth on every request.
 */
export function newStreamId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
