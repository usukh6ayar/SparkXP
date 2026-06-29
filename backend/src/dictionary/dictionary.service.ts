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
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { geminiRetryDelayMs } from '../words/words.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WordLookup {
  word: string;
  /** Short Mongolian meaning. */
  translation: string;
  /** Pronunciation audio URL if already generated, else null. */
  audioUrl: string | null;
  /** True when served from the Word DB or the translation cache (no AI call). */
  cached: boolean;
}

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly aiGateway: AiGatewayService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Word) private readonly words: Repository<Word>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(Translation)
    private readonly translations: Repository<Translation>,
  ) {}

  /**
   * Look up the short Mongolian meaning of an English word. Lookup order:
   *   1. Word DB (the curated "swipe" vocabulary) — free, instant.
   *   2. Translation cache (previous AI lookups) — free, instant.
   *   3. Gemini — only here is the plan limit enforced; the result is saved to
   *      the translation cache so the same word never hits the AI twice.
   */
  async explain(userId: string, word: string): Promise<WordLookup> {
    const normalised = word.trim().toLowerCase();

    // 1. Word DB (authored vocabulary).
    const dbWord = await this.words.findOne({ where: { english: normalised } });
    if (dbWord && dbWord.mongolian) {
      return {
        word: normalised,
        translation: dbWord.mongolian,
        audioUrl: dbWord.audioUrl ?? null,
        cached: true,
      };
    }

    // 2. Translation cache (a previous Gemini lookup).
    const cached = await this.translations.findOne({ where: { word: normalised } });
    if (cached) {
      return {
        word: normalised,
        translation: cached.translation,
        audioUrl: cached.audioUrl,
        cached: true,
      };
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

    const { translation, model, promptTokens, completionTokens } =
      await this.askGemini(normalised);

    // Save to the translation cache so this word is never sent to AI again.
    await this.translations.save(
      this.translations.create({
        word: normalised,
        translation,
        audioUrl: null,
        source: model,
      }),
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

    return { word: normalised, translation, audioUrl: null, cached: false };
  }

  /**
   * Pronunciation audio for a word (ElevenLabs via the AI gateway). Generated
   * lazily on the first speaker tap, then cached forever: reuses the Word DB's
   * audio, else the translation cache's, else generates once and stores it.
   */
  async getAudio(userId: string, word: string): Promise<{ audioUrl: string }> {
    const normalised = word.trim().toLowerCase();

    // Reuse the curated word's audio if it exists.
    const dbWord = await this.words.findOne({ where: { english: normalised } });
    if (dbWord?.audioUrl) return { audioUrl: dbWord.audioUrl };

    // Reuse a previously generated dictionary clip.
    const row = await this.translations.findOne({ where: { word: normalised } });
    if (row?.audioUrl) return { audioUrl: row.audioUrl };

    // Generate once via ElevenLabs and cache the URL.
    const { audioUrl } = await this.aiGateway.generateVocabularyAudio({
      userId,
      wordId: 'dictionary',
      english: normalised,
    });

    if (row) {
      row.audioUrl = audioUrl;
      await this.translations.save(row);
    } else {
      // No translation row yet (audio tapped before/without a text lookup).
      await this.translations.save(
        this.translations.create({
          word: normalised,
          translation: '',
          audioUrl,
          source: 'elevenlabs',
        }),
      );
    }

    return { audioUrl };
  }

  /**
   * Ask Gemini for ONLY the short Mongolian meaning of an English word (a few
   * words, no explanation). Retries transient 429/503/overload responses.
   */
  private async askGemini(word: string): Promise<{
    translation: string;
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
      `"${word}" гэсэн англи үгийн монгол утгыг бич.\n` +
      'Зөвхөн монгол орчуулгыг бич — богино (1-4 үг), тайлбар, жишээ, англи үг бүү нэм.';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
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
        const translation = parts
          .filter((p) => !p.thought && p.text)
          .map((p) => p.text)
          .join('')
          .trim();
        if (!translation) {
          throw new InternalServerErrorException('AI хоосон хариу буцаалаа');
        }
        return {
          translation,
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
      throw new InternalServerErrorException('Орчуулга үүсгэхэд алдаа гарлаа');
    }
  }
}
