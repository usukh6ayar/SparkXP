import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ReadingPassage, ReadingSentence } from '../entities/reading-passage.entity';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';
import { QueryReadingDto } from './dto/query-reading.dto';

/** Average adult reading speed (words per minute) for the time estimate. */
const WORDS_PER_MINUTE = 200;

/** A page of results plus the total count, for the paginated list endpoint. */
export interface PaginatedReading {
  items: ReadingPassage[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Reading passages CRUD (Reading feature, M7). Mirrors the Words module's
 * publish-gating + pagination patterns. AI guess-choices (Phase 2) and sentence
 * audio (Phase 3) hook in here later.
 */
@Injectable()
export class ReadingService {
  constructor(
    @InjectRepository(ReadingPassage)
    private readonly passages: Repository<ReadingPassage>,
  ) {}

  /**
   * Split raw passage text into sentences on `.`/`?`/`!` boundaries. A rough
   * MVP splitter — the admin always edits the resulting list by hand, so we
   * don't try to be perfect about abbreviations/decimals.
   */
  splitIntoSentences(text: string): ReadingSentence[] {
    if (!text?.trim()) return [];
    const parts = text
      .replace(/\s+/g, ' ')
      .match(/[^.!?]+[.!?]*/g);
    if (!parts) return [];
    return parts
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sentence, index) => ({ index, text: sentence, audioUrl: null }));
  }

  /** Count words across all sentences. */
  private countWords(sentences: ReadingSentence[]): number {
    return sentences.reduce((sum, s) => {
      const words = s.text.trim().split(/\s+/).filter(Boolean);
      return sum + words.length;
    }, 0);
  }

  /** Re-number sentences 0..n and recompute word count + reading time. */
  private normalize(passage: ReadingPassage): void {
    passage.sentences = (passage.sentences ?? []).map((s, index) => ({
      ...s,
      index,
      audioUrl: s.audioUrl ?? null,
    }));
    passage.wordCount = this.countWords(passage.sentences);
    passage.estimatedReadingTime = Math.ceil(
      (passage.wordCount / WORDS_PER_MINUTE) * 60,
    );
  }

  async create(dto: CreateReadingDto): Promise<ReadingPassage> {
    const passage = this.passages.create({
      title: dto.title,
      cefr: dto.cefr,
      coverImageUrl: dto.coverImageUrl ?? null,
      keyVocab: dto.keyVocab ?? [],
      sentences: (dto.sentences ?? []) as ReadingSentence[],
      isPublished: dto.isPublished ?? false,
    });
    this.normalize(passage);
    return this.passages.save(passage);
  }

  async findAll(query: QueryReadingDto): Promise<PaginatedReading> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};

    // Students only ever see published passages; admin passes all=true for drafts.
    if (!query.all) where.isPublished = true;
    if (query.cefr) where.cefr = query.cefr;
    if (query.search) where.title = ILike(`%${query.search}%`);

    const [items, total] = await this.passages.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<ReadingPassage> {
    const passage = await this.passages.findOne({ where: { id } });
    if (!passage) throw new NotFoundException('Унших материал олдсонгүй');
    return passage;
  }

  async update(id: string, dto: UpdateReadingDto): Promise<ReadingPassage> {
    const passage = await this.findOne(id);
    if (dto.title !== undefined) passage.title = dto.title;
    if (dto.cefr !== undefined) passage.cefr = dto.cefr;
    if (dto.coverImageUrl !== undefined) passage.coverImageUrl = dto.coverImageUrl;
    if (dto.keyVocab !== undefined) passage.keyVocab = dto.keyVocab;
    if (dto.sentences !== undefined)
      passage.sentences = dto.sentences as ReadingSentence[];
    if (dto.isPublished !== undefined) passage.isPublished = dto.isPublished;
    this.normalize(passage);
    return this.passages.save(passage);
  }

  async remove(id: string): Promise<void> {
    const passage = await this.findOne(id);
    await this.passages.remove(passage);
  }
}
