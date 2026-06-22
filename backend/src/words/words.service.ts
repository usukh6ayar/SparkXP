import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, ILike, In } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { Word } from '../entities/word.entity';
import { WordStatus, XpSource, SparksSource } from '../common/enums';
import { XpService } from '../xp/xp.service';
import { SparksService } from '../sparks/sparks.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QuizAnswerDto } from './dto/quiz.dto';

export interface AiFillResult {
  mongolian: string;
  englishDefinition: string;
  phonetic: string;
  partOfSpeech: string;
  category: string;
  level: string;
  exampleSentence: string;
  exampleTranslation: string;
  sparkTip: string;
  imageUrl: string | null;
}

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

/**
 * Claude sometimes wraps JSON in ```json … ``` fences despite instructions.
 * Strip them (and any leading/trailing prose) so JSON.parse succeeds.
 */
export function stripJsonFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  // Fall back to the outermost { … } if there's surrounding text.
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

@Injectable()
export class WordsService implements OnModuleInit {
  private anthropic: Anthropic;
  private readonly logger = new Logger(WordsService.name);

  constructor(
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
    private readonly xp: XpService,
    private readonly sparks: SparksService,
    private readonly aiGateway: AiGatewayService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.anthropic = new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
  }

  // ── AI Fill (admin "✨ AI бөглөх" button) ──────────────────────────────────

  /**
   * Generate all word fields from just the English word.
   * Text: Claude Haiku. Image: OpenAI via AiGatewayService.
   * Both run in parallel. Image is skipped gracefully if OPENAI_API_KEY is unset.
   */
  async aiFill(english: string): Promise<AiFillResult> {
    const [text, imageUrl] = await Promise.all([
      this.fillText(english),
      this.fillImage(english).catch(() => null),
    ]);
    return { ...text, imageUrl };
  }

  private async fillText(english: string): Promise<Omit<AiFillResult, 'imageUrl'>> {
    const response = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content:
            `Generate complete vocabulary-card data for the English word "${english}".\n` +
            'Return ONLY valid JSON (no markdown fences, no explanation):\n' +
            '{\n' +
            '  "mongolian": "<Mongolian meaning, e.g. Орхих, хаях>",\n' +
            '  "englishDefinition": "<short English definition, max 1 sentence>",\n' +
            '  "phonetic": "<IPA pronunciation incl. slashes, e.g. /əˈbændən/>",\n' +
            '  "partOfSpeech": "<noun|verb|adjective|adverb|phrase>",\n' +
            '  "category": "<one of: Daily Life, Business, Law, Medical, Engineering, Travel, Academic>",\n' +
            '  "level": "<CEFR level: a1|a2|b1|b2|c1|c2>",\n' +
            '  "exampleSentence": "<short natural English sentence using the word>",\n' +
            '  "exampleTranslation": "<Mongolian translation of the example sentence>",\n' +
            '  "sparkTip": "<a short, fun memory aid / mnemonic in Mongolian to remember the word>"\n' +
            '}',
        },
      ],
    });
    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    return JSON.parse(stripJsonFences(raw)) as Omit<AiFillResult, 'imageUrl'>;
  }

  private async fillImage(english: string): Promise<string | null> {
    const result = await this.aiGateway.generateVocabularyImage({
      userId: 'admin-fill',
      wordId: 'preview',
      english,
      mongolian: '',
      partOfSpeech: null,
    });
    return result.imageUrl;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreateWordDto, userId?: string): Promise<Word> {
    // Block duplicates — same English word (case-insensitive) can't be added twice.
    const duplicate = await this.words.findOne({
      where: { english: ILike(dto.english.trim()) },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Энэ үг аль хэдийн бүртгэлтэй байна');
    }

    const { generateImage, ...wordFields } = dto;
    const word = this.words.create({ ...wordFields, slug: slugify(dto.english) });
    const saved = await this.words.save(word);
    if (generateImage && userId) return this.generateImage(saved.id, userId);
    return saved;
  }

  /**
   * List words with optional filters + pagination.
   * Defaults to `status = published` so the student app only ever sees live content.
   */
  async findAll(query: QueryWordsDto): Promise<PaginatedWords> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const base: Record<string, unknown> = {};
    base.status = query.status ?? WordStatus.PUBLISHED;
    if (query.level) base.level = query.level;
    if (query.lessonId) base.lessonId = query.lessonId;
    if (query.category) base.category = query.category;

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
    if (!word) throw new NotFoundException('Үг олдсонгүй');
    return word;
  }

  async update(id: string, dto: UpdateWordDto, userId?: string): Promise<Word> {
    const word = await this.findOne(id);
    const { generateImage, ...wordFields } = dto;
    Object.assign(word, wordFields);
    const saved = await this.words.save(word);
    if (generateImage && userId) return this.generateImage(saved.id, userId);
    return saved;
  }

  /** Generate and save an AI illustration for an existing word via OpenAI. */
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
    const word = await this.findOne(id);
    await this.words.remove(word);
  }

  /**
   * Bulk-insert words, skipping any that already exist (same english + level).
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
          const { generateImage: _gi, ...wordFields } = dto;
          await this.words.save(this.words.create({ ...wordFields, slug: slugify(dto.english) }));
          inserted++;
        }),
      );
    }
    return { inserted, skipped };
  }

  // ── Vocabulary quiz ──────────────────────────────────────────────────────

  /**
   * Build a multiple-choice quiz from PUBLISHED words: each question shows an
   * English word and 4 Mongolian options (the correct meaning + 3 distractors).
   */
  async generateQuiz(count = 10): Promise<QuizQuestion[]> {
    const pool = await this.words
      .createQueryBuilder('w')
      .where('w.status = :status', { status: WordStatus.PUBLISHED })
      .andWhere("w.mongolian <> ''")
      .orderBy('RANDOM()')
      .limit(Math.max(count * 4, 40))
      .getMany();

    const uniqueMeanings = Array.from(new Set(pool.map((w) => w.mongolian)));
    if (uniqueMeanings.length < 4) {
      throw new BadRequestException('Сорил үүсгэхэд хангалттай нийтлэгдсэн үг алга байна');
    }

    const answers = pool.slice(0, Math.min(count, pool.length));
    return answers.map((word) => {
      const distractors = shuffle(uniqueMeanings.filter((m) => m !== word.mongolian)).slice(0, 3);
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
   * Grade submitted answers and award XP + Sparks for correct ones only.
   */
  async gradeQuiz(userId: string, answers: QuizAnswerDto[]): Promise<QuizResult> {
    if (answers.length === 0) throw new BadRequestException('Хариулт алга байна');

    const ids = [...new Set(answers.map((a) => a.wordId))];
    const wordList = await this.words.find({ where: { id: In(ids), status: WordStatus.PUBLISHED } });
    const byId = new Map(wordList.map((w) => [w.id, w]));

    let correct = 0;
    for (const a of answers) {
      const word = byId.get(a.wordId);
      if (word && a.choice.trim() === word.mongolian.trim()) correct++;
    }

    const xpAwarded = correct * XP_PER_CORRECT;
    const sparksAwarded = correct * SPARKS_PER_CORRECT;
    if (xpAwarded > 0) await this.xp.award({ userId, amount: xpAwarded, source: XpSource.QUIZ });
    if (sparksAwarded > 0) {
      await this.sparks.change({ userId, amount: sparksAwarded, source: SparksSource.QUIZ });
    }

    return { total: answers.length, correct, xpAwarded, sparksAwarded };
  }
}
