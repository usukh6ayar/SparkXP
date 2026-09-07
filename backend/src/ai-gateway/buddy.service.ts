import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { BuddySession } from '../entities/buddy-session.entity';
import { Message } from '../entities/message.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { AiBuddy } from '../entities/ai-buddy.entity';
import { User } from '../entities/user.entity';
import { BuddyVoiceCache } from '../entities/buddy-voice-cache.entity';
import { SafetyEvent } from '../entities/safety-event.entity';
import {
  AiUsageType,
  BuddySessionMode,
  MessageRole,
  XpSource,
} from '../common/enums';
import { ImageStorageService } from './image-storage.service';
import { AiGatewayService } from './ai-gateway.service';
import { BuddyUsageService } from './buddy-usage.service';
import { BuddyMemoryService } from './buddy-memory.service';
import { XpService } from '../xp/xp.service';
import { startOfUBDay } from '../xp/gamification';
import { STT_ADAPTER, type SttAdapter } from './providers/stt.adapter';
import {
  LLM_ADAPTER,
  type LlmAdapter,
  type LlmMessage,
} from './providers/llm.adapter';
import { llmCostMicroUsd } from './providers/llm-pricing';
import { isTranscribePromptEcho } from './providers/gemini-stt.adapter';
import {
  TTS_ADAPTER,
  type TtsAdapter,
  type TtsResult,
  type VisemeCue,
} from './providers/tts.adapter';
import { BuddyTurnStreamService } from './buddy-turn-stream.service';
import { readJsonStringField, takeSpeakableChunks } from './streaming-reply';
import {
  BuddyTurnResult,
  FALLBACK_TURN,
  buildBuddySystemPrompt,
  parseBuddyTurn,
} from './buddy-contract';
import { StartSessionDto } from './dto/buddy-turn.dto';

/** Common prompt-injection markers, for audit logging only. */
const INJECTION_MARKERS = [
  'ignore previous instructions',
  'ignore all previous',
  'system prompt',
  'disregard the above',
  'you are now',
];
function looksLikeInjection(text: string): boolean {
  const lower = text.toLowerCase();
  return INJECTION_MARKERS.some((m) => lower.includes(m));
}

/** Safe reply used when the LLM flags unsafe content. */
const SAFE_REDIRECT = "Let's keep practicing English! What did you do today?";

/** Shape returned to the client for one turn (docx §10). */
export interface TurnResponse {
  session_id: string;
  message_id: string;
  /**
   * Энэ turn-ийн латенсийн бүртгэлийн богино id (серверийн лог, хадгалагдсан
   * `metadata.latency`, клиентийн буцаах тайлан гурвуулаа үүгээр холбогдоно).
   *
   * Нэмэлт талбар: хуучин апп үүнийг үл тоомсорлоно.
   */
  turn_id?: string;
  user_transcript: string;
  reply_text: string;
  correction: {
    original: string;
    corrected: string;
    short_explanation: string;
  } | null;
  follow_up_question: string;
  /** Grammar/vocab tags for this turn's mistake; [] when none. */
  mistake_tags: string[];
  /** XP granted by THIS turn (0 if already awarded earlier this session). */
  xp_reward: number;
  audio_url: string | null;
  /**
   * Lip-sync timeline for `audio_url` — Azure viseme ids (0–21) with the ms
   * offset each one starts at. Omitted when the TTS provider reports no timing
   * (Gemini), in which case the app derives mouth shapes from `reply_text`.
   */
  visemes?: { id: number; offset_ms: number }[];
  avatar_instruction: { emotion: string; gesture: string; duration_ms: number };
  usage: {
    voice_seconds_used_this_month: number;
    voice_seconds_limit_this_month: number | null;
    warn_level: string;
  };
}

/**
 * Нэг turn-ийн латенсийн бүртгэл (латенсийн төлөвлөгөө §1: t0–t9).
 *
 * Гаргах ёстой тоо нь **t0 → эхний сонсогдох аудио**, түүнийг зөвхөн шат бүрийн
 * цагийг тэмдэглэж байж хамгаалж чадна. Тэмдэглэгээ нь assistant мессежийн
 * `metadata.latency`-д бичигдэнэ → p50/p95 нь секундомер, таамаг биш нэг SQL
 * асуулгаас гарна.
 *
 * Цагийн эзэмшил хуваарилагдсан:
 *  - **Клиент** t0 (хэрэглэгч ярихаа болив), t7 (аудио сонсогдов),
 *    t8 (эхний viseme), t9 (тоглуулалт дуусав) — `reportClientLatency`-аар
 *    буцаж ирнэ;
 *  - **Сервер** t1–t6 ба хадгалалт.
 *
 * `t0`-г клиент epoch-оор илгээдэг тул `upload_ms` нь сүлжээ + файл байршуулах
 * хугацааг агуулна. Цагийн зөрүү (clock skew) сөрөг тоо өгвөл хаяна —
 * хэрэглэгчийн утасны цагийг найдвартай гэж үзэх аргагүй.
 */
export class TurnTimer {
  /** Нэг turn-ийг бүх лог/хэмжигдэхүүн дундуур холбох id. */
  readonly turnId = randomUUID().slice(0, 8);
  private readonly startedAt = Date.now();
  private last = this.startedAt;
  private readonly stages: Record<string, number> = {};

  /**
   * @param clientT0 хэрэглэгч ярихаа больсон агшин (клиентийн epoch, ms).
   */
  constructor(private readonly clientT0?: number) {
    if (clientT0 && this.startedAt > clientT0) {
      // t0 → сервер хүсэлтийг хүлээж авав: сүлжээ + аудио байршуулалт.
      this.stages.upload_ms = this.startedAt - clientT0;
    }
  }

  /** Close the current stage and open the next one. */
  mark(stage: string): void {
    const now = Date.now();
    this.stages[`${stage}_ms`] = now - this.last;
    this.last = now;
  }

  /**
   * Шатны дарааллаас гадуурх хэмжилт (ж: провайдерын эхний байт хүртэлх хугацаа
   * нь `tts` шатны ДОТОР байдаг тул `mark` түүнийг илэрхийлж чадахгүй).
   */
  set(stage: string, ms: number | null | undefined): void {
    if (typeof ms === 'number' && ms >= 0) this.stages[`${stage}_ms`] = ms;
  }

  /** Turn эхэлснээс хойшхи ms — урсгал доторх цэгүүдийг тэмдэглэхэд. */
  sinceStart(): number {
    return Date.now() - this.startedAt;
  }

  /** Тухайн цэг аль хэдийн тэмдэглэгдсэн эсэх (эхнийхийг л барихад). */
  has(stage: string): boolean {
    return this.stages[`${stage}_ms`] !== undefined;
  }

  /**
   * Сервер талын нийт хугацаа. `upload_ms` мэдэгдэж байвал t0-оос эхэлж
   * тоолсон нийлбэрийг мөн өгнө — энэ нь клиентийн t7 ирэхээс өмнөх хамгийн
   * ойрын E2E тооцоо.
   */
  snapshot(): Record<string, number | string> {
    const serverTotal = Date.now() - this.startedAt;
    return {
      turn_id: this.turnId,
      ...this.stages,
      server_total_ms: serverTotal,
      ...(this.stages.upload_ms !== undefined
        ? { t0_to_response_ms: this.stages.upload_ms + serverTotal }
        : {}),
    };
  }
}

/**
 * Урсгалт turn-д бодитоор ярьсан нэг хэсэг.
 *
 * Тоглуулах аудио нь `BuddyTurnStreamService`-ийн санах ойд байна; энд зөвхөн
 * turn-ийг хадгалах/буцаахад хэрэгтэй мета үлдэнэ.
 */
interface SpokenChunk {
  index: number;
  text: string;
  durationMs: number;
  visemes: VisemeCue[] | null;
}

/**
 * LLM-ийн гаралтын дээд хязгаар. Урт хяналт БИШ, тасралтаас хамгаалах хаалт:
 * JSON дугтуйд (засвар + монгол тайлбар) багтаах ёстой. Урт нь prompt болон
 * `parseBuddyTurn`-ээр хянагдана.
 */
const LLM_MAX_TOKENS = 500;

/** One stored message flattened for the chat UI (resumeTextSession). */
export interface SerializedBuddyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  correction: {
    original: string;
    corrected: string;
    short_explanation: string;
  } | null;
  followUp: string | null;
  audioUrl: string | null;
}

/** One row in the ChatGPT-style history panel (a past typed-chat thread). */
export interface TextSessionSummary {
  sessionId: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

function serializeBuddyMessage(m: Message): SerializedBuddyMessage {
  const meta = (m.metadata ?? {}) as {
    correction?: {
      original?: string;
      corrected?: string;
      short_explanation?: string;
    } | null;
    follow_up_question?: string;
  };
  return {
    id: m.id,
    role: m.role === MessageRole.USER ? 'user' : 'assistant',
    content: m.content,
    correction: meta.correction
      ? {
          original: meta.correction.original ?? '',
          corrected: meta.correction.corrected ?? '',
          short_explanation: meta.correction.short_explanation ?? '',
        }
      : null,
    followUp: meta.follow_up_question ?? null,
    audioUrl: m.audioUrl ?? null,
  };
}

/**
 * Урсгалаар ярьсан хэсгүүдийг нэг turn-ийн хариу болгон нийлүүлнэ.
 *
 * Viseme-ийн `offsetMs` нь **хэсэг бүрийн дотор** 0-ээс эхэлдэг тул хуримтлагдсан
 * үргэлжлэх хугацаагаар шилжүүлэхгүй бол бүх хэсгийн уруул эхний хэсэг дээр
 * давхарлан хөдөлнө.
 */
function mergeSpokenChunks(chunks: SpokenChunk[]): {
  audioUrl: string | null;
  durationMs: number;
  visemes: VisemeCue[] | null;
} {
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  const visemes: VisemeCue[] = [];
  let durationMs = 0;
  for (const chunk of ordered) {
    for (const cue of chunk.visemes ?? []) {
      visemes.push({ id: cue.id, offsetMs: cue.offsetMs + durationMs });
    }
    durationMs += chunk.durationMs;
  }
  return {
    audioUrl: null,
    durationMs,
    visemes: visemes.length ? visemes : null,
  };
}

@Injectable()
export class BuddyService {
  private readonly logger = new Logger(BuddyService.name);

  constructor(
    @InjectRepository(BuddySession)
    private readonly sessions: Repository<BuddySession>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(AiBuddy) private readonly buddies: Repository<AiBuddy>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(BuddyVoiceCache)
    private readonly voiceCache: Repository<BuddyVoiceCache>,
    @InjectRepository(SafetyEvent)
    private readonly safetyEvents: Repository<SafetyEvent>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(STT_ADAPTER) private readonly stt: SttAdapter,
    @Inject(LLM_ADAPTER) private readonly llm: LlmAdapter,
    @Inject(TTS_ADAPTER) private readonly tts: TtsAdapter,
    private readonly imageStorage: ImageStorageService,
    private readonly turnStreams: BuddyTurnStreamService,
    private readonly gateway: AiGatewayService,
    private readonly usage: BuddyUsageService,
    private readonly memory: BuddyMemoryService,
    private readonly xp: XpService,
  ) {}

  // ── Sessions ────────────────────────────────────────────────────────────

  async startSession(
    userId: string,
    dto: StartSessionDto,
  ): Promise<{
    sessionId: string;
    buddy: AiBuddy;
    usage: TurnResponse['usage'];
  }> {
    const buddy = await this.buddies.findOne({
      where: { slug: dto.buddySlug, isActive: true },
    });
    if (!buddy) throw new NotFoundException('Buddy олдсонгүй');

    const session = await this.sessions.save(
      this.sessions.create({
        userId,
        buddySlug: dto.buddySlug,
        mode: dto.mode ?? BuddySessionMode.VOICE,
        topic: dto.topic ?? null,
      }),
    );
    const user = await this.loadUser(userId);
    const allowance = await this.usage.checkVoice(user);
    return { sessionId: session.id, buddy, usage: this.usageBlock(allowance) };
  }

  /**
   * End a session and report its length. Idempotent: calling it on an already
   * ended session just returns the stored duration (a double-tap or a reconnect
   * can't reset the clock). Duration is derived from `created_at → ended_at`, so
   * no extra column is stored.
   */
  async endSession(
    userId: string,
    sessionId: string,
  ): Promise<{ sessionId: string; durationSeconds: number; endedAt: string }> {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session олдсонгүй');
    if (!session.endedAt) {
      session.endedAt = new Date();
      await this.sessions.save(session);
    }
    const durationSeconds = Math.max(
      0,
      Math.round(
        (session.endedAt.getTime() - session.createdAt.getTime()) / 1000,
      ),
    );
    return {
      sessionId: session.id,
      durationSeconds,
      endedAt: session.endedAt.toISOString(),
    };
  }

  /**
   * AI Buddy usage stats for the current user: session counts and practice
   * minutes (today + all-time), computed from `buddy_sessions` (ended sessions
   * only, so an abandoned session doesn't inflate the numbers).
   */
  async getStatistics(userId: string): Promise<{
    totalSessions: number;
    totalMinutes: number;
    todaySessions: number;
    todayMinutes: number;
    longestSessionMinutes: number;
  }> {
    const dur = 'EXTRACT(EPOCH FROM (s.ended_at - s.created_at))';
    const [all, today] = await Promise.all([
      this.sessions
        .createQueryBuilder('s')
        .select('COUNT(*)', 'sessions')
        .addSelect(`COALESCE(SUM(${dur}), 0)`, 'seconds')
        .addSelect(`COALESCE(MAX(${dur}), 0)`, 'maxSeconds')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.ended_at IS NOT NULL')
        .getRawOne<{ sessions: string; seconds: string; maxSeconds: string }>(),
      this.sessions
        .createQueryBuilder('s')
        .select('COUNT(*)', 'sessions')
        .addSelect(`COALESCE(SUM(${dur}), 0)`, 'seconds')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.ended_at IS NOT NULL')
        .andWhere('s.created_at >= :start', { start: startOfUBDay() })
        .getRawOne<{ sessions: string; seconds: string }>(),
    ]);
    return {
      totalSessions: Number(all?.sessions ?? 0),
      totalMinutes: Math.round(Number(all?.seconds ?? 0) / 60),
      todaySessions: Number(today?.sessions ?? 0),
      todayMinutes: Math.round(Number(today?.seconds ?? 0) / 60),
      longestSessionMinutes: Math.round(Number(all?.maxSeconds ?? 0) / 60),
    };
  }

  async getMessages(userId: string, sessionId: string): Promise<Message[]> {
    await this.ownedSession(userId, sessionId);
    return this.messages.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Open a typed-chat thread and return its history. Picks the thread by:
   *   - `opts.sessionId` → that exact thread (must be the user's own TEXT one),
   *   - `opts.create`    → a brand-new empty thread ("New chat"),
   *   - otherwise        → the most recent thread (or a new one if none).
   * This gives the typed chat persistent, ChatGPT-style threads that survive
   * app restarts, while voice sessions stay separate and ephemeral.
   */
  async resumeTextSession(
    userId: string,
    buddySlug: string,
    opts?: { sessionId?: string; create?: boolean },
  ): Promise<{ sessionId: string; messages: SerializedBuddyMessage[] }> {
    const buddy = await this.buddies.findOne({
      where: { slug: buddySlug, isActive: true },
    });
    if (!buddy) throw new NotFoundException('Buddy олдсонгүй');

    let session: BuddySession | null = null;
    if (opts?.sessionId) {
      session = await this.sessions.findOne({
        where: { id: opts.sessionId, userId, mode: BuddySessionMode.TEXT },
      });
      if (!session) throw new NotFoundException('Session олдсонгүй');
    } else if (!opts?.create) {
      session = await this.sessions.findOne({
        where: { userId, buddySlug, mode: BuddySessionMode.TEXT },
        order: { createdAt: 'DESC' },
      });
    }
    if (!session) {
      session = await this.sessions.save(
        this.sessions.create({
          userId,
          buddySlug,
          mode: BuddySessionMode.TEXT,
          topic: null,
        }),
      );
    }

    const rows = await this.messages.find({
      where: { userId, sessionId: session.id },
      order: { createdAt: 'ASC' },
    });
    return {
      sessionId: session.id,
      messages: rows.map((m) => serializeBuddyMessage(m)),
    };
  }

  /**
   * List the user's past typed-chat threads with this buddy (most-recent
   * activity first) for the ChatGPT-style history panel. Empty threads (no
   * messages yet) are omitted so a fresh "New chat" doesn't clutter the list.
   */
  async listTextSessions(
    userId: string,
    buddySlug: string,
  ): Promise<TextSessionSummary[]> {
    const sessions = await this.sessions.find({
      where: { userId, buddySlug, mode: BuddySessionMode.TEXT },
    });
    if (!sessions.length) return [];

    const rows = await this.messages.find({
      where: { userId, sessionId: In(sessions.map((s) => s.id)) },
      order: { createdAt: 'ASC' },
    });
    const bySession = new Map<string, Message[]>();
    for (const m of rows) {
      if (!m.sessionId) continue;
      const list = bySession.get(m.sessionId) ?? [];
      list.push(m);
      bySession.set(m.sessionId, list);
    }

    return sessions
      .map((s) => {
        const list = bySession.get(s.id) ?? [];
        const firstUser = list.find((m) => m.role === MessageRole.USER);
        const last = list[list.length - 1];
        return {
          sessionId: s.id,
          title: (firstUser?.content ?? '').trim().slice(0, 80),
          messageCount: list.length,
          updatedAt: (last?.createdAt ?? s.createdAt).toISOString(),
        };
      })
      .filter((s) => s.messageCount > 0)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  /**
   * Delete a past TEXT chat thread (history panel → trash). Only the owner's own
   * text session can be removed; its messages go with it.
   */
  async deleteTextSession(
    userId: string,
    sessionId: string,
  ): Promise<{ ok: true }> {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId, mode: BuddySessionMode.TEXT },
    });
    if (!session) throw new NotFoundException('Session олдсонгүй');
    await this.messages.delete({ userId, sessionId });
    await this.sessions.delete({ id: sessionId });
    return { ok: true };
  }

  async getUsage(userId: string): Promise<{
    voice: TurnResponse['usage'];
    stt: TurnResponse['usage'];
  }> {
    const user = await this.loadUser(userId);
    const [voice, stt] = await Promise.all([
      this.usage.checkVoice(user),
      this.usage.checkStt(user),
    ]);
    return { voice: this.usageBlock(voice), stt: this.usageBlock(stt) };
  }

  // ── Turns ───────────────────────────────────────────────────────────────

  /** Typed turn: skip STT, run the shared pipeline, buddy still speaks. */
  async textTurn(
    userId: string,
    sessionId: string,
    text: string,
    clientT0?: number,
    streamId?: string,
  ): Promise<TurnResponse> {
    const session = await this.ownedSession(userId, sessionId);
    const user = await this.loadUser(userId);
    await this.preCheckVoice(user);
    if (streamId) this.turnStreams.open(streamId, userId);
    return this.runTurn(
      user,
      session,
      text,
      text,
      new TurnTimer(clientT0),
      streamId,
    );
  }

  /** Voice turn: pre-check → STT → (confidence gate) → shared pipeline. */
  async audioTurn(
    userId: string,
    sessionId: string,
    file: { buffer: Buffer; mimetype: string },
    clientT0?: number,
    streamId?: string,
  ): Promise<TurnResponse> {
    const session = await this.ownedSession(userId, sessionId);
    const user = await this.loadUser(userId);
    const limits = await this.gateway.getLimits();

    // Pre-check: STT + voice allowance + daily turn cap, before any provider call.
    const sttAllow = await this.usage.checkStt(user);
    if (!sttAllow.allowed) throw this.limitError('STT');
    await this.preCheckVoice(user);
    await this.checkDailyTurns(userId, limits.dailyVoiceTurnLimit);

    const timer = new TurnTimer(clientT0);
    // Клиент хэсгүүдийг зэрэгцээд гуйж эхэлсэн байж болзошгүй тул STT-ийн
    // өмнө бүртгэнэ — эс бөгөөс эхний хүсэлт нь "мэдэгдэхгүй turn" гэж унана.
    if (streamId) this.turnStreams.open(streamId, userId);
    let transcript: string;
    let sttSeconds: number;
    try {
      const result = await this.stt.transcribe(file.buffer, file.mimetype);
      transcript = result.text;
      sttSeconds = result.seconds;
      timer.mark('stt'); // T1 — transcript ready
      if (result.confidence < limits.sttMinConfidence || !transcript) {
        // Low confidence → ask to repeat, charge nothing, skip LLM/TTS.
        return this.staticTurn(session.id, transcript, 'curious', {
          reply_text:
            "I didn't catch that clearly. Can you say it again slowly?",
        });
      }
    } catch (err) {
      this.logger.error(
        `STT failed: ${err instanceof Error ? err.message : err}`,
      );
      return this.staticTurn(session.id, '', 'curious', {
        reply_text: "I didn't catch that clearly. Can you say it again slowly?",
      });
    }

    await this.logUsage(userId, AiUsageType.STT, {
      voiceSeconds: sttSeconds,
      costMicroUsd: Math.round((sttSeconds / 3600) * 0.39 * 1e6),
      metadata: { sessionId: session.id, stage: 'stt' },
    });

    return this.runTurn(user, session, transcript, transcript, timer, streamId);
  }

  // ── Core pipeline (shared by text + voice) ───────────────────────────────

  private async runTurn(
    user: User,
    session: BuddySession,
    displayText: string,
    rawText: string,
    timer?: TurnTimer,
    streamId?: string,
  ): Promise<TurnResponse> {
    const buddy = await this.buddies.findOne({
      where: { slug: session.buddySlug },
    });
    if (!buddy) throw new NotFoundException('Buddy олдсонгүй');

    // Audit-only: flag obvious prompt-injection attempts (no blocking).
    if (looksLikeInjection(rawText)) {
      await this.safetyEvents.save(
        this.safetyEvents.create({
          userId: user.id,
          sessionId: session.id,
          eventType: 'jailbreak_attempt',
          severity: 'low',
          details: { excerpt: rawText.slice(0, 120) },
        }),
      );
    }

    const limits = await this.gateway.getLimits();
    const cefr = (user.level ?? 'b1').toUpperCase();
    const memRows = await this.memory.getContextMemories(user.id);
    const history = await this.messages.find({
      where: { userId: user.id, sessionId: session.id },
      order: { createdAt: 'DESC' },
      take: limits.maxContextMessages,
    });
    history.reverse();

    const system = buildBuddySystemPrompt(
      buddy,
      cefr,
      memRows.map((m) => m.value),
      session.topic ?? undefined,
    );
    const llmMessages: LlmMessage[] = [
      ...history
        .map((m) => ({
          role:
            m.role === MessageRole.USER
              ? ('user' as const)
              : ('assistant' as const),
          // User turns replay the RAW (uncorrected) transcript.
          content:
            m.role === MessageRole.USER ? (m.rawText ?? m.content) : m.content,
        }))
        // Цуурайтсан STT prompt нь `raw_text`-д хадгалагдсан **хуучин** мөрүүдэд
        // үлдсэн (засварын өмнө үүссэн). Тэдгээрийг дахин тоглуулбал LLM
        // хөрвүүлэх хүсэлт хүлээж авсаар байх тул яриа эдгэрэхгүй — түүхээс
        // шүүнэ. Шинэ turn-д ийм мөр огт үүсэхгүй
        // (`GeminiSttAdapter` цуурайг эх үүсвэр дээр нь таслана).
        .filter(
          (m) => !(m.role === 'user' && isTranscribePromptEcho(m.content)),
        ),
      { role: 'user', content: rawText },
    ];

    // t2 — контекст бэлэн, LLM руу хүсэлт явахын өмнөх агшин. Тусад нь
    // тэмдэглэхгүй бол buddy/limits/memory/history-ийн DB+Redis дуудлагууд
    // `llm_ms` дотор нуугдаж, LLM-ийг байгаагаасаа удаан харагдуулна.
    timer?.mark('context');

    // --- LLM + TTS ---
    //
    // Хоёр зам байна. Урсгалт зам нь `reply_text`-ийг бүтэн JSON ирэхээс өмнө
    // гаргаж аваад ярьж эхэлдэг (хэмжилтээр ~1.3 сек эрт); клиент хэсгүүдийг
    // зэрэгцээд татна. Клиент turnId илгээгээгүй, эсвэл провайдер урсгал
    // дэмжихгүй бол хуучин зам яг хэвээрээ ажиллана.
    const streaming =
      Boolean(streamId) && typeof this.llm.completeStream === 'function';

    const { turn, promptTokens, completionTokens, model, spokenChunks } =
      streaming
        ? await this.streamTurn(
            system,
            llmMessages,
            limits,
            buddy,
            session.id,
            streamId!,
            user.id,
            timer,
          )
        : {
            ...(await this.completeTurn(system, llmMessages, limits)),
            spokenChunks: null,
          };
    timer?.mark('llm'); // T2 — reply ready

    // --- Safety gate ---
    let reply = turn.reply_text;
    let emotion = turn.emotion;
    let hasCorrection = turn.correction.has_correction;
    if (turn.safety.flagged) {
      await this.safetyEvents.save(
        this.safetyEvents.create({
          userId: user.id,
          sessionId: session.id,
          eventType: 'llm_flagged',
          severity: 'medium',
          details: { reason: turn.safety.reason },
        }),
      );
      reply = SAFE_REDIRECT;
      emotion = 'calm';
      hasCorrection = false;
    }

    await this.logUsage(user.id, AiUsageType.TEXT_CHAT, {
      model,
      promptTokens,
      completionTokens,
      costMicroUsd: llmCostMicroUsd(model, promptTokens, completionTokens),
      metadata: { sessionId: session.id, buddySlug: buddy.slug, stage: 'llm' },
    });
    await this.users.increment({ id: user.id }, 'aiInputTokens', promptTokens);
    await this.users.increment(
      { id: user.id },
      'aiOutputTokens',
      completionTokens,
    );
    // Гурван DB бичилт — цэвэр бүртгэл, гэвч TTS эхлэхийг хойшлуулж байна.
    timer?.mark('llm_bookkeeping');

    // --- TTS ---
    //
    // Урсгалт зам аль хэдийн ярьсан бол ДАХИН синтез хийхгүй: хэсгүүдийг
    // нийлүүлээд мета өгөгдлийг нь угсарна. `audio_url` нь энэ тохиолдолд
    // хоосон — аудио нь хэсэг бүрийн URL-аар очсон; кэшлэгдсэн R2 хувилбар нь
    // ард талд бичигдэж, `speak()` дараагийн ижил өгүүлбэрт түүнийг олно.
    const spokenText = `${reply} ${turn.follow_up_question}`.trim();
    const { audioUrl, durationMs, visemes } = spokenChunks
      ? mergeSpokenChunks(spokenChunks)
      : await this.speak(user.id, buddy, spokenText, session.id, timer);

    // --- Persist both turns ---
    await this.messages.save(
      this.messages.create({
        userId: user.id,
        conversationId: session.id,
        sessionId: session.id,
        buddySlug: buddy.slug,
        role: MessageRole.USER,
        content: displayText,
        rawText,
      }),
    );
    const aiMsg = await this.messages.save(
      this.messages.create({
        userId: user.id,
        conversationId: session.id,
        sessionId: session.id,
        buddySlug: buddy.slug,
        role: MessageRole.ASSISTANT,
        content: reply,
        audioUrl,
        durationMs,
        metadata: {
          correction: hasCorrection ? turn.correction : null,
          follow_up_question: turn.follow_up_question,
          mistake_tags: turn.mistake_tags,
          emotion,
          gesture: turn.gesture,
          cefr_level_used: turn.cefr_level_used,
          latency: timer?.snapshot(),
        },
      }),
    );
    // --- Memory write (backend has final say) ---
    if (turn.memory_update.should_save) {
      await this.memory.maybeSave(user.id, {
        memoryType: turn.memory_update.memory_type,
        value: turn.memory_update.value,
        sourceMessageId: aiMsg.id,
      });
    }

    // --- XP once per session (awardOnce returns null if already granted) ---
    const buddyXp = (await this.xp.rewards()).buddy;
    const awarded = await this.xp.awardOnce({
      userId: user.id,
      amount: buddyXp,
      source: XpSource.AI_BUDDY,
      referenceId: session.id,
    });

    const allowance = await this.usage.checkVoice(await this.loadUser(user.id));

    // Аудио бэлэн болсны ДАРАА хийгдсэн бүхэн: 2 мессеж хадгалах, санах ой, XP,
    // хэрэглээг дахин унших. Хэрэглэгч эдгээрийн аль нэгийг ч хүлээх ёсгүй —
    // энэ тоо хэр их үрэгдэж байгааг харуулна.
    timer?.mark('persist');
    if (timer) {
      const stages = timer.snapshot();
      this.logger.log(
        `buddy turn ${session.id}: ` +
          Object.entries(stages)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ') +
          ` visemes=${visemes?.length ?? 0}` +
          // Аль гурван провайдер бодитоор ажилласныг нэг мөрөнд. Сонголт нь
          // бүхэлдээ env-ээр явдаг ба анхдагч нь ХУУЧИН утга тул "яагаад
          // viseme алга / яагаад удаан" гэсэн асуултын хариу ихэвчлэн энд
          // байдаг — тавихаа мартсан нэг хувьсагч.
          ` stt=${this.providerName(this.stt as object)}` +
          ` llm=${this.providerName(this.llm as object)}/${model}` +
          ` tts=${this.providerName(this.tts as object)}/${this.tts.resolveVoice(buddy.voiceId)}`,
      );
      // Мессеж дээр аль хэдийн бичигдсэн хувилбар нь `persist_ms`-гүй (тэр үед
      // хараахан мэдэгдээгүй байсан). Бүрэн зургийг нөхнө — гэхдээ
      // **хүлээхгүйгээр**: телеметр хэзээ ч хариуг хойшлуулах ёсгүй.
      void this.messages
        .update(aiMsg.id, { metadata: { ...aiMsg.metadata, latency: stages } })
        .catch(() => undefined);
    }

    return {
      session_id: session.id,
      message_id: aiMsg.id,
      turn_id: timer?.turnId,
      user_transcript: displayText,
      reply_text: reply,
      correction: hasCorrection
        ? {
            original: turn.correction.original,
            corrected: turn.correction.corrected,
            short_explanation: turn.correction.short_explanation,
          }
        : null,
      follow_up_question: turn.follow_up_question,
      mistake_tags: turn.mistake_tags,
      xp_reward: awarded ? buddyXp : 0,
      audio_url: audioUrl,
      // Only sent when the provider actually timed the speech; the app treats a
      // missing list as "guess the mouth shapes from the text".
      ...(visemes?.length
        ? { visemes: visemes.map((v) => ({ id: v.id, offset_ms: v.offsetMs })) }
        : {}),
      avatar_instruction: {
        emotion,
        gesture: turn.gesture,
        duration_ms: durationMs,
      },
      usage: this.usageBlock(allowance),
    };
  }

  /** Call the LLM, parse; retry once on invalid JSON, else fallback. Never throws. */
  private async completeTurn(
    system: string,
    messages: LlmMessage[],
    limits: { maxReplyChars: number; maxReplyWords: number },
  ): Promise<{
    turn: BuddyTurnResult;
    promptTokens: number;
    completionTokens: number;
    model: string;
  }> {
    try {
      // `maxTokens` stays generous on purpose. It is a truncation guard, not a
      // length control: a model that would have stopped at 60 tokens doesn't get
      // slower because 500 were allowed, but a budget too tight to fit the JSON
      // envelope (correction + a Mongolian explanation, which tokenizes poorly)
      // would cut the reply mid-object and force the retry below — paying for a
      // whole second call. Reply length is controlled by the prompt and capped
      // server-side in `parseBuddyTurn`.
      const maxTokens = LLM_MAX_TOKENS;
      const first = await this.llm.complete(system, messages, maxTokens);
      const parseOpts = {
        maxChars: limits.maxReplyChars,
        maxWords: limits.maxReplyWords,
      };
      let turn = parseBuddyTurn(first.text, parseOpts);
      let promptTokens = first.promptTokens;
      let completionTokens = first.completionTokens;
      if (!turn) {
        const retry = await this.llm.complete(
          system,
          [
            ...messages,
            {
              role: 'assistant',
              content:
                'Your previous output was not valid JSON. Return only valid JSON.',
            },
          ],
          maxTokens,
        );
        turn = parseBuddyTurn(retry.text, parseOpts);
        promptTokens += retry.promptTokens;
        completionTokens += retry.completionTokens;
      }
      return {
        turn: turn ?? FALLBACK_TURN,
        promptTokens,
        completionTokens,
        model: first.model,
      };
    } catch (err) {
      this.logger.error(
        `LLM failed: ${err instanceof Error ? err.message : err}`,
      );
      return {
        turn: FALLBACK_TURN,
        promptTokens: 0,
        completionTokens: 0,
        model: 'fallback',
      };
    }
  }

  /**
   * Урсгалт turn: `reply_text` ирэх тусам нь хэсэглэн ярьж эхэлнэ.
   *
   * Дараалал (гэрээний талбарын дараалал үүнийг зориудаар боломжтой болгосон —
   * `buddy-contract.ts`-ийн анхааруулгыг үз):
   *
   *  1. `safety` эхлээд ирнэ → хаалт **ярихаас өмнө** шалгагдана. Тэмдэглэгдсэн
   *     бол нэг ч хэсэг ярихгүй; бүтэн зам найдвартай чиглүүлэлтийг хийнэ.
   *  2. `emotion` дараа нь → эхний аудио хэсэгтэй хамт царай тавигдана.
   *  3. `reply_text` ирэх тусам ярих боломжтой хэсгүүдэд хуваагдана.
   *  4. JSON бүрэн ирсний дараа `follow_up_question` сүүлийн хэсэг болно.
   *
   * TTS нь **цуваа**: аудионы дараалал эвдэрч болохгүй тул зэрэг синтез
   * хийхгүй. Дараагийн хэсгийн синтез өмнөхийг нь тоглуулж байх зуур явна —
   * pipeline-ийн хожил ердөө эндээс гарна.
   *
   * Ямар ч алдаа гарвал хуучин, батлагдсан зам руу бүрэн буцна.
   */
  private async streamTurn(
    system: string,
    messages: LlmMessage[],
    limits: { maxReplyChars: number; maxReplyWords: number },
    buddy: AiBuddy,
    sessionId: string,
    streamId: string,
    userId: string,
    timer?: TurnTimer,
  ): Promise<{
    turn: BuddyTurnResult;
    promptTokens: number;
    completionTokens: number;
    model: string;
    spokenChunks: SpokenChunk[] | null;
  }> {
    const parseOpts = {
      maxChars: limits.maxReplyChars,
      maxWords: limits.maxReplyWords,
    };
    const abort = new AbortController();
    const spoken: SpokenChunk[] = [];
    let consumed = 0;
    let index = 0;
    let safetyFlagged: boolean | null = null;
    let emotion: string | undefined;
    /** Цуваа дараалал: бүх синтез нэг гинжинд дараалан орно. */
    let queue: Promise<void> = Promise.resolve();

    const enqueue = (text: string, last: boolean) => {
      const at = index++;
      queue = queue.then(async () => {
        if (this.turnStreams.isAborted(streamId)) return;
        const chunk = await this.synthesizeChunk(
          userId,
          buddy,
          text,
          sessionId,
          streamId,
          at,
          last,
          emotion,
          timer,
        );
        if (chunk) spoken.push(chunk);
      });
    };

    try {
      const result = await this.llm.completeStream!(
        system,
        messages,
        LLM_MAX_TOKENS,
        (_delta, full) => {
          if (this.turnStreams.isAborted(streamId)) {
            abort.abort();
            return;
          }
          if (!timer?.has('llm_first_token')) {
            timer?.set('llm_first_token', timer.sinceStart());
          }
          // (1) Аюулгүй байдал — үүнийг мэдэхээс өмнө нэг ч үг ярихгүй.
          if (safetyFlagged === null) {
            const flag =
              /"safety"\s*:\s*\{[^}]*"flagged"\s*:\s*(true|false)/.exec(full);
            if (!flag) return;
            safetyFlagged = flag[1] === 'true';
          }
          if (safetyFlagged) return;
          // (2) Царай — эхний хэсэгтэй хамт явна.
          if (!emotion) {
            const m = /"emotion"\s*:\s*"([a-z_]+)"/.exec(full);
            if (m) emotion = m[1];
          }
          // (3) Ярих боломжтой хэсгүүд.
          const field = readJsonStringField(full, 'reply_text');
          if (!field) return;
          const next = takeSpeakableChunks(
            field.value,
            consumed,
            field.complete,
          );
          consumed = next.consumed;
          for (const text of next.chunks) {
            if (!timer?.has('llm_first_speakable')) {
              timer?.set('llm_first_speakable', timer.sinceStart());
            }
            enqueue(text, false);
          }
        },
        abort.signal,
      );

      const turn = parseBuddyTurn(result.text, parseOpts) ?? FALLBACK_TURN;
      // (4) Дагах асуулт — сүүлчийн хэсэг. Ярих текст нь хуучин замтай ижил
      // (`reply + follow_up`) тул сонсогдох үр дүн өөрчлөгдөхгүй.
      const followUp = turn.safety.flagged
        ? ''
        : turn.follow_up_question.trim();
      if (followUp && spoken.length + index > 0 && !turn.safety.flagged) {
        enqueue(followUp, true);
      }
      await queue;
      this.turnStreams.finish(streamId);
      return {
        turn,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        model: result.model,
        spokenChunks: spoken.length ? spoken : null,
      };
    } catch (err) {
      this.logger.error(
        `LLM stream failed: ${err instanceof Error ? err.message : err}`,
      );
      this.turnStreams.finish(streamId, true);
      const fallback = await this.completeTurn(system, messages, limits);
      return { ...fallback, spokenChunks: null };
    }
  }

  /**
   * Нэг ярианы хэсгийг синтез хийж, шууд нийтэлнэ.
   *
   * R2 руу байршуулах нь **энд байхгүй**: байт нь санах ойгоос шууд үйлчилж,
   * байршуулалт ард талд кэш дүүргэнэ. Энэ бол "storage-ийг тоглуулалтын
   * урьдчилсан нөхцөл болгохгүй" гэсэн шаардлагын биелэл.
   */
  private async synthesizeChunk(
    userId: string,
    buddy: AiBuddy,
    text: string,
    sessionId: string,
    streamId: string,
    index: number,
    last: boolean,
    emotion: string | undefined,
    timer?: TurnTimer,
  ): Promise<SpokenChunk | null> {
    try {
      const result = await this.tts.synthesize(
        text,
        buddy.voiceId ?? undefined,
        buddy.ttsParams ?? undefined,
      );
      if (index === 0) {
        timer?.set('tts_first_chunk', timer.sinceStart());
        timer?.set('tts_first_chunk_provider', result.firstAudioMs);
      }
      this.logVoice(`chunk ${index}`, buddy.voiceId ?? null, {
        voiceId: result.voiceId,
        model: result.model,
        durationMs: result.durationMs,
        visemes: result.visemes?.length ?? 0,
        mimeType: result.mimeType,
        cache: 'miss',
      });
      this.turnStreams.publish(
        streamId,
        {
          index,
          text,
          mimeType: result.mimeType,
          durationMs: result.durationMs,
          visemes:
            result.visemes?.map((v) => ({ id: v.id, offset_ms: v.offsetMs })) ??
            null,
          last,
          emotion: emotion ?? null,
        },
        result.audio,
      );
      // Кэш + R2 нь хэрэглэгчийн хүлээлтээс гадуур.
      void this.cacheChunkAudio(userId, buddy, text, sessionId, result);
      return {
        index,
        text,
        durationMs: result.durationMs,
        visemes: result.visemes ?? null,
      };
    } catch (err) {
      this.logger.error(
        `TTS chunk ${index} failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /**
   * Ярьсан хэсгийг R2 + дуут кэш рүү **ард талд** бичнэ.
   *
   * Хэзээ ч `await` хийгддэггүй тул алдаа нь turn-д хүрэхгүй; хамгийн муудаа
   * тэр хэсэг дараа дахин синтез хийгдэнэ.
   */
  private async cacheChunkAudio(
    userId: string,
    buddy: AiBuddy,
    text: string,
    sessionId: string,
    result: TtsResult,
  ): Promise<void> {
    try {
      const voiceId = this.tts.resolveVoice(buddy.voiceId);
      const textHash = createHash('sha256')
        .update(`${voiceId}:${text}`)
        .digest('hex');
      if (await this.voiceCache.findOne({ where: { textHash, voiceId } }))
        return;
      const audioUrl = await this.imageStorage.storeMedia({
        buffer: result.audio,
        filename: `${textHash.slice(0, 24)}.${result.fileExtension}`,
        mimeType: result.mimeType,
        resourceType: 'audio',
        folder: 'buddy/voice',
        localSubdir: 'audio',
      });
      await this.voiceCache.save(
        this.voiceCache.create({
          textHash,
          voiceId: result.voiceId,
          audioUrl,
          durationMs: result.durationMs,
          visemes: result.visemes ?? null,
        }),
      );
      await this.logUsage(userId, AiUsageType.TTS, {
        model: result.model,
        voiceSeconds: Math.ceil(result.durationMs / 1000),
        costMicroUsd: Math.round((text.length / 1000) * 0.05 * 1e6),
        metadata: { sessionId, stage: 'tts' },
      });
    } catch (err) {
      this.logger.warn(
        `chunk audio cache failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * TTS with voice cache. On failure returns null audio (turn still succeeds).
   *
   * `skipCache` нь админы voice тестэд зориулагдсан: тэр тестийн ганц зорилго
   * нь тухайн voice **яг одоо** юу буцаахыг (ялангуяа viseme өгөх эсэхийг)
   * харах явдал тул cache-ээс хариулах нь тестийг утгагүй болгоно.
   */
  /**
   * Идэвхтэй adapter-ийн богино нэр (`AzureTtsAdapter` → `azure`).
   *
   * Класс дээрээс уншиж байгаа нь санаатай: `TTS_PROVIDER` env-ийг дахин
   * уншвал factory-гийн шийдвэрийг ТААМАГЛАЖ байна гэсэн үг — тэр хоёр зөрвөл
   * лог худал болно. Энэ нь бодитоор дуудагдаж буй объектыг хэлнэ.
   */
  private providerName(adapter: object): string {
    return (
      adapter.constructor.name
        .replace(/(Tts|Stt|Llm)Adapter$/, '')
        .toLowerCase() || 'unknown'
    );
  }

  /**
   * Нэг синтезийн товч тайлан — **buddy ярих бүрд нэг мөр**.
   *
   * Яагаад хэрэгтэй вэ: turn амжилттай болсон эсэхийг лог хэлдэг байсан ч
   * ЯМАР дуу хоолойгоор ярьсныг хэлдэггүй байв. Тиймээс доорхи гурван
   * доголдол бүгд ЧИМЭЭГҮЙ явдаг — бүх зүйл ажиллаж байгаа мэт харагдана:
   *
   *  • `buddy.voiceId`-д өөр провайдерын үлдэгдэл нэр (ж: Gemini-гийн `Kore`)
   *    байвал Azure түүнийг таньж чадахгүй → анхдагч руу буудаг;
   *  • сонгосон voice viseme огт буцаахгүй байвал уруулын синк ажиллахгүй;
   *  • cache-ээс ирсэн клип нь **хуучин** voice-ынх байж болно.
   */
  private logVoice(
    stage: string,
    requestedVoiceId: string | null,
    info: {
      voiceId: string;
      model?: string;
      durationMs: number;
      visemes: number;
      mimeType?: string;
      cache: 'hit' | 'miss';
    },
  ): void {
    const provider = this.providerName(this.tts as object);
    // Хүссэн нэр нь ярьсан нэрээс өөр бол ЗААВАЛ хар: энэ бол чимээгүй
    // орлуулалт, яг тэр нь буруу хоолойны шалтгаан болдог.
    const swapped =
      requestedVoiceId && requestedVoiceId !== info.voiceId
        ? ` (asked "${requestedVoiceId}")`
        : '';
    this.logger.log(
      `voice[${stage}] provider=${provider} voice=${info.voiceId}${swapped}` +
        (info.model ? ` model=${info.model}` : '') +
        ` dur=${info.durationMs}ms visemes=${info.visemes}` +
        (info.mimeType ? ` mime=${info.mimeType}` : '') +
        ` cache=${info.cache}`,
    );
    // Zero visemes from the one provider that is supposed to report them is a
    // configuration answer, not a hiccup: that voice cannot drive lip-sync.
    if (provider === 'azure' && info.visemes === 0 && info.cache === 'miss') {
      this.logger.warn(
        `"${info.voiceId}" нь viseme буцаасангүй — энэ voice-оор уруулын синк ` +
          'ажиллахгүй. Өөр voice сонго (admin → test-voice дээр viseme_count шалга).',
      );
    }
  }

  private async speak(
    userId: string,
    buddy: AiBuddy,
    text: string,
    sessionId: string,
    timer?: TurnTimer,
    skipCache = false,
  ): Promise<{
    audioUrl: string | null;
    durationMs: number;
    visemes: VisemeCue[] | null;
  }> {
    // Cache түлхүүрт **шийдэгдсэн** voice-ыг хэрэглэнэ, хүсэлтийнхийг биш.
    // `buddy.voiceId` хоосон үед энэ нь `AZURE_TTS_VOICE`/`GEMINI_TTS_VOICE`
    // болно — эс бөгөөс бүх buddy `'default'` гэсэн нэг түлхүүрийг хуваалцаж,
    // env-ийн voice сольсны дараа ч хуучин клип үүрд эргэж гарна.
    const voiceId = this.tts.resolveVoice(buddy.voiceId);
    const textHash = createHash('sha256')
      .update(`${voiceId}:${text}`)
      .digest('hex');

    const cached = skipCache
      ? null
      : await this.voiceCache.findOne({ where: { textHash, voiceId } });
    if (cached) {
      await this.voiceCache.increment({ id: cached.id }, 'hitCount', 1);
      timer?.mark('tts_cache_hit');
      this.logVoice('cache', buddy.voiceId ?? null, {
        voiceId,
        durationMs: cached.durationMs,
        visemes: cached.visemes?.length ?? 0,
        cache: 'hit',
      });
      return {
        audioUrl: cached.audioUrl,
        durationMs: cached.durationMs,
        visemes: cached.visemes ?? null,
      };
    }

    try {
      const result = await this.tts.synthesize(
        text,
        buddy.voiceId ?? undefined,
        buddy.ttsParams ?? undefined,
      );
      timer?.mark('tts'); // t5 → синтез бүрэн дуусав
      this.logVoice('turn', buddy.voiceId ?? null, {
        voiceId: result.voiceId,
        model: result.model,
        durationMs: result.durationMs,
        visemes: result.visemes?.length ?? 0,
        mimeType: result.mimeType,
        cache: 'miss',
      });
      // t5 → t6: провайдер эхний аудио хэсгээ хэзээ өгсөн. `tts_ms`-ээс
      // хамаагүй бага байх ёстой; зөрүү нь streaming-ээс хожих хугацаа.
      timer?.set('tts_first_audio', result.firstAudioMs);
      const audioUrl = await this.imageStorage.storeMedia({
        buffer: result.audio,
        // Extension and content type come from the adapter. They used to be
        // hard-coded to mp3 while Gemini was returning WAV bytes.
        filename: `${textHash.slice(0, 24)}.${result.fileExtension}`,
        mimeType: result.mimeType,
        resourceType: 'audio', // → R2 when configured, else Cloudinary
        folder: 'buddy/voice',
        localSubdir: 'audio',
      });
      // t6 → аудио бодитоор татаж авах боломжтой болов. Энэ шат нь ОДООГООР
      // хэрэглэгчийн хүлээлт дээр бүтнээрээ сууж байна: байт нь аль хэдийн
      // санах ойд байхад R2 руу байршуулж дуустал хариу явдаггүй.
      // Нэр нь `audio_upload`, `upload` БИШ: `upload_ms` нь аль хэдийн
      // клиентийн t0 → сервер хүлээж авах хугацааг эзэлсэн бөгөөд ижил
      // түлхүүрт бичвэл түүнийг чимээгүй дарж бичнэ.
      timer?.mark('audio_upload');
      // `skipCache` нь бичихийг ч алгасана, зөвхөн уншихыг биш: (textHash,
      // voiceId) нь unique тул хоёр дахь тест давхардсан түлхүүрээр уначихаад
      // `catch`-д баригдаж "аудио үүсгэж чадсангүй" мэт харагдана.
      if (!skipCache) {
        await this.voiceCache.save(
          this.voiceCache.create({
            textHash,
            voiceId: result.voiceId,
            audioUrl,
            durationMs: result.durationMs,
            visemes: result.visemes ?? null,
          }),
        );
      }
      await this.logUsage(userId, AiUsageType.TTS, {
        model: result.model,
        voiceSeconds: Math.ceil(result.durationMs / 1000),
        costMicroUsd: Math.round((text.length / 1000) * 0.05 * 1e6),
        metadata: { sessionId, stage: 'tts' },
      });
      timer?.mark('tts_persist'); // дуут cache + хэрэглээний бүртгэл (DB)
      return {
        audioUrl,
        durationMs: result.durationMs,
        visemes: result.visemes ?? null,
      };
    } catch (err) {
      this.logger.error(
        `TTS failed: ${err instanceof Error ? err.message : err}`,
      );
      return { audioUrl: null, durationMs: 0, visemes: null };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async ownedSession(
    userId: string,
    sessionId: string,
  ): Promise<BuddySession> {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session олдсонгүй');
    if (session.endedAt) throw new ForbiddenException('Session хаагдсан байна');
    return session;
  }

  private async loadUser(userId: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: ['plan'],
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');
    return user;
  }

  private async preCheckVoice(user: User): Promise<void> {
    const allow = await this.usage.checkVoice(user);
    if (!allow.allowed) throw this.limitError('VOICE');
  }

  private async checkDailyTurns(userId: string, cap: number): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `ai:daily:voice:${userId}:${today}`;
    const count = parseInt((await this.redis.get(key)) ?? '0', 10);
    if (count >= cap) {
      await this.safetyEvents.save(
        this.safetyEvents.create({
          userId,
          eventType: 'rate_limited',
          severity: 'low',
          details: { cap, scope: 'daily_voice_turns' },
        }),
      );
      throw this.limitError('DAILY');
    }
    await this.redis.multi().incr(key).expire(key, 90_000).exec();
  }

  private limitError(code: 'VOICE' | 'STT' | 'DAILY'): ForbiddenException {
    const messages = {
      VOICE: 'Сарын дуут яриа хязгаар хэтэрлээ',
      STT: 'Сарын дуу таних хязгаар хэтэрлээ',
      DAILY: 'Өдрийн дуут яриа хязгаар хэтэрлээ',
    };
    return new ForbiddenException({
      code: code === 'DAILY' ? 'DAILY_LIMIT' : 'VOICE_LIMIT',
      message: messages[code],
    });
  }

  private async logUsage(
    userId: string,
    type: AiUsageType,
    fields: {
      model?: string;
      promptTokens?: number;
      completionTokens?: number;
      voiceSeconds?: number;
      costMicroUsd: number;
      metadata: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.aiUsages.save(
      this.aiUsages.create({
        userId,
        type,
        model: fields.model ?? null,
        promptTokens: fields.promptTokens ?? 0,
        completionTokens: fields.completionTokens ?? 0,
        voiceSeconds: fields.voiceSeconds ?? 0,
        costMicroUsd: fields.costMicroUsd,
        metadata: fields.metadata,
      }),
    );
  }

  private usageBlock(allowance: {
    usedSeconds: number;
    limitSeconds: number | null;
    warnLevel: string;
  }): TurnResponse['usage'] {
    return {
      voice_seconds_used_this_month: allowance.usedSeconds,
      voice_seconds_limit_this_month: allowance.limitSeconds,
      warn_level: allowance.warnLevel,
    };
  }

  /** A turn that skips LLM/TTS (STT fallback). No usage charged. */
  private staticTurn(
    sessionId: string,
    transcript: string,
    emotion: string,
    partial: { reply_text: string },
  ): TurnResponse {
    return {
      session_id: sessionId,
      message_id: '',
      user_transcript: transcript,
      reply_text: partial.reply_text,
      correction: null,
      follow_up_question: '',
      mistake_tags: [],
      xp_reward: 0,
      audio_url: null,
      avatar_instruction: { emotion, gesture: 'idle', duration_ms: 0 },
      usage: {
        voice_seconds_used_this_month: 0,
        voice_seconds_limit_this_month: null,
        warn_level: 'none',
      },
    };
  }

  // Memory passthroughs for the controller.
  listMemory(userId: string) {
    return this.memory.list(userId);
  }
  clearMemory(userId: string) {
    return this.memory.clear(userId);
  }

  /**
   * User feedback on a buddy reply (👍/👎/report + optional reason). Stored on
   * the AI message's metadata (no separate table), so it's queryable alongside
   * the turn.
   *
   * A `report` ALSO writes a `safety_events` row. Google Play's Generative AI
   * policy requires an in-app way to report offensive AI output, and a reviewer
   * has to be able to see that the report went somewhere — metadata on a
   * message nobody lists is not an answer. `user_report` lands in the same
   * admin audit log as the model's own safety flags, so both arrive in one
   * place. `eventType` is a free-text column, so no migration is needed.
   */
  async submitFeedback(
    userId: string,
    messageId: string,
    rating: 'up' | 'down' | 'report',
    reason?: string,
  ): Promise<{ ok: true }> {
    const message = await this.messages.findOne({
      where: { id: messageId, userId, role: MessageRole.ASSISTANT },
    });
    if (!message) throw new NotFoundException('Мессеж олдсонгүй');
    message.metadata = {
      ...(message.metadata ?? {}),
      feedback: {
        rating,
        reason: reason ?? null,
        at: new Date().toISOString(),
      },
    };
    await this.messages.save(message);

    if (rating === 'report') {
      await this.safetyEvents.save(
        this.safetyEvents.create({
          userId,
          sessionId: message.sessionId ?? null,
          eventType: 'user_report',
          // A human deliberately flagged this, so it outranks the model's own
          // low-confidence guesses in the admin list.
          severity: 'high',
          details: {
            messageId,
            reason: reason ?? null,
            // The reported text itself — otherwise the admin has to go dig it
            // out of `messages` to judge the report.
            replyText: message.content,
          },
        }),
      );
    }

    return { ok: true };
  }

  /**
   * Клиентийн латенсийн цэгүүдийг (t7/t8/t9) хадгалагдсан turn дээр нэгтгэнэ.
   *
   * Энэ нь тухайн turn-ийн зургийг бүрэн болгодог цорын ганц зам:
   * `t0_to_audible_ms` бол бүтээгдэхүүний зорилтын тоо (хэрэглэгчийн бодит
   * хүлээлт) бөгөөд серверийн хэмжилтээс аудио татах/декодлох хугацаагаар
   * ялгаатай. Хоёрын зөрүү = `playback_overhead`.
   *
   * Хамгийн сүүлийн turn-ийг **turn_id-гаар** олно (id нь `metadata.latency`-д
   * байгаа тул хайлт нь jsonb-ээр явна). Олдохгүй бол чимээгүй өнгөрнө —
   * телеметрийн тайлан хэзээ ч аппад алдаа үзүүлэх ёсгүй.
   */
  async reportClientLatency(
    userId: string,
    dto: {
      turnId: string;
      t0ToAudibleMs?: number;
      t0ToFirstVisemeMs?: number;
      t0ToReplyDoneMs?: number;
    },
  ): Promise<{ ok: true }> {
    const message = await this.messages
      .createQueryBuilder('m')
      .where('m.user_id = :userId', { userId })
      .andWhere("m.metadata -> 'latency' ->> 'turn_id' = :turnId", {
        turnId: dto.turnId,
      })
      .orderBy('m.created_at', 'DESC')
      .getOne();
    if (!message) return { ok: true };

    const metadata = (message.metadata ?? {}) as Record<string, unknown>;
    const latency = (metadata.latency ?? {}) as Record<string, unknown>;
    const client = {
      ...(dto.t0ToAudibleMs !== undefined
        ? { t0_to_audible_ms: dto.t0ToAudibleMs }
        : {}),
      ...(dto.t0ToFirstVisemeMs !== undefined
        ? { t0_to_first_viseme_ms: dto.t0ToFirstVisemeMs }
        : {}),
      ...(dto.t0ToReplyDoneMs !== undefined
        ? { t0_to_reply_done_ms: dto.t0ToReplyDoneMs }
        : {}),
    };
    // Тоглуулалтын нэмэлт зардал: хариу гар дээр ирснээс хойш дуу гарах хүртэл
    // (татах + декод + UI). Төлөвлөгөөний хүлээн авах шалгуур нь ≤ 0.3 сек.
    const responseMs = Number(latency.t0_to_response_ms);
    if (dto.t0ToAudibleMs !== undefined && Number.isFinite(responseMs)) {
      (client as Record<string, number>).playback_overhead_ms = Math.max(
        0,
        dto.t0ToAudibleMs - responseMs,
      );
    }

    await this.messages.update(message.id, {
      metadata: { ...metadata, latency: { ...latency, ...client } },
    });
    this.logger.log(
      `buddy turn ${dto.turnId} client: ` +
        Object.entries(client)
          .map(([k, v]) => `${k}=${v}`)
          .join(' '),
    );
    return { ok: true };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** Admin: synthesize a sample line in a buddy's voice (reuses the TTS cache). */
  async testVoice(
    adminUserId: string,
    buddySlug: string,
    text: string,
  ): Promise<{
    audio_url: string | null;
    viseme_count: number;
    visemes: { id: number; offset_ms: number }[];
  }> {
    const buddy = await this.buddies.findOne({ where: { slug: buddySlug } });
    if (!buddy) throw new NotFoundException('Buddy олдсонгүй');
    const { audioUrl, visemes } = await this.speak(
      adminUserId,
      buddy,
      text,
      `admin-test-${buddySlug}`,
      undefined,
      true, // skipCache — тестийн зорилго нь voice-ыг ЯГ ОДОО дуудаж шалгах
    );
    // `viseme_count` is the Go/No-Go answer from the engineering brief §4.1:
    // an HD voice that returns audio but zero visemes cannot drive lip-sync and
    // must be dropped. Only a real call can tell you which voices those are, so
    // this endpoint is the tool for that check — hence the raw list too.
    return {
      audio_url: audioUrl,
      viseme_count: visemes?.length ?? 0,
      visemes: (visemes ?? []).map((v) => ({
        id: v.id,
        offset_ms: v.offsetMs,
      })),
    };
  }

  /**
   * Admin: paginated user feedback on buddy replies (newest first). Reads the
   * `feedback` blob stored on AI messages — no separate table.
   */
  async getFeedback(
    page = 1,
    limit = 20,
  ): Promise<{
    items: {
      messageId: string;
      userId: string;
      buddySlug: string | null;
      reply: string;
      rating: string;
      reason: string | null;
      at: string | null;
      createdAt: Date;
    }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [rows, total] = await this.messages
      .createQueryBuilder('m')
      .where('m.role = :role', { role: MessageRole.ASSISTANT })
      .andWhere("m.metadata -> 'feedback' IS NOT NULL")
      .orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = rows.map((m) => {
      const fb = (m.metadata?.feedback ?? {}) as {
        rating?: string;
        reason?: string | null;
        at?: string | null;
      };
      return {
        messageId: m.id,
        userId: m.userId,
        buddySlug: m.buddySlug,
        reply: m.content,
        rating: fb.rating ?? 'down',
        reason: fb.reason ?? null,
        at: fb.at ?? null,
        createdAt: m.createdAt,
      };
    });
    return { items, total, page, limit };
  }

  /** Admin: paginated safety-event audit log (newest first). */
  async getSafetyEvents(
    page = 1,
    limit = 20,
  ): Promise<{
    items: SafetyEvent[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [items, total] = await this.safetyEvents.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }
}
