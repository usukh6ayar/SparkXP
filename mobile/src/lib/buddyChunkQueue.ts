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
  /** Cues + emotion for the avatar, per piece. */
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

      handlers.onChunk?.(chunk);
      if (index === 0) handlers.onFirstAudio?.(chunk);

      // Wait for the previous piece to finish before replacing the source —
      // `replace` is immediate, so calling it early would truncate the reply.
      await waitForIdle(player, played);
      if (cancelled) break;
      player.replace({ uri: turnChunkAudioUrl(streamId, index), headers });
      player.play();
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
  const deadline = Date.now() + MAX_CHUNK_WAIT_MS;
  // A freshly-replaced source reports `playing: false` for a moment, so give
  // playback a beat to actually start before treating idle as "finished".
  await sleep(POLL_MS);
  while (Date.now() < deadline) {
    if (!player.playing) return;
    await sleep(POLL_MS);
  }
}

const POLL_MS = 120;
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
