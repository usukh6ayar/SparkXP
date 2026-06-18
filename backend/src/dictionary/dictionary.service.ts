import {
  Injectable,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { User } from '../entities/user.entity';
import { Word } from '../entities/word.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { AiUsageType } from '../common/enums';

const DICT_MODEL = 'claude-haiku-4-5-20251001';

@Injectable()
export class DictionaryService implements OnModuleInit {
  private anthropic: Anthropic;
  private readonly logger = new Logger(DictionaryService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Word) private readonly words: Repository<Word>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
  ) {}

  onModuleInit() {
    this.anthropic = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  /**
   * Explain an English word in Mongolian.
   * 1. Check user's plan limit (dictionaryAiLimit).
   * 2. Try Words DB first (free, instant).
   * 3. Fall back to Anthropic Haiku, log usage, increment counter.
   */
  async explain(
    userId: string,
    word: string,
  ): Promise<{ word: string; explanation: string; cached: boolean }> {
    const normalised = word.trim().toLowerCase();

    // Load user + plan
    const user = await this.users.findOne({
      where: { id: userId },
      relations: ['plan'],
    });

    // Enforce plan limit
    if (user?.plan && user.plan.dictionaryAiLimit !== null) {
      if (user.dictionaryAiCount >= user.plan.dictionaryAiLimit) {
        throw new ForbiddenException(
          `Сарын толь бичгийн хязгаар хэтэрлээ (${user.plan.dictionaryAiLimit} тайлбар/сар)`,
        );
      }
    }

    // DB cache — Words table
    const dbWord = await this.words.findOne({ where: { english: normalised } });
    if (dbWord && dbWord.mongolian) {
      const parts = [
        `**Утга:** ${dbWord.mongolian}`,
        dbWord.partOfSpeech ? `**Ангилал:** ${dbWord.partOfSpeech}` : null,
        dbWord.exampleSentence ? `**Жишээ:** *${dbWord.exampleSentence}*` : null,
        dbWord.exampleTranslation ? `*(${dbWord.exampleTranslation})*` : null,
      ].filter(Boolean);
      return { word: normalised, explanation: parts.join('\n'), cached: true };
    }

    // Call Anthropic
    this.logger.log(`Dictionary AI lookup: "${normalised}" for user ${userId}`);
    const response = await this.anthropic.messages.create({
      model: DICT_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
            `"${word}" гэсэн Англи үгийг Монгол хэлээр товчхон тайлбарла.\n` +
            'Формат:\n- Утга: ...\n- Жишээ: ... (Монгол орчуулгатай)\n- Хэрэглэх байдал: ...',
        },
      ],
    });

    const explanation =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const promptTokens = response.usage.input_tokens;
    const completionTokens = response.usage.output_tokens;

    // Log AI usage
    const costMicroUsd =
      Math.round(promptTokens * 0.0008) + Math.round(completionTokens * 0.004);
    await this.aiUsages.save(
      this.aiUsages.create({
        userId,
        type: AiUsageType.TEXT_CHAT,
        model: DICT_MODEL,
        promptTokens,
        completionTokens,
        voiceSeconds: 0,
        costMicroUsd,
        metadata: { feature: 'dictionary', word: normalised },
      }),
    );

    // Increment monthly counter
    if (user) {
      await this.users.increment({ id: userId }, 'dictionaryAiCount', 1);
    }

    return { word: normalised, explanation, cached: false };
  }
}
