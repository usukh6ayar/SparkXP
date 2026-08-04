import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Translation } from '../entities/translation.entity';
import { DictionaryEntry } from '../entities/dictionary-entry.entity';
import { UserDictionarySave } from '../entities/user-dictionary-save.entity';
import { AiUsageType } from '../common/enums';
import { runGeminiText } from './gemini-text';
import {
  parseSenses,
  sensesPrompt,
  MAX_SENSES,
  SENSE_FIELD_MAX,
  SENSES_SCHEMA,
  type WordSense,
} from './senses';

/** Search result returned to the mobile Толь card. */
export interface SensesResult {
  word: string;
  senses: WordSense[];
  /** True when served from dictionary_entries (no AI call, no plan usage). */
  cached: boolean;
}

/** One row of the user's ⭐ dictionary list. */
export interface SavedDictionaryWord {
  word: string;
  /** The cached senses, or null if this word was starred from the reader. */
  senses: WordSense[] | null;
  /** One-line subtitle for the list — see the design doc §4.3. */
  translation: string;
}

/** Same normalisation everywhere: trim, lowercase, collapse inner whitespace. */
export const normaliseWord = (raw: string): string =>
  raw.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The Толь (dictionary) feature: 4-sense search with a permanent cache, the
 * user's ⭐ list, and the admin CRUD behind /dictionary/admin.
 *
 * Split out of DictionaryService, which keeps its original job (short gloss for
 * the reader's double-tap, whole-sentence translation, pronunciation audio).
 */
@Injectable()
export class DictionarySensesService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(Translation)
    private readonly translations: Repository<Translation>,
    @InjectRepository(DictionaryEntry)
    private readonly entries: Repository<DictionaryEntry>,
    @InjectRepository(UserDictionarySave)
    private readonly saves: Repository<UserDictionarySave>,
  ) {}

  /**
   * Look a word up in the Толь. Order: dictionary_entries → Gemini (then cached).
   *
   * The curated `words` bank is NOT consulted: it holds a single meaning per
   * word and cannot produce four, so a hit there would silently downgrade the
   * result. The reader's short-gloss path (DictionaryService.explain) still
   * uses it and is unaffected.
   */
  async search(userId: string, raw: string): Promise<SensesResult> {
    const word = normaliseWord(raw);
    if (!word) throw new BadRequestException('Хоосон үг');
    // The path param is unvalidated, and a miss costs a real Gemini call — so
    // reject junk before spending money on it.
    if (word.length > SENSE_FIELD_MAX.word) {
      throw new BadRequestException('Хэт урт үг');
    }

    // 1. Cache hit — still counts as a search, so the admin "most searched"
    //    ordering means something. Must happen BEFORE the early return.
    const hit = await this.entries.findOne({ where: { word } });
    if (hit) {
      await this.entries.increment({ id: hit.id }, 'searchCount', 1);
      await this.entries.update({ id: hit.id }, { lastSearchedAt: new Date() });
      return { word, senses: hit.senses ?? [], cached: true };
    }

    // 2. Plan limit — only enforced when we are actually about to call the AI.
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

    // 3. Ask Gemini in JSON mode, then distrust the answer anyway.
    const { text, model, promptTokens, completionTokens } = await runGeminiText(
      this.config,
      sensesPrompt(word),
      `senses:${word}`,
      { json: true, schema: SENSES_SCHEMA },
    );
    const senses = parseSenses(text);
    if (senses.length === 0) {
      // Nothing trustworthy came back — report not-found and cache NOTHING, so
      // a bad reply doesn't become a permanent row.
      throw new NotFoundException('Энэ үгийн утга олдсонгүй');
    }

    // 4. Cache. Two users can search the same new word at the same moment; the
    //    unique index decides the winner and the loser reads it back.
    let racedTo: DictionaryEntry | null = null;
    try {
      await this.entries.save(
        this.entries.create({
          word,
          senses,
          searchCount: 1,
          lastSearchedAt: new Date(),
          source: model,
          edited: false,
        }),
      );
    } catch (err) {
      // Only a unique violation is expected here — another request cached the
      // same new word a moment earlier. Anything else (connection loss, a
      // constraint from a future column) is rethrown as itself: swallowing it
      // would report a database outage to the student as "word not found" and
      // silently discard the Gemini call we just paid for.
      if ((err as { code?: string }).code !== '23505') throw err;
      racedTo = await this.entries.findOne({ where: { word } });
      if (!racedTo) throw new NotFoundException('Энэ үгийн утга олдсонгүй');
    }

    // 5. Usage log + monthly counter. Its own `feature` so the admin Usage page
    //    can separate the cost from the short-gloss lookups.
    //    This runs on the raced path too: the loser still made — and paid for —
    //    a Gemini call, so returning early here would silently under-report
    //    spend and hand out one free call past the plan limit.
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
        metadata: { feature: 'dictionary_senses', word },
      }),
    );
    if (user) {
      await this.users.increment({ id: userId }, 'dictionaryAiCount', 1);
    }

    if (racedTo) return { word, senses: racedTo.senses ?? [], cached: true };
    return { word, senses, cached: false };
  }

  /** The user's ⭐ words, newest first. */
  async listSaves(userId: string): Promise<SavedDictionaryWord[]> {
    const rows = await this.saves.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (rows.length === 0) return [];

    const words = rows.map((r) => r.word);
    const [entries, glosses] = await Promise.all([
      this.entries.find({ where: { word: In(words) } }),
      this.translations.find({ where: { word: In(words) } }),
    ]);
    const entryByWord = new Map(entries.map((e) => [e.word, e]));
    const glossByWord = new Map(glosses.map((g) => [g.word, g]));

    // Subtitle order (design §4.3): the short gloss if the word was ever tapped
    // in the reader, else the first sense's SENTENCE translation, else nothing.
    // Nothing is snapshotted, so an admin edit shows up immediately.
    return rows.map((r) => {
      const entry = entryByWord.get(r.word) ?? null;
      const gloss = glossByWord.get(r.word)?.translation?.trim() ?? '';
      return {
        word: r.word,
        senses: entry?.senses ?? null,
        translation: gloss || entry?.senses?.[0]?.translation || '',
      };
    });
  }

  /** Toggle ⭐ for a word. Never touches the curated `words` bank. */
  async toggleSave(
    userId: string,
    raw: string,
  ): Promise<{ word: string; saved: boolean }> {
    const word = normaliseWord(raw);
    if (!word) throw new BadRequestException('Хоосон үг');
    if (word.length > SENSE_FIELD_MAX.word) {
      throw new BadRequestException('Хэт урт үг');
    }

    const existing = await this.saves.findOne({ where: { userId, word } });
    if (existing) {
      await this.saves.remove(existing);
      return { word, saved: false };
    }
    await this.saves.save(this.saves.create({ userId, word }));
    return { word, saved: true };
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  /** Paginated Толь listing for the admin panel. */
  async adminList(query: {
    search?: string;
    page?: number;
    limit?: number;
    sort?: 'searches' | 'recent';
  }): Promise<{
    items: DictionaryEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));

    const qb = this.entries.createQueryBuilder('e');
    const search = query.search?.trim();
    if (search) {
      // ILIKE is already case-insensitive — no need to lower-case the term.
      qb.where('e.word ILIKE :search', { search: `%${search}%` });
    }
    if (query.sort === 'recent') {
      qb.orderBy('e.createdAt', 'DESC');
    } else {
      qb.orderBy('e.searchCount', 'DESC').addOrderBy('e.createdAt', 'DESC');
    }
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  /** Replace an entry's senses by hand; marks it as edited. */
  async adminUpdate(id: string, senses: WordSense[]): Promise<DictionaryEntry> {
    const entry = await this.entries.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Толины бичлэг олдсонгүй');
    // Trim like parseSenses does, so a hand-edited sense and an AI-generated
    // one are stored the same way.
    entry.senses = senses.slice(0, MAX_SENSES).map((s) => ({
      word: s.word.trim(),
      example: s.example.trim(),
      translation: s.translation.trim(),
    }));
    entry.edited = true;
    return this.entries.save(entry);
  }

  /** Delete an entry. The next search for that word regenerates it via AI. */
  async adminRemove(id: string): Promise<{ deleted: true }> {
    const result = await this.entries.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Толины бичлэг олдсонгүй');
    }
    return { deleted: true };
  }
}
