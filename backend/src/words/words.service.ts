import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
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
  imageUrl: string | null;
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
  private readonly logger = new Logger(WordsService.name);

  constructor(
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.anthropic = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  /**
   * Use Claude Haiku (text) + Flux Schnell via Replicate (image) in parallel
   * to auto-fill all word fields. Called by the admin "✨ AI бөглөх" button.
   * Image generation is skipped gracefully if REPLICATE_API_TOKEN is not set.
   */
  async aiFill(english: string): Promise<AiFillResult> {
    const [text, imageUrl] = await Promise.all([
      this.generateText(english),
      this.generateImage(english),
    ]);
    return { ...text, imageUrl };
  }

  private async generateText(english: string): Promise<Omit<AiFillResult, 'imageUrl'>> {
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
    return JSON.parse(raw) as Omit<AiFillResult, 'imageUrl'>;
  }

  /**
   * Generate an illustration via Replicate Flux Schnell (~$0.003/image).
   * Downloads the result and saves it to /uploads so it's served like any
   * other uploaded file. Returns null if no API token is configured.
   */
  private async generateImage(english: string): Promise<string | null> {
    const token = this.config.get<string>('REPLICATE_API_TOKEN');
    if (!token) return null;

    try {
      const res = await fetch(
        'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'wait', // synchronous — waits up to 60s for the result
          },
          body: JSON.stringify({
            input: {
              prompt: `Simple clean educational illustration for the English word "${english}", flat design, white background, minimalist style, no text`,
              num_outputs: 1,
              output_format: 'jpg',
              output_quality: 80,
              aspect_ratio: '16:9',
            },
          }),
        },
      );

      const prediction = await res.json() as { output?: string[] };
      const outputUrl = prediction?.output?.[0];
      if (!outputUrl) return null;

      // Download the image and save to local uploads folder
      const imgRes = await fetch(outputUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const filename = `ai-${Date.now()}-${english.replace(/\W+/g, '-')}.jpg`;
      const uploadsDir = join(process.cwd(), 'uploads');
      mkdirSync(uploadsDir, { recursive: true });
      writeFileSync(join(uploadsDir, filename), buffer);

      const baseUrl = this.config.get<string>('BASE_URL', 'http://localhost:3000');
      return `${baseUrl}/uploads/${filename}`;
    } catch (err) {
      this.logger.warn(`Image generation failed for "${english}": ${(err as Error).message}`);
      return null;
    }
  }

  create(dto: CreateWordDto): Promise<Word> {
    const word = this.words.create(dto);
    return this.words.save(word);
  }

  /** List words with optional level/lesson filters and pagination. */
  async findAll(query: QueryWordsDto): Promise<PaginatedWords> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

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
    if (!word) throw new NotFoundException('Үг олдсонгүй');
    return word;
  }

  async update(id: string, dto: UpdateWordDto): Promise<Word> {
    const word = await this.findOne(id);
    Object.assign(word, dto);
    return this.words.save(word);
  }

  async remove(id: string): Promise<void> {
    const word = await this.findOne(id);
    await this.words.remove(word);
  }

  /**
   * Bulk-insert words, skipping any that already exist (same english + level).
   * Returns counts of inserted vs skipped.
   */
  async bulkImport(items: CreateWordDto[]): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    const BATCH = 100;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (dto) => {
          const exists = await this.words.findOne({
            where: { english: dto.english, level: dto.level ?? ('a1' as any) },
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
