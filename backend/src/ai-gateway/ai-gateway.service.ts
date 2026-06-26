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
  'Create a cute, modern, polished 3D educational app illustration. The image should feel soft, premium, student-friendly, and easy to understand at a glance. Use smooth rounded shapes, clean forms, soft lighting, balanced composition, and a high-quality cartoon-like 3D render.',
  '',
  'The image should look like it belongs inside a modern English learning app, but do not include robot designs, AI symbols, chatbot icons, tech logos, circuit patterns, screen-face characters, futuristic tech elements, or robotic details.',
  '',
  'Use a random soft modern color palette for each image. Colors should vary naturally from image to image. Use soft balanced tones such as blue, green, orange, yellow, pink, teal, purple, lavender, cream, beige, or warm neutrals depending on the word’s mood and meaning. Do not make every image purple.',
  '',
  'Main meaning rule:',
  'Show the meaning of the word clearly and directly. The image must help English learners understand the word instantly.',
  '',
  'Subject selection rule:',
  'Only include elements that are necessary to explain the word clearly.',
  'If the word can be understood clearly with just an object, place, symbol, or simple scene, then do not add a person or animal.',
  'If a human or living character is helpful or necessary to explain the meaning naturally, include one.',
  '',
  'Guidance by word type:',
  '',
  'For concrete nouns:',
  'Focus mainly on the object itself.',
  'If the noun can be understood alone, show only the object.',
  'If context is needed, add only minimal supporting elements.',
  '',
  'For verbs:',
  'Show one clear action.',
  'Include a human or living character when needed to make the action understandable.',
  'Do not add extra characters if one is enough.',
  '',
  'For adjectives:',
  'Show one clear visual quality, feeling, or condition.',
  'Use a human, face, pose, or body language if that is the clearest way to show the adjective.',
  'If the adjective can be shown without a person, that is also fine.',
  '',
  'For abstract words:',
  'Use a simple symbolic or situational scene.',
  'Include a human only if it helps make the meaning clearer.',
  '',
  'Character rule:',
  'Humans are allowed when they help explain the word clearly.',
  'Do not include humans, animals, or mascots unless they improve understanding.',
  'If a character is included, keep it simple, cute, natural, and non-robotic.',
  'Use only the number of characters needed, usually one.',
  'If clothing is shown, it must be plain with no logos, no icons, no emblems, no badges, no symbols, and no text.',
  '',
  'Important visual rules:',
  'No robots.',
  'No robot signs.',
  'No chatbot icons.',
  'No AI logos.',
  'No circuit patterns.',
  'No tech symbols.',
  'No screen-face characters.',
  'No futuristic interface elements.',
  'No logos on clothing.',
  'No icons on clothing.',
  'No written text inside the image.',
  'No labels.',
  'No captions.',
  'No speech bubbles.',
  'No watermarks.',
  'No app UI.',
  'No phone screen.',
  'No buttons.',
  'No unnecessary characters.',
  'No cluttered background.',
  '',
  'Keep the background simple, soft, and uncluttered.',
  'Focus on one clear subject or one clear scene.',
  'Make the meaning easy to understand for English learners.',
  'Keep the composition centered and suitable for a square vocabulary card.',
  '',
  'Output one square image in a polished, consistent, modern 3D educational app illustration style.',
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
    // Sync buddy definitions from buddies.ts to DB on every start
    this.syncBuddiesFromFile().catch((e: unknown) =>
      this.logger.error('Buddy sync failed', e instanceof Error ? e.message : e),
    );
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

    const dev = this.config.get('NODE_ENV') !== 'production';
    if (dev) {
      this.logger.log(`[AI] OpenAI image generate for "${input.english}" (model=${model}, n=1)`);
      this.logger.log(`[AI] OpenAI image prompt:\n${prompt}`);
    }

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
    // Dev-only: show the response shape (how many images came back) without
    // dumping the huge base64 blob, so you can confirm it's exactly 1.
    if (dev) {
      this.logger.log(
        `[AI] OpenAI image response: status=${response.status}, images=${body.data?.length ?? 0}` +
          (body.error ? `, error=${body.error.message}` : ''),
      );
    }
    const b64 = body.data?.[0]?.b64_json;
    if (!response.ok || !b64) {
      throw new InternalServerErrorException(
        body.error?.message ?? 'OpenAI image generation failed',
      );
    }

    const imageUrl = await this.imageStorage.storeGeneratedImage({
      buffer: Buffer.from(b64, 'base64'),
      // Stable name (no timestamp) → re-generating overwrites the word's single
      // image in Cloudinary instead of leaving orphaned copies behind.
      filename: `${this.safeFilename(input.english)}.png`,
      mimeType: 'image/png',
      folder: this.config.get<string>('CLOUDINARY_WORD_IMAGES_FOLDER'),
    });
    if (dev) this.logger.log(`[AI] OpenAI image stored → ${imageUrl}`);

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
    const dev = this.config.get('NODE_ENV') !== 'production';
    if (dev) this.logger.log(`[AI] ElevenLabs TTS for "${input.english}" (voice=${voiceId}, model=${model})`);

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
    if (dev) this.logger.log(`[AI] ElevenLabs TTS ok: ${buffer.length} bytes`);
    const audioUrl = await this.imageStorage.storeMedia({
      buffer,
      filename: `${this.safeFilename(input.english)}-${Date.now()}.mp3`,
      mimeType: 'audio/mpeg',
      // Cloudinary serves audio under its "video" resource type.
      resourceType: 'video',
      folder: this.config.get<string>('CLOUDINARY_AUDIO_FOLDER', 'englishxp/audio'),
      localSubdir: 'audio',
    });
    if (dev) this.logger.log(`[AI] ElevenLabs audio stored → ${audioUrl}`);

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

  /** Return all active buddies from DB (synced from buddies.ts on every start). */
  async findAllBuddies(): Promise<AiBuddy[]> {
    return this.buddies.find({ where: { isActive: true }, order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  /**
   * Full sync: upsert every buddy from buddies.ts, delete DB rows not in the file.
   * Called automatically on module init so the DB always reflects the code definition.
   */
  async syncBuddiesFromFile(): Promise<void> {
    const { AI_BUDDIES } = await import('./buddies');
    const fileSlugs = new Set(AI_BUDDIES.map((b) => b.slug));

    // Remove DB rows whose slug is no longer in the file
    const existing = await this.buddies.find();
    const toRemove = existing.filter((b) => !fileSlugs.has(b.slug));
    if (toRemove.length > 0) {
      await this.buddies.remove(toRemove);
      this.logger.log(`Removed ${toRemove.length} outdated AI buddy rows`);
    }

    // Upsert every buddy from the file
    for (let i = 0; i < AI_BUDDIES.length; i++) {
      const b = AI_BUDDIES[i];
      const row = (await this.buddies.findOne({ where: { slug: b.slug } })) ??
        this.buddies.create({ slug: b.slug });
      row.name = b.name;
      row.title = b.title;
      row.description = b.description;
      row.emoji = b.emoji;
      row.systemPrompt = b.systemPrompt;
      row.extraMessagesAmount = b.pricing.extraMessagesAmount;
      row.extraMessagesCost = b.pricing.extraMessagesCost;
      row.voiceMinuteCost = b.pricing.voiceMinuteCost;
      row.isActive = true;
      row.sortOrder = i;
      await this.buddies.save(row);
    }

    this.logger.log(`Synced ${AI_BUDDIES.length} AI buddies from buddies.ts`);
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
