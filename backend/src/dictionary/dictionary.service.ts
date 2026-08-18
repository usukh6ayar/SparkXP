import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Word } from '../entities/word.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Translation } from '../entities/translation.entity';
import { AiUsageType } from '../common/enums';
import type { WordSense } from '../common/types/word-sense';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { runGeminiText } from './gemini-text';

export interface WordLookup {
  word: string;
  /** Short Mongolian meaning. */
  translation: string;
  /** Pronunciation audio URL if already generated, else null. */
  audioUrl: string | null;
  /** True when served from the Word DB or the translation cache (no AI call). */
  cached: boolean;
  /**
   * Usage examples in the same shape as the Толь senses panel. Present when the
   * curated Word bank already has example_sentence/example_translation.
   */
  meanings?: WordSense[];
}

@Injectable()
export class DictionaryService {
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
      const example = this.wordExampleSense(dbWord);
      return {
        word: normalised,
        translation: dbWord.mongolian,
        audioUrl: dbWord.audioUrl ?? null,
        cached: true,
        ...(example ? { meanings: [example] } : {}),
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

  private wordExampleSense(word: Word): WordSense | null {
    const example = word.exampleSentence?.trim();
    const translation = word.exampleTranslation?.trim();
    if (!example || !translation) return null;
    return {
      word: word.english.trim().toLowerCase(),
      example,
      translation,
    };
  }

  /**
   * Pronunciation audio for a word (Gemini via the AI gateway). Generated
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

    // Generate once via Gemini and cache the URL.
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
          source: 'gemini',
        }),
      );
    }

    return { audioUrl };
  }

  /**
   * Full Mongolian translation of an English sentence/phrase (reading reader:
   * long-press a sentence). Unlike `explain`, this is a complete sentence
   * translation, not a 1–4 word gloss. Cache order: translation cache → Gemini
   * (sentence-tuned prompt), then cached. The plan's dictionary AI limit applies.
   */
  async translateSentence(
    userId: string,
    text: string,
  ): Promise<{ translation: string; cached: boolean }> {
    const clean = text.trim().replace(/\s+/g, ' ');
    if (!clean) throw new BadRequestException('Хоосон текст');

    // The `translations.word` cache key is a unique varchar — only cache
    // sentences short enough to fit; longer ones translate without caching.
    const cacheKey = clean.toLowerCase();
    const cacheable = cacheKey.length <= 200;

    // 1. Translation cache (a previous identical sentence).
    if (cacheable) {
      const hit = await this.translations.findOne({ where: { word: cacheKey } });
      if (hit) return { translation: hit.translation, cached: true };
    }

    // 2. Enforce the monthly plan limit only when we actually call the AI.
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

    const prompt =
      'Дараах англи өгүүлбэрийг монгол хэл рүү бүтнээр, ойлгомжтой орчуул.\n' +
      'Зөвхөн монгол орчуулгыг бич — тайлбар, англи эх бичвэр бүү нэм.\n\n' +
      `"${clean}"`;
    const { text: translation, model, promptTokens, completionTokens } =
      await this.runGemini(prompt, 'sentence');

    if (cacheable) {
      await this.translations.save(
        this.translations.create({
          word: cacheKey,
          translation,
          audioUrl: null,
          source: model,
        }),
      );
    }

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
        metadata: { feature: 'dictionary_sentence' },
      }),
    );
    if (user) {
      await this.users.increment({ id: userId }, 'dictionaryAiCount', 1);
    }

    return { translation, cached: false };
  }

  /**
   * Ask Gemini for ONLY the short Mongolian meaning of an English word (a few
   * words, no explanation).
   */
  private async askGemini(word: string): Promise<{
    translation: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }> {
    const prompt =
      `"${word}" гэсэн англи үгийн монгол утгыг бич.\n` +
      'Зөвхөн монгол орчуулгыг бич — богино (1-4 үг), тайлбар, жишээ, англи үг бүү нэм.';
    const { text, model, promptTokens, completionTokens } = await this.runGemini(
      prompt,
      word,
    );
    return { translation: text, model, promptTokens, completionTokens };
  }

  /**
   * Low-level Gemini text call shared by word + sentence translation.
   * Delegates to the shared helper — see gemini-text.ts.
   */
  private async runGemini(
    prompt: string,
    label: string,
  ): Promise<{
    text: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }> {
    return runGeminiText(this.config, prompt, label);
  }
}
