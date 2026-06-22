import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';
import { Word } from '../entities/word.entity';
import { WordStatus, XpSource, SparksSource } from '../common/enums';
import { XpService } from '../xp/xp.service';
import { SparksService } from '../sparks/sparks.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QuizAnswerDto } from './dto/quiz.dto';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';

/** A page of results plus the total count, for paginated list endpoints. */
export interface PaginatedWords {
  items: Word[];
  total: number;
  page: number;
  limit: number;
}

/** One multiple-choice question for the vocabulary quiz (no answer leaked). */
export interface QuizQuestion {
  wordId: string;
  english: string;
  phonetic: string | null;
  imageUrl: string | null;
  /** 4 Mongolian options, shuffled — one is correct. Graded server-side. */
  options: string[];
}

/** Result of grading a submitted vocabulary quiz. */
export interface QuizResult {
  total: number;
  correct: number;
  xpAwarded: number;
  sparksAwarded: number;
}

/** Reward per correct answer (anti-abuse: only correct answers earn). */
const XP_PER_CORRECT = 5;
const SPARKS_PER_CORRECT = 1;

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    private readonly xp: XpService,
    private readonly sparks: SparksService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async create(dto: CreateWordDto, userId?: string): Promise<Word> {
    const { generateImage, ...wordFields } = dto;
    const word = this.words.create({
      ...wordFields,
      slug: slugify(dto.english),
    });
    const saved = await this.words.save(word);

    if (generateImage && userId) {
      return this.generateImage(saved.id, userId);
    }

    return saved;
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

  async update(id: string, dto: UpdateWordDto, userId?: string): Promise<Word> {
    const word = await this.findOne(id); // throws if missing
    const { generateImage, ...wordFields } = dto;
    Object.assign(word, wordFields);
    const saved = await this.words.save(word);

    if (generateImage && userId) {
      return this.generateImage(saved.id, userId);
    }

    return saved;
  }

  async generateImage(id: string, userId: string): Promise<Word> {
    const word = await this.findOne(id);
    const result = await this.aiGateway.generateVocabularyImage({
      userId,
      wordId: word.id,
      english: word.english,
      mongolian: word.mongolian,
      partOfSpeech: word.partOfSpeech,
    });
    word.imageUrl = result.imageUrl;
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
          const { generateImage: _generateImage, ...wordFields } = dto;
          await this.words.save(
            this.words.create({ ...wordFields, slug: slugify(dto.english) }),
          );
          inserted++;
        }),
      );
    }

    return { inserted, skipped };
  }

  // ── Vocabulary quiz ──────────────────────────────────────────────────────

  /**
   * Build a multiple-choice quiz from PUBLISHED words: each question shows an
   * English word and 4 Mongolian options (the correct meaning + 3 distractors
   * from other words). The correct answer is NOT sent to the client — grading
   * happens server-side in `gradeQuiz`.
   */
  async generateQuiz(count = 10): Promise<QuizQuestion[]> {
    // Random pool big enough to supply answers + distractors. RANDOM() is fine
    // at MVP scale; switch to a sampled approach if the table gets huge.
    const pool = await this.words
      .createQueryBuilder('w')
      .where('w.status = :status', { status: WordStatus.PUBLISHED })
      .andWhere("w.mongolian <> ''")
      .orderBy('RANDOM()')
      .limit(Math.max(count * 4, 40))
      .getMany();

    // De-duplicate distractors by Mongolian meaning so options never repeat.
    const uniqueMeanings = Array.from(new Set(pool.map((w) => w.mongolian)));
    if (uniqueMeanings.length < 4) {
      throw new BadRequestException(
        'Сорил үүсгэхэд хангалттай нийтлэгдсэн үг алга байна',
      );
    }

    const answers = pool.slice(0, Math.min(count, pool.length));
    return answers.map((word) => {
      const distractors = shuffle(
        uniqueMeanings.filter((m) => m !== word.mongolian),
      ).slice(0, 3);
      return {
        wordId: word.id,
        english: word.english,
        phonetic: word.phonetic,
        imageUrl: word.imageUrl,
        options: shuffle([word.mongolian, ...distractors]),
      };
    });
  }

  /**
   * Grade submitted answers and award XP + Sparks for the correct ones only
   * (anti-abuse — wrong answers earn nothing). Re-reads each word so the client
   * can't claim a meaning that isn't the real one.
   */
  async gradeQuiz(
    userId: string,
    answers: QuizAnswerDto[],
  ): Promise<QuizResult> {
    if (answers.length === 0) {
      throw new BadRequestException('Хариулт алга байна');
    }

    const ids = [...new Set(answers.map((a) => a.wordId))];
    const words = await this.words.find({
      where: { id: In(ids), status: WordStatus.PUBLISHED },
    });
    const byId = new Map(words.map((w) => [w.id, w]));

    let correct = 0;
    for (const a of answers) {
      const word = byId.get(a.wordId);
      if (word && a.choice.trim() === word.mongolian.trim()) correct++;
    }

    const xpAwarded = correct * XP_PER_CORRECT;
    const sparksAwarded = correct * SPARKS_PER_CORRECT;
    if (xpAwarded > 0) {
      await this.xp.award({ userId, amount: xpAwarded, source: XpSource.QUIZ });
    }
    if (sparksAwarded > 0) {
      await this.sparks.change({
        userId,
        amount: sparksAwarded,
        source: SparksSource.QUIZ,
      });
    }

    return { total: answers.length, correct, xpAwarded, sparksAwarded };
  }
}
