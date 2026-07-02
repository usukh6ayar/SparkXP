import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
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
import { STT_ADAPTER, type SttAdapter } from './providers/stt.adapter';
import { LLM_ADAPTER, type LlmAdapter, type LlmMessage } from './providers/llm.adapter';
import { TTS_ADAPTER, type TtsAdapter } from './providers/tts.adapter';
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

/** XP granted once per session for practicing with the buddy. */
const BUDDY_XP = 10;
/** Safe reply used when the LLM flags unsafe content. */
const SAFE_REDIRECT = "Let's keep practicing English! What did you do today?";

/** Shape returned to the client for one turn (docx §10). */
export interface TurnResponse {
  session_id: string;
  message_id: string;
  user_transcript: string;
  reply_text: string;
  correction: { original: string; corrected: string; short_explanation: string } | null;
  follow_up_question: string;
  audio_url: string | null;
  avatar_instruction: { emotion: string; gesture: string; duration_ms: number };
  usage: {
    voice_seconds_used_this_month: number;
    voice_seconds_limit_this_month: number | null;
    warn_level: string;
  };
}

@Injectable()
export class BuddyService {
  private readonly logger = new Logger(BuddyService.name);

  constructor(
    @InjectRepository(BuddySession) private readonly sessions: Repository<BuddySession>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(AiBuddy) private readonly buddies: Repository<AiBuddy>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(BuddyVoiceCache) private readonly voiceCache: Repository<BuddyVoiceCache>,
    @InjectRepository(SafetyEvent) private readonly safetyEvents: Repository<SafetyEvent>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(STT_ADAPTER) private readonly stt: SttAdapter,
    @Inject(LLM_ADAPTER) private readonly llm: LlmAdapter,
    @Inject(TTS_ADAPTER) private readonly tts: TtsAdapter,
    private readonly imageStorage: ImageStorageService,
    private readonly gateway: AiGatewayService,
    private readonly usage: BuddyUsageService,
    private readonly memory: BuddyMemoryService,
    private readonly xp: XpService,
  ) {}

  // ── Sessions ────────────────────────────────────────────────────────────

  async startSession(userId: string, dto: StartSessionDto): Promise<{
    sessionId: string;
    buddy: AiBuddy;
    usage: TurnResponse['usage'];
  }> {
    const buddy = await this.buddies.findOne({ where: { slug: dto.buddySlug, isActive: true } });
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

  async getMessages(userId: string, sessionId: string): Promise<Message[]> {
    await this.ownedSession(userId, sessionId);
    return this.messages.find({
      where: { userId, sessionId },
      order: { createdAt: 'ASC' },
    });
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
  async textTurn(userId: string, sessionId: string, text: string): Promise<TurnResponse> {
    const session = await this.ownedSession(userId, sessionId);
    const user = await this.loadUser(userId);
    await this.preCheckVoice(user);
    return this.runTurn(user, session, text, text, 0);
  }

  /** Voice turn: pre-check → STT → (confidence gate) → shared pipeline. */
  async audioTurn(
    userId: string,
    sessionId: string,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<TurnResponse> {
    const session = await this.ownedSession(userId, sessionId);
    const user = await this.loadUser(userId);
    const limits = await this.gateway.getLimits();

    // Pre-check: STT + voice allowance + daily turn cap, before any provider call.
    const sttAllow = await this.usage.checkStt(user);
    if (!sttAllow.allowed) throw this.limitError('STT');
    await this.preCheckVoice(user);
    await this.checkDailyTurns(userId, limits.dailyVoiceTurnLimit);

    let transcript: string;
    let sttSeconds: number;
    try {
      const result = await this.stt.transcribe(file.buffer, file.mimetype);
      transcript = result.text;
      sttSeconds = result.seconds;
      if (result.confidence < limits.sttMinConfidence || !transcript) {
        // Low confidence → ask to repeat, charge nothing, skip LLM/TTS.
        return this.staticTurn(session.id, transcript, 'curious', {
          reply_text: "I didn't catch that clearly. Can you say it again slowly?",
        });
      }
    } catch (err) {
      this.logger.error(`STT failed: ${err instanceof Error ? err.message : err}`);
      return this.staticTurn(session.id, '', 'curious', {
        reply_text: "I didn't catch that clearly. Can you say it again slowly?",
      });
    }

    await this.logUsage(userId, AiUsageType.STT, {
      voiceSeconds: sttSeconds,
      costMicroUsd: Math.round((sttSeconds / 3600) * 0.39 * 1e6),
      metadata: { sessionId: session.id, stage: 'stt' },
    });

    return this.runTurn(user, session, transcript, transcript, sttSeconds);
  }

  // ── Core pipeline (shared by text + voice) ───────────────────────────────

  private async runTurn(
    user: User,
    session: BuddySession,
    displayText: string,
    rawText: string,
    sttSeconds: number,
  ): Promise<TurnResponse> {
    const buddy = await this.buddies.findOne({ where: { slug: session.buddySlug } });
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
      ...history.map((m) => ({
        role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
        // User turns replay the RAW (uncorrected) transcript.
        content: m.role === MessageRole.USER ? m.rawText ?? m.content : m.content,
      })),
      { role: 'user', content: rawText },
    ];

    // --- LLM with one retry, then fallback (never throws) ---
    const { turn, promptTokens, completionTokens, model } = await this.completeTurn(
      system,
      llmMessages,
    );

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
      costMicroUsd: Math.round(promptTokens * 0.0008) + Math.round(completionTokens * 0.004),
      metadata: { sessionId: session.id, buddySlug: buddy.slug, stage: 'llm' },
    });
    await this.users.increment({ id: user.id }, 'aiInputTokens', promptTokens);
    await this.users.increment({ id: user.id }, 'aiOutputTokens', completionTokens);

    // --- TTS (cache-first) ---
    const spoken = `${reply} ${turn.follow_up_question}`.trim();
    const { audioUrl, durationMs } = await this.speak(user.id, buddy, spoken, session.id);

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
          emotion,
          gesture: turn.gesture,
          cefr_level_used: turn.cefr_level_used,
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

    // --- XP once per session ---
    await this.xp.awardOnce({
      userId: user.id,
      amount: BUDDY_XP,
      source: XpSource.AI_BUDDY,
      referenceId: session.id,
    });

    const allowance = await this.usage.checkVoice(await this.loadUser(user.id));
    return {
      session_id: session.id,
      message_id: aiMsg.id,
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
      audio_url: audioUrl,
      avatar_instruction: { emotion, gesture: turn.gesture, duration_ms: durationMs },
      usage: this.usageBlock(allowance),
    };
  }

  /** Call the LLM, parse; retry once on invalid JSON, else fallback. Never throws. */
  private async completeTurn(
    system: string,
    messages: LlmMessage[],
  ): Promise<{
    turn: BuddyTurnResult;
    promptTokens: number;
    completionTokens: number;
    model: string;
  }> {
    try {
      const first = await this.llm.complete(system, messages, 500);
      let turn = parseBuddyTurn(first.text);
      let promptTokens = first.promptTokens;
      let completionTokens = first.completionTokens;
      if (!turn) {
        const retry = await this.llm.complete(
          system,
          [
            ...messages,
            {
              role: 'assistant',
              content: 'Your previous output was not valid JSON. Return only valid JSON.',
            },
          ],
          500,
        );
        turn = parseBuddyTurn(retry.text);
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
      this.logger.error(`LLM failed: ${err instanceof Error ? err.message : err}`);
      return { turn: FALLBACK_TURN, promptTokens: 0, completionTokens: 0, model: 'fallback' };
    }
  }

  /** TTS with voice cache. On failure returns null audio (turn still succeeds). */
  private async speak(
    userId: string,
    buddy: AiBuddy,
    text: string,
    sessionId: string,
  ): Promise<{ audioUrl: string | null; durationMs: number }> {
    const voiceId = buddy.voiceId ?? 'default';
    const textHash = createHash('sha256').update(`${voiceId}:${text}`).digest('hex');

    const cached = await this.voiceCache.findOne({ where: { textHash, voiceId } });
    if (cached) {
      await this.voiceCache.increment({ id: cached.id }, 'hitCount', 1);
      return { audioUrl: cached.audioUrl, durationMs: cached.durationMs };
    }

    try {
      const result = await this.tts.synthesize(text, buddy.voiceId ?? undefined, buddy.ttsParams ?? undefined);
      const audioUrl = await this.imageStorage.storeMedia({
        buffer: result.audio,
        filename: `${textHash.slice(0, 24)}.mp3`,
        mimeType: 'audio/mpeg',
        resourceType: 'video',
        folder: 'englishxp/ai-buddy',
        localSubdir: 'audio',
      });
      await this.voiceCache.save(
        this.voiceCache.create({
          textHash,
          voiceId: result.voiceId,
          audioUrl,
          durationMs: result.durationMs,
        }),
      );
      await this.logUsage(userId, AiUsageType.TTS, {
        model: result.model,
        voiceSeconds: Math.ceil(result.durationMs / 1000),
        costMicroUsd: Math.round((text.length / 1000) * 0.05 * 1e6),
        metadata: { sessionId, stage: 'tts' },
      });
      return { audioUrl, durationMs: result.durationMs };
    } catch (err) {
      this.logger.error(`TTS failed: ${err instanceof Error ? err.message : err}`);
      return { audioUrl: null, durationMs: 0 };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async ownedSession(userId: string, sessionId: string): Promise<BuddySession> {
    const session = await this.sessions.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Session олдсонгүй');
    if (session.endedAt) throw new ForbiddenException('Session хаагдсан байна');
    return session;
  }

  private async loadUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId }, relations: ['plan'] });
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
      audio_url: null,
      avatar_instruction: { emotion, gesture: 'idle', duration_ms: 0 },
      usage: { voice_seconds_used_this_month: 0, voice_seconds_limit_this_month: null, warn_level: 'none' },
    };
  }

  // Memory passthroughs for the controller.
  listMemory(userId: string) {
    return this.memory.list(userId);
  }
  clearMemory(userId: string) {
    return this.memory.clear(userId);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  /** Admin: synthesize a sample line in a buddy's voice (reuses the TTS cache). */
  async testVoice(
    adminUserId: string,
    buddySlug: string,
    text: string,
  ): Promise<{ audio_url: string | null }> {
    const buddy = await this.buddies.findOne({ where: { slug: buddySlug } });
    if (!buddy) throw new NotFoundException('Buddy олдсонгүй');
    const { audioUrl } = await this.speak(adminUserId, buddy, text, `admin-test-${buddySlug}`);
    return { audio_url: audioUrl };
  }

  /** Admin: paginated safety-event audit log (newest first). */
  async getSafetyEvents(page = 1, limit = 20): Promise<{
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
