import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, ILike, In, IsNull } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { Word } from '../entities/word.entity';
import { WordStatus, XpSource, SparksSource, ContentLevel } from '../common/enums';
import { XpService } from '../xp/xp.service';
import { SparksService } from '../sparks/sparks.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QuizAnswerDto } from './dto/quiz.dto';

export interface ImportReport {
  total: number;
  inserted: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
  duplicates: { row: number; word: string }[];
  missingImage: string[];
  missingAudio: string[];
}

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

/** RFC-4180 CSV line splitter — respects quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cur);
  return result;
}

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

  // ── Admin stats ────────────────────────────────────────────────────────────

  /** Word counts by status + missing media counts, for the admin review panel. */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    missingImage: number;
    missingAudio: number;
  }> {
    const [rows, total, missingImage, missingAudio] = await Promise.all([
      this.words
        .createQueryBuilder('w')
        .select('w.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('w.status')
        .getRawMany<{ status: string; count: string }>(),
      this.words.count(),
      this.words.count({ where: { imageUrl: IsNull() } }),
      this.words.count({ where: { audioUrl: IsNull() } }),
    ]);
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    return { total, byStatus, missingImage, missingAudio };
  }

  /** Bulk-update status/category/level for a set of word IDs. */
  async bulkEdit(
    ids: string[],
    changes: { status?: WordStatus; category?: string; level?: ContentLevel },
  ): Promise<{ updated: number }> {
    if (!ids.length) throw new BadRequestException('ids хоосон байна');
    await this.words
      .createQueryBuilder()
      .update(Word)
      .set(changes)
      .where('id IN (:...ids)', { ids })
      .execute();
    return { updated: ids.length };
  }

  // ── Import v2 (with validation report) ────────────────────────────────────

  /**
   * Parse a CSV string and import words with a full validation report.
   * New words land as `needs_review` (not `published`) so they go through review.
   * Supported columns: word | english, mongolian_meaning | mongolian, level,
   *   part_of_speech, category, english_definition, english_example,
   *   mongolian_example, phonetic, image_url, audio_url.
   */
  async importCsv(csvText: string): Promise<ImportReport> {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) throw new BadRequestException('CSV хоосон байна');

    const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const dataRows = lines.slice(1).map((line, i) => {
      const vals = splitCsvLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, j) => { obj[h] = (vals[j] ?? '').trim(); });
      return { rowNum: i + 2, obj };
    });

    const report: ImportReport = { total: dataRows.length, inserted: 0, skipped: 0, errors: [], duplicates: [], missingImage: [], missingAudio: [] };

    const validLevels = Object.values(ContentLevel) as string[];

    for (const { rowNum, obj } of dataRows) {
      const english = obj['word'] || obj['english'];
      const mongolian = obj['mongolian_meaning'] || obj['mongolian'];
      const levelRaw = (obj['level'] || 'a1').toLowerCase();

      if (!english) {
        report.errors.push({ row: rowNum, field: 'word', message: 'Англи үг хоосон байна' });
        report.skipped++; continue;
      }
      if (!mongolian) {
        report.errors.push({ row: rowNum, field: 'mongolian_meaning', message: 'Монгол утга хоосон байна' });
        report.skipped++; continue;
      }
      if (!validLevels.includes(levelRaw)) {
        report.errors.push({ row: rowNum, field: 'level', message: `Түвшин буруу: "${levelRaw}" (a1–c2 байх ёстой)` });
        report.skipped++; continue;
      }
      const level = levelRaw as ContentLevel;
      const sl = slugify(english);

      const exists = await this.words.findOne({ where: { slug: sl, level }, select: { id: true } });
      if (exists) { report.duplicates.push({ row: rowNum, word: english }); report.skipped++; continue; }

      const w = this.words.create({
        english, mongolian, slug: sl, level,
        partOfSpeech: obj['part_of_speech'] || undefined,
        category: obj['category'] || undefined,
        englishDefinition: obj['english_definition'] || undefined,
        exampleSentence: obj['english_example'] || undefined,
        exampleTranslation: obj['mongolian_example'] || undefined,
        phonetic: obj['phonetic'] || undefined,
        imageUrl: obj['image_url'] || undefined,
        audioUrl: obj['audio_url'] || undefined,
        status: WordStatus.NEEDS_REVIEW,
      });
      await this.words.save(w);
      report.inserted++;
      if (!w.imageUrl) report.missingImage.push(sl);
      if (!w.audioUrl) report.missingAudio.push(sl);
    }

    return report;
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
