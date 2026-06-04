import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Word } from '../entities/word.entity';
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

@Injectable()
export class WordsService {
  constructor(
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
  ) {}

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
}
