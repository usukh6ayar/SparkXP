import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Word } from '../entities/word.entity';
import { WordStatus } from '../common/enums';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';

/** A page of results plus the total count, for paginated list endpoints. */
export interface PaginatedWords {
  items: Word[];
  total: number;
  page: number;
  limit: number;
}

/**
 * URL-safe key from an English word: lowercase, trimmed, spaces/punctuation → `_`.
 * Used to auto-match bulk-uploaded media filenames (`abandon.mp3` → "abandon").
 */
export function slugify(english: string): string {
  return english
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

@Injectable()
export class WordsService {
  constructor(
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
  ) {}

  create(dto: CreateWordDto): Promise<Word> {
    const word = this.words.create({ ...dto, slug: slugify(dto.english) });
    return this.words.save(word);
  }

  /**
   * List words with optional filters + pagination.
   *
   * Defaults to `status = published` so the student app only ever sees live
   * content. The admin panel passes an explicit `status` to see other states.
   */
  async findAll(query: QueryWordsDto): Promise<PaginatedWords> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // Build a where clause from only the filters that were provided.
    const base: Record<string, unknown> = {};
    base.status = query.status ?? WordStatus.PUBLISHED;
    if (query.level) base.level = query.level;
    if (query.lessonId) base.lessonId = query.lessonId;
    if (query.category) base.category = query.category;

    // A text search matches English OR Mongolian → two where-objects (OR).
    const where = query.search
      ? [
          { ...base, english: ILike(`%${query.search}%`) },
          { ...base, mongolian: ILike(`%${query.search}%`) },
        ]
      : base;

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
          await this.words.save(
            this.words.create({ ...dto, slug: slugify(dto.english) }),
          );
          inserted++;
        }),
      );
    }

    return { inserted, skipped };
  }
}
