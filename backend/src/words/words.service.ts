import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { Word } from '../entities/word.entity';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';

export interface AiFillResult {
  mongolian: string;
  partOfSpeech: string;
  exampleSentence: string;
  exampleTranslation: string;
}

/** A page of results plus the total count, for paginated list endpoints. */
export interface PaginatedWords {
  items: Word[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class WordsService implements OnModuleInit {
  private anthropic: Anthropic;

  constructor(
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.anthropic = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  /**
   * Use Claude Haiku to auto-generate Mongolian translation, part of speech,
   * and example sentences for a given English word.
   * Called by the admin "✨ AI бөглөх" button before saving.
   */
  async aiFill(english: string): Promise<AiFillResult> {
    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content:
            `Generate vocabulary data for the English word "${english}".\n` +
            'Return ONLY valid JSON (no markdown, no explanation):\n' +
            '{\n' +
            '  "mongolian": "<Mongolian translation>",\n' +
            '  "partOfSpeech": "<noun|verb|adjective|adverb|phrase>",\n' +
            '  "exampleSentence": "<short natural English sentence using the word>",\n' +
            '  "exampleTranslation": "<Mongolian translation of the example sentence>"\n' +
            '}',
        },
      ],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    const parsed = JSON.parse(raw) as AiFillResult;
    return parsed;
  }

  create(dto: CreateWordDto): Promise<Word> {
    const word = this.words.create(dto);
    return this.words.save(word);
  }

  /** List words with optional level/lesson filters and pagination. */
  async findAll(query: QueryWordsDto): Promise<PaginatedWords> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Build a where clause from only the filters that were provided.
    const where: Record<string, unknown> = {};
    if (query.level) where.level = query.level;
    if (query.lessonId) where.lessonId = query.lessonId;

    const [items, total] = await this.words.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  /** Get one word or throw 404. */
  async findOne(id: string): Promise<Word> {
    const word = await this.words.findOne({ where: { id } });
    if (!word) {
      throw new NotFoundException('Үг олдсонгүй');
    }
    return word;
  }

  async update(id: string, dto: UpdateWordDto): Promise<Word> {
    const word = await this.findOne(id); // throws if missing
    Object.assign(word, dto);
    return this.words.save(word);
  }

  async remove(id: string): Promise<void> {
    const word = await this.findOne(id); // throws if missing
    await this.words.remove(word);
  }

  /**
   * Bulk-insert words, skipping any that already exist (same english + level).
   * Returns counts of inserted vs skipped.
   */
  async bulkImport(
    items: CreateWordDto[],
  ): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    // Process in batches of 100 to avoid query bloat
    const BATCH = 100;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (dto) => {
          const exists = await this.words.findOne({
            where: { english: dto.english, level: dto.level ?? 'a1' as any },
            select: { id: true },
          });
          if (exists) { skipped++; return; }
          await this.words.save(this.words.create(dto));
          inserted++;
        }),
      );
    }

    return { inserted, skipped };
  }
}
