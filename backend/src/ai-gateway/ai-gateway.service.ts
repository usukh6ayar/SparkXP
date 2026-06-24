import {
  Injectable,
  ForbiddenException,
  Logger,
  OnModuleInit,
  Inject,
  InternalServerErrorException,
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
import { ImageStorageService } from './image-storage.service';

/** Default plan limits — overridable via Redis key `ai:limits:default`. */
const DEFAULT_LIMITS = {
  dailyMessageLimit: 50,
  dailyTokenLimit: 100_000,
  maxContextMessages: 10,
};

/** Model used for the AI buddy. Haiku is fast and cheap for chat. */
const AI_MODEL = 'claude-haiku-4-5-20251001';

/** Default model for vocabulary illustrations. Override with OPENAI_IMAGE_MODEL. */
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const IMAGE_COST_MICRO_USD = 6_000;

/**
 * Prompt used to generate a vocabulary illustration. Placeholders {word},
 * {meaning}, {example_sentence}, {part_of_speech} and {cefr} are filled per
 * word. Override the whole thing with the IMAGE_PROMPT_TEMPLATE env var (no app
 * code change needed) to tweak the art style.
 */
const DEFAULT_IMAGE_PROMPT = [
  'Create a clean educational vocabulary illustration for the English word: "{word}".',
  '',
  'Meaning to show: "{meaning}".',
  'Example context: "{example_sentence}".',
  'Part of speech: "{part_of_speech}".',
  'CEFR level: "{cefr}".',
  '',
  'Style requirements:',
  'Make the image in a cute, modern, polished 3D educational style similar to a friendly AI learning companion. The visual style should feel soft, appealing, and student-friendly. Use smooth rounded shapes, clean forms, soft lighting, and a high-quality cartoon-like 3D render. The character design should feel like an AI buddy from an English learning app: expressive, adorable, approachable, and slightly playful, with big friendly eyes, a soft face, and a welcoming expression.',
  '',
  'The overall design language should match a modern learning app for young adults and students. The image should feel premium, minimal, and easy to understand at a glance. The scene should clearly visualize the meaning of the word in a direct and intuitive way.',
  '',
  'Use a random but visually pleasing color palette for each image, with soft, balanced, modern tones. The palette should vary naturally from image to image so the full vocabulary set feels diverse and fresh. Colors may include purple, blue, green, orange, yellow, pink, teal, or other soft complementary tones, depending on the mood and meaning of the word. Avoid making every image dominated by the same color. Keep the palette harmonious, clean, and suitable for an educational app.',
  '',
  'Include one main cute AI-buddy-style character or a small number of characters if needed for the meaning. The character should look like a smart educational app mascot or helper, with a friendly and encouraging presence. Clothing and accessories can subtly include modern app-like styling such as a hoodie or simple casual outfit, but keep it clean and not overly detailed.',
  '',
  'Important visual rules:',
  'Show the meaning clearly and literally when possible.',
  'Make the concept easy to understand for English learners.',
  'Keep the background simple and uncluttered.',
  'Focus on one clear scene.',
  'Make it suitable for a vocabulary learning card.',
  'No written text inside the image.',
  'No labels, captions, speech bubbles, or watermarks.',
  'No complex background distractions.',
  'Keep the composition centered and visually clean.',
  'Make the image emotionally clear and memorable.',
  '',
  'If the word is abstract, represent it with a simple symbolic or situational scene that communicates the meaning clearly. If the word is concrete, show the object or action very clearly.',
  '',
  'Output a square image with a polished, consistent, modern educational app illustration style.',
].join('\n');

/** ElevenLabs TTS defaults (override via env). "Rachel" is an ElevenLabs preset voice. */
const DEFAULT_TTS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2';
const AUDIO_COST_MICRO_USD = 3_000;

export interface ChatResponse {
  conversationId: string;
  reply: string;
  tokensUsed: { prompt: number; completion: number };
}

export interface VocabularyImageRequest {
  userId: string;
  wordId: string;
  english: string;
  mongolian: string;
  partOfSpeech?: string | null;
  exampleSentence?: string | null;
  cefr?: string | null;
}

export interface VocabularyImageResponse {
  imageUrl: string;
  model: string;
}

export interface VocabularyAudioRequest {
  userId: string;
  wordId: string;
  english: string;
}

export interface VocabularyAudioResponse {
  audioUrl: string;
  model: string;
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
    private readonly imageStorage: ImageStorageService,
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
   * Generate one safe, text-free vocabulary illustration and store it as a URL.
   * Features call this gateway instead of calling AI providers directly.
   */
  async generateVocabularyImage(
    input: VocabularyImageRequest,
  ): Promise<VocabularyImageResponse> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('OPENAI_API_KEY тохируулаагүй байна');
    }

    const model = this.config.get<string>('OPENAI_IMAGE_MODEL', DEFAULT_IMAGE_MODEL);
    const template =
      this.config.get<string>('IMAGE_PROMPT_TEMPLATE') || DEFAULT_IMAGE_PROMPT;
    const prompt = template
      .replace(/\{word\}/g, input.english)
      .replace(/\{meaning\}/g, input.mongolian || '')
      .replace(/\{example_sentence\}/g, input.exampleSentence || '')
      .replace(/\{part_of_speech\}/g, input.partOfSpeech || '')
      .replace(/\{cefr\}/g, input.cefr || '');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size: this.config.get<string>('OPENAI_IMAGE_SIZE', '1024x1024'),
        quality: this.config.get<string>('OPENAI_IMAGE_QUALITY', 'low'),
        n: 1,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      data?: { b64_json?: string }[];
      error?: { message?: string };
    };
    const b64 = body.data?.[0]?.b64_json;
    if (!response.ok || !b64) {
      throw new InternalServerErrorException(
        body.error?.message ?? 'OpenAI image generation failed',
      );
    }

    const imageUrl = await this.imageStorage.storeGeneratedImage({
      buffer: Buffer.from(b64, 'base64'),
      filename: `${this.safeFilename(input.english)}-${Date.now()}.png`,
      mimeType: 'image/png',
      folder: this.config.get<string>('CLOUDINARY_WORD_IMAGES_FOLDER'),
    });

    await this.aiUsages.save(
      this.aiUsages.create({
        userId: input.userId,
        type: AiUsageType.IMAGE_GENERATION,
        model,
        promptTokens: 0,
        completionTokens: 0,
        voiceSeconds: 0,
        costMicroUsd: IMAGE_COST_MICRO_USD,
        metadata: {
          wordId: input.wordId,
          english: input.english,
          provider: 'openai',
          size: this.config.get<string>('OPENAI_IMAGE_SIZE', '1024x1024'),
          quality: this.config.get<string>('OPENAI_IMAGE_QUALITY', 'low'),
        },
      }),
    );

    return { imageUrl, model };
  }

  /**
   * Generate a pronunciation audio clip (mp3) for a word via ElevenLabs TTS and
   * store it as a URL. Features call this gateway instead of ElevenLabs directly.
   */
  async generateVocabularyAudio(
    input: VocabularyAudioRequest,
  ): Promise<VocabularyAudioResponse> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ELEVENLABS_API_KEY тохируулаагүй байна');
    }

    const voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID', DEFAULT_TTS_VOICE_ID);
    const model = this.config.get<string>('ELEVENLABS_MODEL', DEFAULT_TTS_MODEL);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text: input.english, model_id: model }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`ElevenLabs TTS failed (${response.status}): ${body}`);
      throw new InternalServerErrorException('Аудио үүсгэхэд алдаа гарлаа');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const audioUrl = await this.imageStorage.storeMedia({
      buffer,
      filename: `${this.safeFilename(input.english)}-${Date.now()}.mp3`,
      mimeType: 'audio/mpeg',
      // Cloudinary serves audio under its "video" resource type.
      resourceType: 'video',
      folder: this.config.get<string>('CLOUDINARY_AUDIO_FOLDER', 'englishxp/audio'),
      localSubdir: 'audio',
    });

    await this.aiUsages.save(
      this.aiUsages.create({
        userId: input.userId,
        type: AiUsageType.TTS,
        model,
        promptTokens: 0,
        completionTokens: 0,
        voiceSeconds: 0,
        costMicroUsd: AUDIO_COST_MICRO_USD,
        metadata: {
          wordId: input.wordId,
          english: input.english,
          provider: 'elevenlabs',
          voiceId,
        },
      }),
    );

    return { audioUrl, model };
  }

  private safeFilename(value: string): string {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'word'
    );
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
