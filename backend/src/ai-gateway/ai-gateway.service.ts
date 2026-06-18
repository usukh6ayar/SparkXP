import {
  Injectable,
  ForbiddenException,
  Logger,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { Message } from '../entities/message.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { AiBuddy } from '../entities/ai-buddy.entity';
import { User } from '../entities/user.entity';
import { MessageRole, AiUsageType } from '../common/enums';
import { CreateBuddyDto, UpdateBuddyDto } from './dto/create-buddy.dto';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';

/** Default plan limits — overridable via Redis key `ai:limits:default`. */
const DEFAULT_LIMITS = {
  dailyMessageLimit: 50,
  dailyTokenLimit: 100_000,
  maxContextMessages: 10,
};

/** Model used for the AI buddy. Haiku is fast and cheap for chat. */
const AI_MODEL = 'claude-haiku-4-5-20251001';

export interface ChatResponse {
  conversationId: string;
  reply: string;
  tokensUsed: { prompt: number; completion: number };
}

@Injectable()
export class AiGatewayService implements OnModuleInit {
  private anthropic: Anthropic;
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(AiUsage)
    private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(AiBuddy)
    private readonly buddies: Repository<AiBuddy>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = new Anthropic({ apiKey });
  }

  /** Fetch current plan limits from Redis (with fallback to code defaults). */
  private async getLimits(): Promise<typeof DEFAULT_LIMITS> {
    try {
      const raw = await this.redis.get('ai:limits:default');
      if (raw) return { ...DEFAULT_LIMITS, ...JSON.parse(raw) };
    } catch {
      this.logger.warn('Could not read AI limits from Redis — using defaults');
    }
    return DEFAULT_LIMITS;
  }

  /** Count how many AI messages this user has sent today. */
  private dailyMessageKey(userId: string): string {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return `ai:daily:msg:${userId}:${today}`;
  }

  private dailyTokenKey(userId: string): string {
    const today = new Date().toISOString().slice(0, 10);
    return `ai:daily:tokens:${userId}:${today}`;
  }

  /**
   * Send a chat message to the AI buddy.
   *  1. Check daily limits (messages + tokens).
   *  2. Load prior thread context (last N messages).
   *  3. Call Anthropic API.
   *  4. Persist both sides of the exchange to Message.
   *  5. Log the call to AiUsage.
   *  6. Increment Redis daily counters (TTL = 25h to survive timezone drift).
   */
  async chat(userId: string, message: string, conversationId?: string): Promise<ChatResponse> {
    const limits = await this.getLimits();
    const convId = conversationId ?? randomUUID();

    // --- Limit checks ---
    const msgCount = parseInt((await this.redis.get(this.dailyMessageKey(userId))) ?? '0', 10);
    if (msgCount >= limits.dailyMessageLimit) {
      throw new ForbiddenException(
        `Өдрийн AI хэрэглээний хязгаар хэтэрлээ (${limits.dailyMessageLimit} мессеж/өдөр)`,
      );
    }

    const tokenCount = parseInt((await this.redis.get(this.dailyTokenKey(userId))) ?? '0', 10);
    if (tokenCount >= limits.dailyTokenLimit) {
      throw new ForbiddenException(
        `Өдрийн токений хязгаар хэтэрлээ (${limits.dailyTokenLimit} токен/өдөр)`,
      );
    }

    // --- Plan-based monthly token limit ---
    const user = await this.usersRepo.findOne({ where: { id: userId }, relations: ['plan'] });
    if (user?.plan && user.plan.aiTextTokensLimit !== null) {
      const usedK = Math.ceil((user.aiInputTokens + user.aiOutputTokens) / 1000);
      if (usedK >= user.plan.aiTextTokensLimit) {
        throw new ForbiddenException(
          `Сарын AI токений хязгаар хэтэрлээ (${user.plan.aiTextTokensLimit}K токен/сар)`,
        );
      }
    }

    // --- Load conversation history (newest N, then reverse for chronological order) ---
    const history = await this.messages.find({
      where: { userId, conversationId: convId },
      order: { createdAt: 'DESC' },
      take: limits.maxContextMessages,
    });
    history.reverse();

    const apiMessages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({
        role: m.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // --- Call Anthropic ---
    const response = await this.anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      system:
        'Та EnglishXP платформ дахь Англи хэлний туслах AI. ' +
        'Монгол оюутнуудад Англи хэл сурахад тусал. ' +
        'Хариултаа товч, тодорхой, найрсаг байлга. ' +
        'Зохистой бол Монгол болон Англи хэлийг хольж тайлбарла.',
      messages: apiMessages,
    });

    const reply =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const promptTokens = response.usage.input_tokens;
    const completionTokens = response.usage.output_tokens;

    // --- Persist messages ---
    await this.messages.save([
      this.messages.create({
        userId,
        conversationId: convId,
        role: MessageRole.USER,
        content: message,
      }),
      this.messages.create({
        userId,
        conversationId: convId,
        role: MessageRole.ASSISTANT,
        content: reply,
      }),
    ]);

    // --- Log usage ---
    // Cost estimate: Haiku input ~$0.80/M tokens, output ~$4/M tokens (in micro-USD)
    const costMicroUsd =
      Math.round(promptTokens * 0.0008) + Math.round(completionTokens * 0.004);

    await this.aiUsages.save(
      this.aiUsages.create({
        userId,
        type: AiUsageType.TEXT_CHAT,
        model: AI_MODEL,
        promptTokens,
        completionTokens,
        voiceSeconds: 0,
        costMicroUsd,
        metadata: { conversationId: convId },
      }),
    );

    // --- Increment daily counters (TTL 25h = 90_000s) ---
    const msgKey = this.dailyMessageKey(userId);
    const tokKey = this.dailyTokenKey(userId);
    const totalTokens = promptTokens + completionTokens;
    await this.redis
      .multi()
      .incr(msgKey)
      .expire(msgKey, 90_000)
      .incrby(tokKey, totalTokens)
      .expire(tokKey, 90_000)
      .exec();

    // --- Increment monthly usage counters on User ---
    if (user) {
      await this.usersRepo.increment({ id: userId }, 'aiInputTokens', promptTokens);
      await this.usersRepo.increment({ id: userId }, 'aiOutputTokens', completionTokens);
    }

    return { conversationId: convId, reply, tokensUsed: { prompt: promptTokens, completion: completionTokens } };
  }

  /**
   * Return the message history for a conversation thread.
   * Only the owner's messages are returned.
   */
  async getHistory(userId: string, conversationId: string): Promise<Message[]> {
    return this.messages.find({
      where: { userId, conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Admin endpoint: update plan limits stored in Redis.
   * Changes take effect on the next request (no app restart needed).
   */
  async updateLimits(limits: Partial<typeof DEFAULT_LIMITS>): Promise<typeof DEFAULT_LIMITS> {
    const current = await this.getLimits();
    const updated = { ...current, ...limits };
    await this.redis.set('ai:limits:default', JSON.stringify(updated));
    return updated;
  }

  /** Return all active buddies from DB; auto-seed from buddies.ts on first run. */
  async findAllBuddies(): Promise<AiBuddy[]> {
    const count = await this.buddies.count();
    if (count === 0) await this.seedBuddies();
    return this.buddies.find({ where: { isActive: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  private async seedBuddies(): Promise<void> {
    const { AI_BUDDIES } = await import('./buddies');
    const rows = AI_BUDDIES.map((b, i) =>
      this.buddies.create({
        slug: b.slug, name: b.name, title: b.title,
        description: b.description, emoji: b.emoji,
        systemPrompt: b.systemPrompt,
        extraMessagesAmount: b.pricing.extraMessagesAmount,
        extraMessagesCost: b.pricing.extraMessagesCost,
        voiceMinuteCost: b.pricing.voiceMinuteCost,
        isActive: true, sortOrder: i,
      }),
    );
    await this.buddies.save(rows);
    this.logger.log(`Seeded ${rows.length} AI buddies from buddies.ts`);
  }

  async createBuddy(dto: CreateBuddyDto): Promise<AiBuddy> {
    const buddy = this.buddies.create(dto);
    return this.buddies.save(buddy);
  }

  async updateBuddy(slug: string, dto: UpdateBuddyDto): Promise<AiBuddy> {
    const buddy = await this.buddies.findOneOrFail({ where: { slug } });
    Object.assign(buddy, dto);
    return this.buddies.save(buddy);
  }

  async removeBuddy(slug: string): Promise<void> {
    const buddy = await this.buddies.findOneOrFail({ where: { slug } });
    await this.buddies.remove(buddy);
  }

  /**
   * Admin: usage stats per AI buddy.
   * Returns 0 until mobile implements buddy selection (metadata not yet set).
   */
  async getBuddyStats(): Promise<
    { slug: string; totalMessages: number; totalTokens: number; costMicroUsd: number }[]
  > {
    const activeBuddies = await this.buddies.find({ where: { isActive: true } });
    return Promise.all(
      activeBuddies.map(async (buddy) => {
        const row = await this.aiUsages
          .createQueryBuilder('a')
          .select('COUNT(*)::int', 'totalMessages')
          .addSelect('COALESCE(SUM(a.prompt_tokens + a.completion_tokens), 0)::int', 'totalTokens')
          .addSelect('COALESCE(SUM(a.cost_micro_usd), 0)::int', 'costMicroUsd')
          .where(`a.metadata->>'buddySlug' = :slug`, { slug: buddy.slug })
          .getRawOne<{ totalMessages: number; totalTokens: number; costMicroUsd: number }>();

        return {
          slug: buddy.slug,
          totalMessages: Number(row?.totalMessages ?? 0),
          totalTokens: Number(row?.totalTokens ?? 0),
          costMicroUsd: Number(row?.costMicroUsd ?? 0),
        };
      }),
    );
  }
}
