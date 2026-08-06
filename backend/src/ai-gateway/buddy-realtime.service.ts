import {
  ForbiddenException,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Observable, ReplaySubject } from 'rxjs';
import { BuddyService, TurnResponse } from './buddy.service';

/**
 * REALTIME BUDDY — a streaming delivery layer *over* the existing turn pipeline.
 *
 * It does NOT replace `BuddyService`: every turn still runs the exact same
 * request-response pipeline (STT → LLM JSON contract → safety gate → TTS → XP →
 * memory) via `buddy.textTurn` / `buddy.audioTurn`. What this adds is progressive
 * DELIVERY over Server-Sent Events — the transcript, then the validated reply
 * streamed sentence by sentence, then the audio, then the full turn — plus the
 * ability to interrupt the remaining stream.
 *
 * Why deliver the *validated* turn progressively rather than stream raw LLM
 * tokens: the buddy reply is a validated JSON contract that must clear the
 * safety gate as a whole before a single word is spoken to a child. Streaming
 * unvalidated tokens would defeat that, so the turn is computed first and then
 * revealed — the perceived-latency win (early transcript + progressive reveal +
 * interrupt) without weakening safety.
 *
 * Transport is native SSE (no new dependency). Clients that cannot consume a
 * stream fall back to the plain REST turn endpoints, which are untouched.
 */

interface StreamEntry {
  userId: string;
  subject: ReplaySubject<MessageEvent>;
  aborted: boolean;
  createdAt: number;
}

/** Abandoned streams are swept after this long; a finished one lingers briefly
 *  so a slightly-late SSE subscriber still replays every event. */
const STREAM_TTL_MS = 5 * 60_000;
const FINISHED_RETAIN_MS = 10_000;
/** Gap between streamed sentences — enough to read as a live reveal. */
const CHUNK_DELAY_MS = 120;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Split a reply into speakable sentence chunks (punctuation kept). */
function toSentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]*\s*/g);
  const chunks = (parts ?? [text]).map((s) => s.trim()).filter(Boolean);
  return chunks.length ? chunks : [text.trim()].filter(Boolean);
}

@Injectable()
export class BuddyRealtimeService {
  private readonly log = new Logger('BuddyRealtime');
  private readonly streams = new Map<string, StreamEntry>();

  constructor(
    private readonly buddy: BuddyService,
    private readonly config: ConfigService,
  ) {}

  /** Realtime is on unless explicitly disabled — clients still probe first. */
  private get enabled(): boolean {
    return this.config.get<string>('BUDDY_REALTIME_ENABLED', '1') !== '0';
  }

  /** What the client uses to decide streaming vs. the REST fallback. */
  capabilities() {
    return {
      enabled: this.enabled,
      transport: 'sse',
      streamingText: true,
      /** One validated clip, delivered + interruptible (not token-level TTS). */
      streamingTts: 'progressive',
      /** Needs a streaming STT transport, which the current providers lack. */
      partialTranscript: false,
      interrupt: true,
      fallback: 'request-response',
    };
  }

  startTextTurn(
    userId: string,
    sessionId: string,
    text: string,
  ): { streamId: string } {
    return this.start(userId, () =>
      this.buddy.textTurn(userId, sessionId, text),
    );
  }

  startAudioTurn(
    userId: string,
    sessionId: string,
    file: { buffer: Buffer; mimetype: string },
  ): { streamId: string } {
    return this.start(userId, () =>
      this.buddy.audioTurn(userId, sessionId, file),
    );
  }

  /** SSE stream for a started turn (ownership-checked). */
  stream(userId: string, streamId: string): Observable<MessageEvent> {
    return this.require(userId, streamId).subject.asObservable();
  }

  /** Interrupt an in-flight turn — the remaining sentences stop streaming. */
  interrupt(userId: string, streamId: string): { ok: true } {
    this.require(userId, streamId).aborted = true;
    return { ok: true };
  }

  private start(
    userId: string,
    run: () => Promise<TurnResponse>,
  ): { streamId: string } {
    if (!this.enabled)
      throw new ServiceUnavailableException('Realtime buddy идэвхгүй');
    this.sweep();
    const streamId = randomUUID();
    const entry: StreamEntry = {
      userId,
      subject: new ReplaySubject<MessageEvent>(),
      aborted: false,
      createdAt: Date.now(),
    };
    this.streams.set(streamId, entry);
    // Fire-and-forget: the SSE consumer subscribes on the separate GET.
    void this.process(streamId, entry, run);
    return { streamId };
  }

  private require(userId: string, streamId: string): StreamEntry {
    const entry = this.streams.get(streamId);
    if (!entry) throw new NotFoundException('Урсгал олдсонгүй');
    if (entry.userId !== userId) throw new ForbiddenException();
    return entry;
  }

  private async process(
    streamId: string,
    entry: StreamEntry,
    run: () => Promise<TurnResponse>,
  ): Promise<void> {
    const emit = (type: string, payload: Record<string, unknown> = {}) =>
      entry.subject.next({ data: { type, ...payload } } as MessageEvent);
    try {
      emit('status', { value: 'processing' });
      // Reuse the ENTIRE existing pipeline — the turn is fully validated and
      // safety-checked before we stream a single word.
      const turn = await run();
      if (entry.aborted) return emit('interrupted');

      emit('transcript', { text: turn.user_transcript, final: true });

      for (const sentence of toSentences(turn.reply_text)) {
        if (entry.aborted) return emit('interrupted');
        emit('chunk', { text: sentence });
        await sleep(CHUNK_DELAY_MS);
      }

      if (!entry.aborted && turn.audio_url)
        emit('audio', { url: turn.audio_url });
      // The full turn — byte-identical to the REST response — so the client has
      // correction / follow-up / XP / usage / avatar instruction in one place.
      emit('done', { turn });
    } catch (err) {
      this.log.warn(`realtime turn failed: ${(err as Error)?.message ?? err}`);
      // Signal the client to retry on the plain REST endpoint.
      emit('error', { message: 'realtime_failed' });
    } finally {
      entry.subject.complete();
      setTimeout(() => this.streams.delete(streamId), FINISHED_RETAIN_MS);
    }
  }

  /** Drop streams that were started but never consumed (e.g. client vanished). */
  private sweep(): void {
    const now = Date.now();
    for (const [id, e] of this.streams) {
      if (now - e.createdAt > STREAM_TTL_MS) {
        e.subject.complete();
        this.streams.delete(id);
      }
    }
  }
}
