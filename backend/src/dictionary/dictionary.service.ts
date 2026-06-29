import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Word } from '../entities/word.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Translation } from '../entities/translation.entity';
import { AiUsageType } from '../common/enums';
import { geminiRetryDelayMs } from '../words/words.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Word) private readonly words: Repository<Word>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(Translation)
    private readonly translations: Repository<Translation>,
  ) {}

  /**
   * Explain an English word in Mongolian. Lookup order:
   *   1. Word DB (the curated "swipe" vocabulary) — free, instant.
   *   2. Translation cache (previous AI lookups) — free, instant.
   *   3. Gemini — only here is the plan limit enforced; the result is saved to
   *      the translation cache so the same word never hits the AI twice.
   */
  async explain(
    userId: string,
    word: string,
  ): Promise<{ word: string; explanation: string; cached: boolean }> {
    const normalised = word.trim().toLowerCase();

    // 1. Word DB (authored vocabulary) — build a card from its fields.
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

    // 2. Translation cache (a previous Gemini lookup).
    const cached = await this.translations.findOne({ where: { word: normalised } });
    if (cached) {
      return { word: normalised, explanation: cached.explanation, cached: true };
    }

    // 3. Enforce the monthly plan limit only when we actually call the AI.
    const user = await this.users.findOne({
      where: { id: userId },
      relations: ['plan'],
    });
    if (user?.plan && user.plan.dictionaryAiLimit !== null) {
      if (user.dictionaryAiCount >= user.plan.dictionaryAiLimit) {
        throw new ForbiddenException(
          `Сарын толь бичгийн хязгаар хэтэрлээ (${user.plan.dictionaryAiLimit} тайлбар/сар)`,
        );
      }
    }

    const { explanation, model, promptTokens, completionTokens } =
      await this.askGemini(normalised);

    // Save to the translation cache so this word is never sent to AI again.
    await this.translations.save(
      this.translations.create({ word: normalised, explanation, source: model }),
    );

    // Log usage + bump the user's monthly counter.
    const costMicroUsd =
      Math.round(promptTokens * 0.0001) + Math.round(completionTokens * 0.0004);
    await this.aiUsages.save(
      this.aiUsages.create({
        userId,
        type: AiUsageType.TEXT_CHAT,
        model,
        promptTokens,
        completionTokens,
        voiceSeconds: 0,
        costMicroUsd,
        metadata: { feature: 'dictionary', word: normalised },
      }),
    );
    if (user) {
      await this.users.increment({ id: userId }, 'dictionaryAiCount', 1);
    }

    return { word: normalised, explanation, cached: false };
  }

  /**
   * Ask Gemini for a short Mongolian explanation of an English word. Plain text
   * (markdown), formatted to match the Word-DB card so the mobile renderer is
   * identical. Retries transient 429/503/overload responses.
   */
  private async askGemini(word: string): Promise<{
    explanation: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY тохируулаагүй байна');
    }
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

    const prompt =
      `"${word}" гэсэн Англи үгийг Монгол хэлээр товчхон тайлбарла.\n` +
      'Зөвхөн доорх форматаар бич (markdown, нэмэлт тайлбаргүй):\n' +
      '**Утга:** <монгол утга>\n' +
      '**Жишээ:** *<богино англи өгүүлбэр>* (<монгол орчуулга>)\n' +
      '**Хэрэглэх байдал:** <хаана, хэрхэн хэрэглэдэг тухай 1 өгүүлбэр>';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      }),
    };

    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, requestInit);
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const explanation = parts
          .filter((p) => !p.thought && p.text)
          .map((p) => p.text)
          .join('')
          .trim();
        if (!explanation) {
          throw new InternalServerErrorException('AI хоосон хариу буцаалаа');
        }
        return {
          explanation,
          model,
          promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        };
      }

      const body = await response.text().catch(() => '');
      const transient =
        response.status === 429 ||
        response.status === 503 ||
        (response.status === 404 &&
          /high demand|unavailable|overloaded|try again/i.test(body));
      if (transient && attempt < MAX_ATTEMPTS) {
        const waitMs = geminiRetryDelayMs(body, attempt);
        this.logger.warn(
          `Gemini ${response.status} for "${word}" — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      this.logger.error(`Gemini dictionary failed (${response.status}): ${body}`);
      throw new InternalServerErrorException('Тайлбар үүсгэхэд алдаа гарлаа');
    }
  }
}
